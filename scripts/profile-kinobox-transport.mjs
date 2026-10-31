/**
 * LOCAL ONLY. No dependencies, credentials, Worker calls, cloud mutations, or file output.
 *
 * Offline components (no network, default):
 *   node scripts/profile-kinobox-transport.mjs
 * One GET per transport, fixed public origin, route validation, sequential, no retries:
 *   node scripts/profile-kinobox-transport.mjs --mode=compare --requests=1 --path=/api/movies/301
 * Emulate workerd's always-enabled util.debuglog formatting (without console I/O):
 *   node scripts/profile-kinobox-transport.mjs --mode=vendored --stream-debug=workerd-format
 * Native console output is opt-in: --stream-debug=workerd-console. Node's own behavior:
 *   NODE_DEBUG=stream node scripts/profile-kinobox-transport.mjs --stream-debug=node
 * --inspect-profile=off disables the in-memory inspector capture. Node --cpu-prof
 * may also be used explicitly; Node itself then writes its .cpuprofile outside this script.
 *
 * Process CPU includes native/background work; inspector samples only the main V8
 * thread and can miss WebCrypto worker-thread CPU. Async operation wall times overlap.
 * Instrumentation adds overhead. None of these measurements model Worker edge CPU,
 * connection pooling, TLS trust, protocol selection, or console ingestion costs.
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import * as http2 from 'node:http2'
import { Session } from 'node:inspector'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import { performance } from 'node:perf_hooks'
import { Duplex } from 'node:stream'
import { setTimeout as delay, setImmediate as nextTurn } from 'node:timers/promises'
import util from 'node:util'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import {
  resolveKinoboxResource,
  isKinoboxResponseValid
} from '../workers/kinobox-search/routes.mjs'

const HOST = 'api.kinobox.tv'
const ORIGIN = 'https://' + HOST
const MAX_BODY = 1024 * 1024
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0'
const requestHeaders = {
  accept: '*/*',
  'accept-language': 'ru,en-US;q=0.9,en;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  referer: 'https://kinohost.web.app/',
  origin: 'https://kinohost.web.app',
  'sec-gpc': '1',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': UA
}
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    if (!arg.startsWith('--') || !arg.includes('=')) throw new Error('Use --name=value arguments')
    const at = arg.indexOf('=')
    return [arg.slice(2, at), arg.slice(at + 1)]
  })
)
const knownArgs = ['mode', 'requests', 'path', 'stream-debug', 'inspect-profile', 'iterations']
for (const name of Object.keys(args)) {
  if (!knownArgs.includes(name)) throw new Error('Unknown option: ' + name)
}
const mode = args.mode || 'offline'
assert.ok(
  ['offline', 'vendored', 'fetch', 'native-http2', 'compare'].includes(mode),
  'Invalid mode'
)
const requests = boundedInteger(args.requests ?? '1', 1, 3)
const iterations = boundedInteger(args.iterations ?? '300', 1, 2000)
assert.ok(['on', 'off'].includes(args['inspect-profile'] || 'on'), 'Invalid inspect-profile option')
const inspectorEnabled = (args['inspect-profile'] || 'on') === 'on'
let streamPolicy = args['stream-debug'] || 'off'
assert.ok(['off', 'node', 'workerd-format', 'workerd-console'].includes(streamPolicy))
const inputPath = args.path || '/api/movies/301'
assert.ok(inputPath.startsWith('/') && !inputPath.startsWith('//'), 'Use a public API path')
const resource = resolveKinoboxResource(new URL(inputPath, ORIGIN))
assert.ok(!resource.error, resource.error || 'Invalid route')
// Match the content handler's upstream-only timestamp; it is not user input.
resource.params = { ...resource.params, ts: Math.floor(Date.now() / 1000) }
const requestUrl = new URL(resource.path, ORIGIN)
for (const [key, value] of Object.entries(resource.params)) requestUrl.searchParams.set(key, value)

