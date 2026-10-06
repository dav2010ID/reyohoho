import { Buffer } from 'node:buffer'
import { makeTLSClient, setCryptoImplementation } from './vendor-tls.mjs'
import { webcryptoCrypto } from './vendor-crypto.mjs'
import hpack from './vendor-hpack.mjs'

setCryptoImplementation(webcryptoCrypto)
// This proxy trusts only the ISRG roots shipped in vendor-tls.mjs.
globalThis.TLS_ADDITIONAL_ROOT_CA_LIST.length = 0
const HOST = 'api.kinobox.tv'
const MAX_BODY = 1024 * 1024
const quiet = { trace() {}, debug() {}, info() {}, warn() {}, error() {} }
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'

function frame(type, flags, stream, payload = Buffer.alloc(0)) {
  const header = Buffer.alloc(9)
  header.writeUIntBE(payload.length, 0, 3)
  header[3] = type
  header[4] = flags
  header.writeUInt32BE(stream & 0x7fffffff, 5)
  return Buffer.concat([header, payload])
}

export function requestKinoboxHttp2(resource, openTransport, options = {}) {
  if (!/^\/api\/(?:movies\/(?:search\/|[1-9]\d{0,11})|players)$/.test(resource?.path || '')) {
    return Promise.reject(new Error('Unsupported Kinobox path'))
  }
  return new Promise((resolve, reject) => {
    let transport,
      reader,
      writer,
      tls,
      done = false
    let incoming = Buffer.alloc(0),
      headerBlock = Buffer.alloc(0),
      continuation = false,
      headersEnded = false
    let responseStatus,
      responseHeaders = {},
      responseEnded = false
    const bodies = []
    let bodyLength = 0
    let outgoing = Promise.resolve()
    const timer = setTimeout(
      () => finish(new Error('Upstream timeout')),
      options.timeoutMs || 15000
    )
    const finish = (error, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (reader) void reader.cancel().catch(() => {})
      if (transport) void Promise.resolve(transport.close()).catch(() => {})
      error ? reject(error) : resolve(value)
    }
    const send = (packet) => {
      outgoing = outgoing.then(() => {
        if (!done) return tls.write(packet)
      })
      void outgoing.catch((error) => finish(error))
    }
    const complete = () => {
      responseEnded = true
      if (!responseStatus) return finish(new Error('Missing HTTP/2 response status'))
      finish(null, {
        status: responseStatus,
        headers: responseHeaders,
        body: Buffer.concat(bodies),
        tls: tls.getMetadata()
      })
    }
    const decomp = hpack.decompressor.create({ table: { maxSize: 4096 } })
    decomp.on('error', (error) => finish(error))
    function decodeHeaders() {
      decomp.write(headerBlock)
      decomp.execute()
      let header
      while ((header = decomp.read())) {
        if (header.name === ':status') responseStatus = Number(header.value)
        else responseHeaders[header.name] = header.value
      }
      headerBlock = Buffer.alloc(0)
      continuation = false
    }
    function receive(data) {
      if (done) return
      incoming = Buffer.concat([incoming, Buffer.from(data)])
      while (incoming.length >= 9) {
        const length = incoming.readUIntBE(0, 3)
        if (length > 16384) throw new Error('Oversized HTTP/2 frame')
        if (incoming.length < length + 9) break
        const type = incoming[3],
          flags = incoming[4],
          stream = incoming.readUInt32BE(5) & 0x7fffffff
        let payload = incoming.subarray(9, 9 + length)
        incoming = incoming.subarray(9 + length)
        if (continuation && (type !== 9 || stream !== 1)) throw new Error('Missing CONTINUATION')
        if (type === 4) {
          if (stream !== 0 || (flags & 1 && length)) throw new Error('Invalid SETTINGS')
          if (!(flags & 1)) send(frame(4, 1, 0))
        } else if (type === 6) {
          if (stream !== 0 || length !== 8) throw new Error('Invalid PING')
          if (!(flags & 1)) send(frame(6, 1, 0, payload))
        } else if (type === 7) {
          const errorCode = length >= 8 ? payload.readUInt32BE(4) : -1
          if (!responseEnded) throw new Error('HTTP/2 GOAWAY: ' + errorCode)
        } else if (type === 3 && stream === 1) {
          throw new Error('HTTP/2 RST_STREAM: ' + (length === 4 ? payload.readUInt32BE(0) : -1))
        } else if ((type === 1 || type === 9) && stream === 1) {
          if (type === 1) {
            headersEnded = Boolean(flags & 1)
            if (flags & 8) {
              const padding = payload[0]
              if (padding >= payload.length) throw new Error('Invalid HEADERS padding')
              payload = payload.subarray(1, payload.length - padding)
            }
            if (flags & 32) {
              if (payload.length < 5) throw new Error('Invalid HEADERS priority')
              payload = payload.subarray(5)
            }
            continuation = true
          }
          headerBlock = Buffer.concat([headerBlock, payload])
          if (headerBlock.length > 32768) throw new Error('Oversized response headers')
          if (flags & 4) {
            decodeHeaders()
            if (headersEnded) complete()
          }
        } else if (type === 0 && stream === 1) {
          if (flags & 8) {
            const padding = payload[0]
            if (padding >= payload.length) throw new Error('Invalid DATA padding')
            payload = payload.subarray(1, payload.length - padding)
          }
          bodyLength += payload.length
          if (bodyLength > MAX_BODY) throw new Error('Upstream response too large')
          bodies.push(Buffer.from(payload))
          if (flags & 1) complete()
        } else if (type === 5) {
          throw new Error('Unexpected server push')
        }
        if (done) break
      }
    }
    async function run() {
      transport = await openTransport(HOST, 443)
      if (done) {
        await transport.close()
        return
      }
      reader = transport.readable.getReader()
      writer = transport.writable.getWriter()
      tls = makeTLSClient({
        host: HOST,
        verifyServerCertificate: true,
        applicationLayerProtocols: ['h2'],
        supportedProtocolVersions: ['TLS1_3'],
        namedCurves: ['SECP256R1'],
        cipherSuites: ['TLS_AES_128_GCM_SHA256'],
        logger: quiet,
        async fetchCertificateBytes(url) {
          const target = new URL(url)
          if (
            !['https:', 'http:'].includes(target.protocol) ||
            !target.hostname.endsWith('.lencr.org')
          )
            throw new Error('Unapproved certificate issuer URL')
          const response = await fetch(target, {
            redirect: 'error',
            signal: AbortSignal.timeout(5000)
          })
          if (!response.ok) throw new Error('Issuer certificate unavailable')
          const certificateReader = response.body.getReader()
          const chunks = []
          let length = 0
          try {
            for (;;) {
              const { value, done } = await certificateReader.read()
              if (done) break
              length += value.length
              if (length > 65536) throw new Error('Issuer certificate too large')
              chunks.push(Buffer.from(value))
            }
            return new Uint8Array(Buffer.concat(chunks))
          } finally {
            await certificateReader.cancel().catch(() => {})
          }
        },
        async write({ header, content }) {
          await writer.write(header)
          await writer.write(content)
        },
        onHandshake() {
          if (tls.getMetadata().selectedAlpn !== 'h2')
            return finish(new Error('HTTP/2 was not negotiated'))
          const settings = Buffer.alloc(12)
          settings.writeUInt16BE(2, 0)
          settings.writeUInt32BE(0, 2)
          settings.writeUInt16BE(4, 6)
          settings.writeUInt32BE(MAX_BODY, 8)
          const window = Buffer.alloc(4)
          window.writeUInt32BE(MAX_BODY - 65535)
          // Callers supply only validated Kinobox paths, never a destination URL.
          const url = new URL(resource.path, 'https://' + HOST)
          for (const [name, value] of Object.entries(resource.params || {})) {
            url.searchParams.set(name, String(value))
          }
          const comp = hpack.compressor.create({ table: { size: 4096 } })
          comp.write([
            { name: ':method', value: 'GET' },
            { name: ':scheme', value: 'https' },
            { name: ':authority', value: HOST },
            { name: ':path', value: url.pathname + url.search },
            { name: 'accept', value: '*/*' },
            { name: 'accept-encoding', value: 'br' },
            { name: 'referer', value: 'https://kinobox.in/' },
            { name: 'user-agent', value: UA }
          ])
          send(
            Buffer.concat([
              Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'),
              frame(4, 0, 0, settings),
              frame(8, 0, 0, window),
              frame(1, 5, 1, comp.read())
            ])
          )
        },
        onApplicationData(bytes) {
          try {
            receive(bytes)
          } catch (error) {
            finish(error)
          }
        },
        onTlsEnd(error) {
          if (!done) finish(error || new Error('Upstream closed before END_STREAM'))
        }
      })
      const pump = async () => {
        while (!done) {
          const chunk = await reader.read()
          if (chunk.done) {
            if (!done) finish(new Error('TCP connection closed early'))
            break
          }
          await tls.handleReceivedBytes(chunk.value)
        }
      }
      void pump().catch((error) => finish(error))
      await tls.startHandshake()
    }
    void run().catch((error) => finish(error))
  })
}
