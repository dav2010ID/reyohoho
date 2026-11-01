import { getKinoboxCacheUrl, isKinoboxResponseValid } from './routes.mjs'
import { cacheMatch, cachePut, logPublicCache } from './public-cache.mjs'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'

const MAX_DECODED_BODY = 1024 * 1024

const STALE_TTL = 48 * 3600
const RETRY_TTL = 30
// Primitive leases only, never cross-request promises/sockets. This collapses
// bursts within an isolate; Cache API is local, not a global distributed lock.
const leases = new Map()
const busy = (key) => {
  const expires = leases.get(key)
  if (expires && expires > Date.now()) return true
  leases.delete(key)
  return false
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function serveKinoboxContent(
  resource,
  url,
  headers,
  cache,
  requestUpstream,
  budget = async () => null
) {
  const started = Date.now()
  const key = getKinoboxCacheUrl(url.origin, resource, headers['X-Worker-Version'])
  const staleKey = key.replace('/__kinobox-cache?', '/__kinobox-stale?')
  const retryKey = key.replace('/__kinobox-cache?', '/__kinobox-retry?')
  const respond = (body, status, state, retry = false) => {
    logPublicCache(resource.kind, state, started, status)
    return new Response(body, {
      status,
      headers: {
        ...headers,
        'X-Search-Cache': state,
        'X-Kinobox-Cache': state,
        ...(retry ? { 'Retry-After': String(RETRY_TTL) } : {})
      }
    })
  }
  const unavailable = () =>
    respond(JSON.stringify({ error: 'Upstream temporarily unavailable' }), 503, 'BACKOFF', true)
  const cached = await cacheMatch(cache, key)
  if (cached) return respond(cached.body, 200, 'HIT')
  const retry = await cacheMatch(cache, retryKey)
  if (retry && (await retry.text()) === 'invalid') return unavailable()
  const stale = resource.kind === 'movie' ? await cacheMatch(cache, staleKey) : undefined
  if (retry) return stale ? respond(stale.body, 200, 'STALE') : unavailable()
  // Wait with this request's own I/O, rather than sharing another request's promise.
  for (let attempt = 0; busy(key) && attempt < 20; attempt++) {
    if (stale) return respond(stale.body, 200, 'STALE')
    await sleep(500)
    const filled = await cacheMatch(cache, key)
    if (filled) return respond(filled.body, 200, 'HIT')
    if (await cacheMatch(cache, retryKey)) return unavailable()
  }
  for (const existing of leases.keys()) busy(existing)
  if (busy(key) || leases.size >= 256) return unavailable()
  const lease = Date.now() + 20000
  leases.set(key, lease)
  const ownsLease = () => leases.get(key) === lease && lease > Date.now()
  const discardStale = async () => {
    if (resource.kind !== 'movie' || !ownsLease()) return
    try {
      await cache.delete(staleKey)
    } catch {
      console.error(JSON.stringify({ event: 'public_cache_error', operation: 'delete' }))
    }
  }
  const invalid = async (error) => {
    await discardStale()
    if (ownsLease()) await cachePut(cache, retryKey, 'invalid', RETRY_TTL)
    return respond(JSON.stringify({ error }), 502, 'MISS', true)
  }
  // A snapshot may expire or be invalidated while this request waits upstream.
  const currentStale = () => (stale ? cacheMatch(cache, staleKey) : undefined)
  const transient = async (error, status) => {
    if (ownsLease()) await cachePut(cache, retryKey, '{}', RETRY_TTL)
    const fallback = await currentStale()
    return fallback
      ? respond(fallback.body, 200, 'STALE')
      : respond(JSON.stringify({ error }), status, 'MISS', true)
  }
  try {
    const rejected = await budget()
    if (rejected) {
      const fallback = await currentStale()
      return fallback ? respond(fallback.body, 200, 'STALE') : rejected
    }
    const deadline = Date.now() + 15000
    const load = () =>
      requestUpstream(
        {
          path: resource.path,
          params: { ...resource.params, ts: Math.floor(Date.now() / 1000) }
        },
        { timeoutMs: Math.max(1, deadline - Date.now()) }
      )
    let response
    try {
      response = await load()
    } catch (error) {
      // Retry only the observed transient stream reset, once, within the same deadline.
      if (error.message !== 'HTTP/2 RST_STREAM: 1' || deadline - Date.now() < 1000) throw error
      await sleep(250)
      const retryRejected = await budget()
      if (retryRejected) {
        const fallback = await currentStale()
        return fallback ? respond(fallback.body, 200, 'STALE') : retryRejected
      }
      if (deadline - Date.now() < 750) throw error
      console.log(
        JSON.stringify({ event: 'kinobox_retry', kind: resource.kind, reason: 'rst_stream_1' })
      )
      response = await load()
    }
    console.log(
      JSON.stringify({
        event: 'kinobox_response',
        kind: resource.kind,
        status: response.status,
        source: response.source || 'kinobox',
        protocol: response.tls?.selectedAlpn,
        tls: response.tls?.version,
        durationMs: Date.now() - started
      })
    )
    if (response.status === 429 || response.status >= 500)
      return await transient('Upstream temporarily unavailable', 502)
    if (response.status !== 200) {
      if (response.status === 404) await discardStale()
      return respond(
        JSON.stringify({
          error: 'Upstream HTTP error',
          upstreamStatus: response.status
        }),
        response.status === 404 ? 404 : 502,
        'MISS'
      )
    }
    const encoding = response.headers['content-encoding'] || 'identity'
    const decompress = new Map([
      ['gzip', gunzipSync],
      ['deflate', inflateSync],
      ['br', brotliDecompressSync]
    ]).get(encoding)
    if (encoding !== 'identity' && typeof decompress !== 'function') {
      return await invalid('Unexpected upstream encoding')
    }
    let body
    let data
    try {
      const decoded = decompress
        ? decompress(response.body, { maxOutputLength: MAX_DECODED_BODY })
        : response.body
      if (decoded.length > MAX_DECODED_BODY) throw new Error('Decoded body too large')
      body = decoded.toString('utf8')
      data = JSON.parse(body)
    } catch {
      return await invalid('Invalid upstream JSON')
    }
    if (resource.kind === 'movie' && data?.data?.isSuccess === false) {
      await discardStale()
      return respond(body, 404, 'MISS')
    }
    if (!isKinoboxResponseValid(resource.kind, data)) {
      return await invalid('Unexpected upstream schema')
    }
    // Finish the cache write before releasing the lease to avoid another cold miss.
    if (ownsLease())
      await Promise.all([
        cachePut(cache, key, body, resource.cacheTtl),
        ...(resource.kind === 'movie' ? [cachePut(cache, staleKey, body, STALE_TTL)] : [])
      ])
    return respond(body, 200, 'MISS')
  } catch (error) {
    const timeout = /timeout/i.test(error.message)
    console.error(
      JSON.stringify({
        event: 'kinobox_error',
        kind: resource.kind,
        reason: timeout ? 'timeout' : 'connection',
        transportCode: new RegExp('^HTTP/2 RST_STREAM: [0-9]+$').test(error.message)
          ? error.message
          : undefined,
        durationMs: Date.now() - started
      })
    )
    return await transient(
      timeout ? 'Upstream timeout' : 'Upstream connection failed',
      timeout ? 504 : 502
    )
  } finally {
    if (leases.get(key) === lease) leases.delete(key)
  }
}