let active
function boundedInteger(value, min, max) {
  assert.match(value, /^\d+$/)
  const n = Number(value)
  assert.ok(n >= min && n <= max, `Expected integer ${min}..${max}`)
  return n
}
function rounded(value) {
  return Math.round(value * 1000) / 1000
}
function cpuMs(start) {
  const cpu = process.cpuUsage(start)
  return (cpu.user + cpu.system) / 1000
}
function mark(stage) {
  if (!active) return
  const now = performance.now()
  if (active.stage) {
    active.phases.push({
      stage: active.stage,
      wallMs: rounded(now - active.phaseStart),
      processCpuMs: rounded(cpuMs(active.phaseCpu))
    })
  }
  active.stage = stage
  active.phaseStart = now
  active.phaseCpu = process.cpuUsage()
}
function count(name, wallMs = 0, returnedBytes = 0) {
  if (!active) return
  const key = `${active.stage}:${name}`
  const row = (active.calls[key] ||= { calls: 0, inclusiveWallMs: 0, returnedBytes: 0 })
  row.calls++
  row.inclusiveWallMs += wallMs
  row.returnedBytes += returnedBytes
}

// HPACK captures debuglog at import. Change only this local process, before its import.
// formatWithOptions + format follows workerd/src/node/internal/debuglog.ts.
const originalDebuglog = util.debuglog
util.debuglog = function profilingDebuglog(set, callback) {
  if (set.toLowerCase() !== 'stream') return originalDebuglog(set, callback)
  const nodeLogger = originalDebuglog(set)
  function workerdStreamDebug(...values) {
    const start = performance.now()
    let formattedBytes = 0
    if (streamPolicy === 'node') nodeLogger(...values)
    if (streamPolicy === 'workerd-format' || streamPolicy === 'workerd-console') {
      const message = util.formatWithOptions({}, ...values)
      const line = util.format('%s: %s\n', set.toUpperCase(), message)
      formattedBytes = Buffer.byteLength(line)
      if (streamPolicy === 'workerd-console') console.log(line)
    }
    count('stream-debug-' + streamPolicy, performance.now() - start, formattedBytes)
  }
  Object.defineProperty(workerdStreamDebug, 'enabled', {
    get: () => (streamPolicy === 'node' ? nodeLogger.enabled : streamPolicy !== 'off')
  })
  callback?.(workerdStreamDebug)
  return workerdStreamDebug
}
syncBuiltinESMExports()

const { requestKinoboxHttp2 } = await import('../workers/kinobox-search/kinobox-http2-vendored.mjs')
const tlsModule = await import('../workers/kinobox-search/vendor-tls.mjs')
const { webcryptoCrypto } = await import('../workers/kinobox-search/vendor-crypto.mjs')
const { default: hpack } = await import('../workers/kinobox-search/vendor-hpack.mjs')
util.debuglog = originalDebuglog
syncBuiltinESMExports() // HPACK retains its local callback; other imports see Node's logger.

// Count public crypto calls without recording keys, plaintext, or certificate bytes.
// extract() calls importKey()/hmac() via `this`; their inclusive timings overlap.
const instrumentedCrypto = {}
for (const [name, original] of Object.entries(webcryptoCrypto)) {
  instrumentedCrypto[name] = function profiledCryptoCall(...values) {
    const context = active,
      stage = active?.stage,
      start = performance.now()
    const algorithm = typeof values[0] === 'string' ? values[0] : ''
    const record = () => {
      if (active === context && active) {
        const currentStage = active.stage
        active.stage = stage
        count(`crypto.${name}${algorithm ? '.' + algorithm : ''}`, performance.now() - start)
        active.stage = currentStage
      }
    }
    try {
      const result = original.apply(instrumentedCrypto, values)
      if (result && typeof result.then === 'function') return result.finally(record)
      record()
      return result
    } catch (error) {
      record()
      throw error
    }
  }
}
tlsModule.setCryptoImplementation(instrumentedCrypto)
for (const type of ['compressor', 'decompressor']) {
  const create = hpack[type].create
  hpack[type].create = function profiledHpackCreate(...values) {
    if (type === 'compressor' && active?.network && active.stage === 'tls-handshake') {
      mark('http2') // Current onHandshake constructs its request compressor here.
    }
    const start = performance.now()
    const stream = create.apply(this, values)
    count('hpack.' + type + '.create', performance.now() - start)
    for (const name of ['write', 'read', 'execute']) {
      if (typeof stream[name] !== 'function') continue
      const original = stream[name]
      stream[name] = function profiledHpackCall(...parameters) {
        const before = performance.now()
        try {
          return original.apply(this, parameters)
        } finally {
          count('hpack.' + type + '.' + name, performance.now() - before)
        }
      }
    }
    return stream
  }
}
for (const name of ['from', 'concat', 'alloc', 'allocUnsafe']) {
  const original = Buffer[name]
  Buffer[name] = function profiledBufferCall(...values) {
    const start = performance.now()
    const result = original.apply(this, values)
    // Returned bytes are NOT allocation counts: from(ArrayBuffer) can share memory.
    count('Buffer.' + name, performance.now() - start, result.length)
    return result
  }
}

