// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import hpack from './vendor-hpack.mjs'

const mock = vi.hoisted(() => ({ options: undefined, metadata: { selectedAlpn: 'h2' } }))
vi.mock('./vendor-tls.mjs', () => ({
  setCryptoImplementation: vi.fn(),
  makeTLSClient: (options) => {
    mock.options = options
    return {
      startHandshake: vi.fn(() => options.onHandshake()),
      handleReceivedBytes: vi.fn(),
      write: vi.fn(),
      getMetadata: () => mock.metadata
    }
  }
}))

// The module deliberately clears this vendor extension to its pinned root store.
globalThis.TLS_ADDITIONAL_ROOT_CA_LIST ||= []
const { requestKinoboxHttp2 } = await import('./kinobox-http2-vendored.mjs')

function frame(type, flags, payload = Buffer.alloc(0), stream = 1) {
  const header = Buffer.alloc(9)
  header.writeUIntBE(payload.length, 0, 3)
  header[3] = type
  header[4] = flags
  header.writeUInt32BE(stream, 5)
  return Buffer.concat([header, payload])
}
function responseHeaders(status = 200) {
  const compressor = hpack.compressor.create({ table: { size: 4096 } })
  compressor.write([
    { name: ':status', value: String(status) },
    { name: 'content-type', value: 'application/json' }
  ])
  return frame(1, 4, compressor.read())
}
async function begin(options = {}) {
  let closed = false
  const socket = {
    readable: new ReadableStream(),
    writable: new WritableStream(),
    close: vi.fn(async () => {
      closed = true
    })
  }
  const open = vi.fn(async () => socket)
  const promise = requestKinoboxHttp2({ path: '/api/movies/301' }, open, options)
  // Attach rejection immediately; tests may finish the request before awaiting it.
  void promise.catch(() => {})
  await vi.waitFor(() => expect(mock.options).toBeDefined())
  return { promise, open, socket, closed: () => closed }
}