function profileSummary(profile, startUs, endUs) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
  const parents = new Map()
  for (const node of profile.nodes) for (const id of node.children || []) parents.set(id, node.id)
  const categories = {},
    functions = new Map()
  function category(id) {
    const leaf = nodes.get(id).callFrame
    if (leaf.functionName === '(idle)') return 'idle'
    if (leaf.functionName === '(garbage collector)') return 'gc'
    const stack = []
    for (let p = id; p; p = parents.get(p)) stack.push(nodes.get(p).callFrame)
    if (stack.some((f) => f.functionName === 'workerdStreamDebug')) return 'stream-debug'
    if (stack.some((f) => /node:(?:internal\/)?(?:buffer|util\/inspect)/.test(f.url)))
      return 'buffer-or-format'
    if (stack.some((f) => f.url.endsWith('/vendor-hpack.mjs'))) return 'hpack-and-bundled-streams'
    if (stack.some((f) => f.url.endsWith('/vendor-crypto.mjs'))) return 'crypto-wrapper-js'
    if (stack.some((f) => f.url.endsWith('/vendor-tls.mjs'))) return 'tls-js-including-x509'
    if (stack.some((f) => /crypto/.test(f.url))) return 'node-crypto-main-thread'
    return 'other-including-harness'
  }
  let sampleTimeUs = profile.startTime,
    samples = 0
  for (let i = 0; i < (profile.samples || []).length; i++) {
    sampleTimeUs += profile.timeDeltas?.[i] || 0
    // V8's first delta includes Profiler.start overhead. Restrict observations to
    // the measured operation using the same monotonic clock, not that startup.
    if (sampleTimeUs < startUs || sampleTimeUs > endUs) continue
    const id = profile.samples[i],
      f = nodes.get(id).callFrame
    const cat = (categories[category(id)] ||= { samples: 0 })
    cat.samples++
    samples++
    const key = [f.functionName, f.url, f.lineNumber, f.columnNumber].join('|')
    const row = functions.get(key) || {
      function: f.functionName || '(anonymous)',
      file: f.url,
      line: f.lineNumber + 1,
      column: f.columnNumber + 1,
      samples: 0
    }
    row.samples++
    functions.set(key, row)
  }
  return {
    samples,
    excludedOutsideOperation: (profile.samples?.length || 0) - samples,
    requestedIntervalUs: 250,
    categories,
    topSelfSamples: [...functions.values()].sort((a, b) => b.samples - a.samples).slice(0, 12)
  }
}
function describeError(error, depth = 0) {
  if (!(error instanceof Error)) return { message: String(error).slice(0, 500) }
  return {
    name: error.name,
    message: error.message.slice(0, 500),
    code: error.code,
    ...(depth < 2 && error.cause ? { cause: describeError(error.cause, depth + 1) } : {})
  }
}
async function measure(label, operation, { network = false, repetitions = 1, warmups = 0 } = {}) {
  for (let i = 0; i < warmups; i++) await operation()
  await nextTurn() // Drain warmup/import stream callbacks before collecting.
  const inspector = inspectorEnabled ? new Session() : undefined
  const post = (method, parameters = {}) =>
    new Promise((resolve, reject) =>
      inspector.post(method, parameters, (error, value) => (error ? reject(error) : resolve(value)))
    )
  if (inspector) {
    inspector.connect()
    await post('Profiler.enable')
    await post('Profiler.setSamplingInterval', { interval: 250 })
    await post('Profiler.start')
  }
  active = { network, phases: [], calls: {}, tcp: [] }
  mark(network ? 'setup' : 'component')
  const start = performance.now(),
    cpuStart = process.cpuUsage()
  const startUs = Number(process.hrtime.bigint()) / 1000
  const eluStart = performance.eventLoopUtilization()
  let result,
    error,
    completedOperations = 0
  try {
    for (let i = 0; i < repetitions; i++) {
      result = await operation()
      completedOperations++
    }
  } catch (caught) {
    error = describeError(caught)
  }
  await nextTurn() // Include queued readable-stream work, also after a failed request.
  mark('finished')
  const wallMs = performance.now() - start,
    processCpuMs = cpuMs(cpuStart)
  const endUs = Number(process.hrtime.bigint()) / 1000
  const elu = performance.eventLoopUtilization(eluStart)
  const context = active
  active = undefined
  let profile
  if (inspector) {
    try {
      profile = profileSummary((await post('Profiler.stop')).profile, startUs, endUs)
    } finally {
      inspector.disconnect()
    }
  }
  return {
    label,
    repetitions,
    warmups,
    completedOperations,
    wallMs: rounded(wallMs),
    processCpuMs: rounded(processCpuMs),
    ...(error ? {} : { cpuMsPerOperation: rounded(processCpuMs / repetitions) }),
    eventLoopActiveMs: rounded(elu.active),
    eventLoopIdleMs: rounded(elu.idle),
    phases: context.phases,
    calls: Object.fromEntries(
      Object.entries(context.calls).map(([k, v]) => [
        k,
        { ...v, inclusiveWallMs: rounded(v.inclusiveWallMs) }
      ])
    ),
    ...(context.tcp.length ? { tcp: context.tcp } : {}),
    result,
    error,
    profile
  }
}

// Equivalent shape and 5s connect bound to worker.mjs:openTransport. TLS remains
// entirely in the unchanged vendored client over a plaintext Node TCP socket.
async function openTransport(hostname, port) {
  assert.equal(hostname, HOST)
  assert.equal(port, 443)
  mark('tcp-connect')
  const socket = new net.Socket()
  socket.setNoDelay(true)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('TCP connect timeout'))
    }, 5000)
    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    socket.connect(port, hostname, () => {
      clearTimeout(timeout)
      resolve()
    })
  })
  const pair = Duplex.toWeb(socket)
  mark('tls-handshake')
  let closed = false
  return {
    ...pair,
    async close() {
      if (closed) return
      closed = true
      active?.tcp.push({ bytesRead: socket.bytesRead, bytesWritten: socket.bytesWritten })
      socket.destroy()
    }
  }
}
async function readBounded(body) {
  const reader = body.getReader(),
    chunks = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > MAX_BODY) throw new Error('Response exceeds local 1 MiB bound')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks)
  } finally {
    await reader.cancel().catch(() => {})
  }
}
function describeResponse(response, automaticDecompression = false) {
  mark('response-check')
  const headers =
    response.headers instanceof Headers ? Object.fromEntries(response.headers) : response.headers
  const encoding = headers['content-encoding'] || null
  let decoded = response.body
  const opts = { maxOutputLength: MAX_BODY }
  if (!automaticDecompression) {
    if (encoding === 'br') decoded = brotliDecompressSync(decoded, opts)
    else if (encoding === 'gzip') decoded = gunzipSync(decoded, opts)
    else if (encoding === 'deflate') decoded = inflateSync(decoded, opts)
    else if (encoding && encoding !== 'identity') throw new Error('Unsupported content encoding')
  }
  let validJson = false
  try {
    validJson = isKinoboxResponseValid(resource.kind, JSON.parse(decoded.toString('utf8')))
  } catch {}
  return {
    success: response.status === 200 && validJson,
    status: response.status,
    encoding,
    bytesReturned: response.body.length,
    decodedBytes: decoded.length,
    validJson,
    automaticDecompression,
    decodedSha256: createHash('sha256').update(decoded).digest('hex'),
    tls: response.tls
  }
}
async function nativeFetch() {
  mark('native-fetch')
  const response = await fetch(requestUrl, {
    headers: requestHeaders,
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
  return describeResponse(
    { status: response.status, headers: response.headers, body: await readBounded(response.body) },
    true
  )
}
async function nativeHttp2() {
  mark('native-tls-and-connect')
  const response = await new Promise((resolve, reject) => {
    const client = http2.connect(ORIGIN, {
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
      ciphers: 'TLS_AES_128_GCM_SHA256',
      ecdhCurve: 'prime256v1'
    })
    const timeout = setTimeout(() => finish(new Error('Native HTTP/2 timeout')), 15000)
    let ended = false,
      headers,
      length = 0,
      metadata
    const chunks = []
    function finish(error) {
      if (ended) return
      ended = true
      clearTimeout(timeout)
      client.destroy()
      if (error) reject(error)
      else
        resolve({
          status: Number(headers[':status']),
          headers,
          body: Buffer.concat(chunks),
          tls: metadata
        })
    }
    client.on('error', finish)
    client.on('close', () => finish(new Error('Native HTTP/2 session closed before completion')))
    client.on('connect', () => {
      if (ended) return
      mark('http2')
      metadata = {
        version: client.socket.getProtocol(),
        selectedAlpn: client.socket.alpnProtocol,
        cipherSuite: client.socket.getCipher().standardName,
        trust: 'Node default roots'
      }
      if (metadata.selectedAlpn !== 'h2') finish(new Error('Native TLS did not negotiate h2'))
    })
    const stream = client.request({
      ':method': 'GET',
      ':path': requestUrl.pathname + requestUrl.search,
      ':scheme': 'https',
      ':authority': HOST,
      ...requestHeaders
    })
    stream.on('response', (value) => {
      headers = value
    })
    stream.on('error', finish)
    stream.on('data', (chunk) => {
      length += chunk.length
      if (length > MAX_BODY) return finish(new Error('Response exceeds local 1 MiB bound'))
      chunks.push(Buffer.from(chunk))
    })
    stream.on('end', () => finish(headers ? undefined : new Error('Missing response headers')))
    stream.end()
  })
  return describeResponse(response)
}
async function offline() {
  const rows = []
  const component = (label, operation, repetitions = iterations) =>
    measure(label, operation, { repetitions, warmups: Math.min(repetitions, 30) })
  const responseCompressor = hpack.compressor.create({ table: { size: 4096 } })
  responseCompressor.write([
    { name: ':status', value: '200' },
    { name: 'content-type', value: 'application/json' },
    { name: 'cache-control', value: 'public, max-age=600' }
  ])
  const block = responseCompressor.read()
  responseCompressor.destroy()
  const savedPolicy = streamPolicy
  for (const policy of ['off', 'workerd-format']) {
    streamPolicy = policy
    rows.push(
      await component('hpack-request-response-' + policy, () => {
        const comp = hpack.compressor.create({ table: { size: 4096 } })
        comp.write([
          { name: ':method', value: 'GET' },
          { name: ':scheme', value: 'https' },
          { name: ':authority', value: HOST },
          { name: ':path', value: requestUrl.pathname + requestUrl.search },
          ...Object.entries(requestHeaders).map(([name, value]) => ({ name, value }))
        ])
        assert.ok(comp.read().length)
        const decomp = hpack.decompressor.create({ table: { maxSize: 4096 } })
        decomp.write(block)
        decomp.execute()
        assert.equal(decomp.read().value, '200')
        while (decomp.read()) {
          /* Drain */
        }
        comp.destroy()
        decomp.destroy()
      })
    )
  }
  streamPolicy = savedPolicy
  const peer = await instrumentedCrypto.generateKeyPair('P-256')
  rows.push(
    await component(
      'crypto-p256-keygen-and-shared-secret',
      async () => {
        const pair = await instrumentedCrypto.generateKeyPair('P-256')
        assert.equal(
          (await instrumentedCrypto.calculateSharedSecret('P-256', pair.privKey, peer.pubKey))
            .length,
          32
        )
      },
      Math.min(iterations, 100)
    )
  )
  rows.push(
    await component(
      'tls13-handshake-and-application-key-schedules',
      async () => {
        const hs = await tlsModule.computeSharedKeys({
          masterSecret: new Uint8Array(32),
          hellos: [new Uint8Array(256), new Uint8Array(128)],
          cipherSuite: 'TLS_AES_128_GCM_SHA256',
          secretType: 'hs'
        })
        const ap = await tlsModule.computeSharedKeys({
          masterSecret: hs.masterSecret,
          hellos: [new Uint8Array(256), new Uint8Array(128), new Uint8Array(2048)],
          cipherSuite: 'TLS_AES_128_GCM_SHA256',
          secretType: 'ap'
        })
        assert.equal(ap.serverIv.length, 12)
      },
      Math.min(iterations, 50)
    )
  )
  rows.push(
    await component(
      'x509-parse-two-bundled-isrg-roots',
      () => {
        for (const pem of tlsModule.MOZILLA_ROOT_CA_LIST)
          assert.ok(tlsModule.loadX509FromPem(pem).isWithinValidity())
      },
      Math.min(iterations, 50)
    )
  )
  const key = await instrumentedCrypto.importKey('AES-128-GCM', new Uint8Array(16))
  let nonce = 0
  rows.push(
    await component('crypto-aes128gcm-16k-roundtrip', async () => {
      const iv = new Uint8Array(12)
      new DataView(iv.buffer).setUint32(8, nonce++)
      const opts = { key, iv, aead: new Uint8Array(5), data: new Uint8Array(16384) }
      const encrypted = await instrumentedCrypto.authenticatedEncrypt('AES-128-GCM', opts)
      const decrypted = await instrumentedCrypto.authenticatedDecrypt('AES-128-GCM', {
        ...opts,
        data: encrypted.ciphertext,
        authTag: encrypted.authTag
      })
      assert.equal(decrypted.plaintext.length, opts.data.length)
    })
  )
  const chunk = Buffer.alloc(16384, 1)
  rows.push(
    await component('buffer-accumulate-and-final-copy-64k', () => {
      let incoming = Buffer.alloc(0)
      for (let i = 0; i < 4; i++) incoming = Buffer.concat([incoming, Buffer.from(chunk)])
      return Buffer.concat([incoming]).length
    })
  )
  rows.push(
    await component('tls-eager-noop-trace-hex-16k', () => {
      const quiet = { trace() {} }
      quiet.trace({ data: tlsModule.toHexStringWithWhitespace(chunk) }, 'writing enc packet')
    })
  )
  return rows
}

const rows = []
if (mode === 'offline') rows.push(...(await offline()))
else {
  const modes = mode === 'compare' ? ['vendored', 'native-http2', 'fetch'] : [mode]
  for (let i = 0; i < requests; i++) {
    for (const transport of modes) {
      if (rows.length) await delay(750)
      rows.push(
        await measure(
          `${transport}-${i + 1}`,
          async () => {
            if (transport === 'fetch') return nativeFetch()
            if (transport === 'native-http2') return nativeHttp2()
            return describeResponse(
              await requestKinoboxHttp2(resource, openTransport, { timeoutMs: 15000 })
            )
          },
          { network: true }
        )
      )
    }
  }
}
console.log(
  JSON.stringify(
    {
      localOnly: true,
      runtime: process.version,
      platform: process.platform,
      arch: process.arch,
      mode,
      resource: { path: resource.path, params: resource.params },
      streamPolicy,
      networkRequestsAttempted: mode === 'offline' ? 0 : rows.length,
      caveats: [
        'Node results do not establish Cloudflare Worker edge behavior or CPU.',
        'Each vendored/native-http2 request uses a fresh connection; native fetch may pool connections.',
        'Native transports use Node default trust roots; vendored client uses its unchanged restricted trust.',
        'Node fetch automatically decompresses; bytesReturned is not a wire-size comparison.',
        'Process CPU includes background/native threads, has coarse Windows resolution; V8 inspector excludes off-thread crypto.',
        'Inspector sample timestamps are clipped to the operation; sample counts are not CPU milliseconds.',
        'Offline rows exclude their stated warmups; vendored/native-http2 network rows include a fresh handshake.',
        'Offline components are illustrative, not additive estimates for a real request; JIT/GC/order still affect comparisons.',
        '250us sampling and call/Buffer wrappers add overhead; asynchronous inclusive times overlap.',
        'workerd-format emulates formatting, excludes actual console ingestion; off still counts log calls.',
        'Only requested public API operations are counted; unchanged vendor AIA fallback may also fetch an allowed issuer.',
        'No raw CPU profile or response body is written. Sample categories are stack heuristics.',
        'TLS/HTTP2 phase boundary is inferred from request compressor creation inside onHandshake.',
        'Native Cloudflare sockets have no documented ALPN configuration; Node native HTTP/2 is not a drop-in proof.'
      ],
      rows
    },
    null,
    2
  )
)
if (rows.some((row) => row.error || (mode !== 'offline' && !row.result?.success)))
  process.exitCode = 1