beforeEach(() => {
  mock.options = undefined
  mock.metadata = { selectedAlpn: 'h2' }
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('bounded Kinobox HTTP/2 transport', () => {
  it.each(['/api/movies/search/', '/api/players', '/api/movies/301'])(
    'opens only the fixed upstream with certificate verification for %s',
    async (path) => {
      const socket = {
        readable: new ReadableStream(),
        writable: new WritableStream(),
        close: vi.fn(async () => {})
      }
      const open = vi.fn(async () => socket)
      const pending = requestKinoboxHttp2({ path }, open)
      await vi.waitFor(() => expect(mock.options).toBeDefined())
      expect(open).toHaveBeenCalledExactlyOnceWith('api.kinobox.tv', 443)
      expect(mock.options).toMatchObject({
        host: 'api.kinobox.tv',
        verifyServerCertificate: true,
        supportedProtocolVersions: ['TLS1_3'],
        applicationLayerProtocols: ['h2'],
        namedCurves: ['SECP256R1'],
        cipherSuites: ['TLS_AES_128_GCM_SHA256'],
        logger: { traceEnabled: false }
      })
      mock.options.onApplicationData(
        Buffer.concat([responseHeaders(), frame(0, 1, Buffer.from('{}'))])
      )
      expect((await pending).status).toBe(200)
      expect(socket.close).toHaveBeenCalledOnce()
    }
  )

  it('rejects arbitrary destinations before opening a socket', async () => {
    const open = vi.fn()
    for (const path of ['https://evil.example', '//evil.example', '/api/admin', '/api/movies/0'])
      await expect(requestKinoboxHttp2({ path }, open)).rejects.toThrow('Unsupported Kinobox path')
    expect(open).not.toHaveBeenCalled()
  })

  it('preserves fragmented frames and owns input bytes after the callback returns', async () => {
    const { promise, closed } = await begin()
    const first = Buffer.concat([responseHeaders(), frame(0, 0, Buffer.from('hello '))])
    mock.options.onApplicationData(first.subarray(0, 7))
    mock.options.onApplicationData(first.subarray(7))
    first.fill(0)
    const last = frame(0, 1, Buffer.from('world'))
    mock.options.onApplicationData(last)
    last.fill(0)
    expect((await promise).body.toString()).toBe('hello world')
    expect(closed()).toBe(true)
  })

  it('accepts exactly 1 MiB and rejects one extra byte', async () => {
    for (const bytes of [1024 * 1024, 1024 * 1024 + 1]) {
      mock.options = undefined
      const { promise, closed } = await begin()
      mock.options.onApplicationData(responseHeaders())
      for (let offset = 0; offset < bytes; offset += 16384) {
        const end = Math.min(offset + 16384, bytes)
        mock.options.onApplicationData(
          frame(0, end === bytes ? 1 : 0, Buffer.alloc(end - offset, 65))
        )
      }
      if (bytes === 1024 * 1024) expect((await promise).body).toEqual(Buffer.alloc(bytes, 65))
      else await expect(promise).rejects.toThrow('Upstream response too large')
      expect(closed()).toBe(true)
    }
  })

  it.each([
    [frame(0, 1, Buffer.alloc(16385)), 'Oversized HTTP/2 frame'],
    [frame(3, 0, Buffer.from([0, 0, 0, 1])), 'RST_STREAM'],
    [frame(7, 0, Buffer.alloc(8), 0), 'GOAWAY'],
    [frame(5, 0), 'Unexpected server push'],
    [frame(0, 9, Buffer.from([1])), 'Invalid DATA padding']
  ])('closes on invalid or failed upstream frames', async (packet, message) => {
    const { promise, closed } = await begin()
    mock.options.onApplicationData(packet)
    await expect(promise).rejects.toThrow(message)
    expect(closed()).toBe(true)
  })

  it('rejects oversized header blocks and missing continuation', async () => {
    const { promise } = await begin()
    mock.options.onApplicationData(frame(1, 0, Buffer.alloc(16384)))
    mock.options.onApplicationData(frame(9, 0, Buffer.alloc(16384)))
    mock.options.onApplicationData(frame(9, 4, Buffer.alloc(1)))
    await expect(promise).rejects.toThrow('Oversized response headers')
    mock.options = undefined
    const next = await begin()
    mock.options.onApplicationData(frame(1, 0, Buffer.alloc(1)))
    mock.options.onApplicationData(frame(0, 1))
    await expect(next.promise).rejects.toThrow('Missing CONTINUATION')
  })

  it('returns upstream HTTP errors without hiding their status', async () => {
    const { promise } = await begin()
    mock.options.onApplicationData(Buffer.concat([responseHeaders(503), frame(0, 1)]))
    expect((await promise).status).toBe(503)
  })

  it('closes a stalled request on its deadline', async () => {
    const { promise, closed } = await begin({ timeoutMs: 80 })
    await expect(promise).rejects.toThrow('Upstream timeout')
    expect(closed()).toBe(true)
  })

  it('rejects a non-h2 handshake', async () => {
    mock.metadata = { selectedAlpn: 'http/1.1' }
    const { promise, closed } = await begin()
    await expect(promise).rejects.toThrow('HTTP/2 was not negotiated')
    expect(closed()).toBe(true)
  })
})

describe('issuer certificate fetch', () => {
  async function issuerTest(check) {
    const { promise } = await begin()
    try {
      await check(mock.options.fetchCertificateBytes)
    } finally {
      mock.options.onTlsEnd(new Error('test finished'))
      await promise.catch(() => {})
    }
  }
  it('keeps an allowlist and rejects redirects without following them', async () => {
    const fetch = vi.fn(
      async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } })
    )
    vi.stubGlobal('fetch', fetch)
    await issuerTest(async (load) => {
      for (const url of [
        'https://evil.example/a',
        'https://issuer.lencr.org.evil.example/a',
        'file:///tmp/a'
      ])
        await expect(load(url)).rejects.toThrow('Unapproved certificate issuer URL')
      expect(fetch).not.toHaveBeenCalled()
      await expect(load('http://r13.i.lencr.org/')).rejects.toThrow(
        'Issuer certificate unavailable'
      )
      expect(fetch.mock.calls[0][1]).toMatchObject({
        redirect: 'manual',
        signal: expect.any(AbortSignal)
      })
      expect(fetch).toHaveBeenCalledOnce()
    })
  })
  it('returns bounded issuer bytes and rejects bodies above 64 KiB', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(new Response(new Uint8Array(65537)))
    vi.stubGlobal('fetch', fetch)
    await issuerTest(async (load) => {
      expect(await load('https://r13.i.lencr.org/')).toEqual(new Uint8Array([1, 2, 3]))
      await expect(load('https://r13.i.lencr.org/')).rejects.toThrow('Issuer certificate too large')
    })
  })
})
