import { getContentCacheUrl, isContentResponseValid } from './routes.mjs'
import { cacheMatch, cachePut, logPublicCache } from './public-cache.mjs'

const STALE_TTL = 48 * 3600
const RETRY_TTL = 30
const DEADLINE_MS = 15000
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

// Search and movie cards. `requestUpstream(options, { timeoutMs })` resolves to
// `{ status, body, source }` with `body` as JSON text.
export async function serveContent(
  resource,
  url,
  headers,
  cache,
  requestUpstream,
  budget = async () => null
) {
  const started = Date.now()
  const key = getContentCacheUrl(url.origin, resource, headers['X-Worker-Version'])
  const staleKey = key.replace('/__content-cache?', '/__content-stale?')
  const retryKey = key.replace('/__content-cache?', '/__content-retry?')
  const respond = (body, status, state, retry = false, entry, source) => {
    logPublicCache(resource.kind, state, started, status)
    const cachedSource = entry?.headers?.get?.('X-Data-Source')
    return new Response(body, {
      status,
      headers: {
        ...headers,
        ...(entry ? { 'X-Data-Source': cachedSource || 'unknown' } : {}),
        ...(source ? { 'X-Data-Source': source } : {}),
        'X-Search-Cache': state,
        ...(retry ? { 'Retry-After': String(RETRY_TTL) } : {})
      }
    })
  }
  const unavailable = () =>
    respond(JSON.stringify({ error: 'Upstream temporarily unavailable' }), 503, 'BACKOFF', true)
  const cached = await cacheMatch(cache, key)
  if (cached) return respond(cached.body, 200, 'HIT', false, cached)
  const retry = await cacheMatch(cache, retryKey)
  if (retry && (await retry.text()) === 'invalid') return unavailable()
  const stale = resource.kind === 'movie' ? await cacheMatch(cache, staleKey) : undefined
  if (retry) return stale ? respond(stale.body, 200, 'STALE', false, stale) : unavailable()
  // Wait with this request's own I/O, rather than sharing another request's promise.
  for (let attempt = 0; busy(key) && attempt < 20; attempt++) {
    if (stale) return respond(stale.body, 200, 'STALE', false, stale)
    await sleep(500)
    const filled = await cacheMatch(cache, key)
    if (filled) return respond(filled.body, 200, 'HIT', false, filled)
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
      ? respond(fallback.body, 200, 'STALE', false, fallback)
      : respond(JSON.stringify({ error }), status, 'MISS', true)
  }
  try {
    const rejected = await budget()
    if (rejected) {
      const fallback = await currentStale()
      return fallback ? respond(fallback.body, 200, 'STALE', false, fallback) : rejected
    }
    const response = await requestUpstream(
      { path: resource.path, params: resource.params },
      { timeoutMs: DEADLINE_MS }
    )
    const source = response.source || 'kinopoisk'
    console.log(
      JSON.stringify({
        event: 'content_response',
        kind: resource.kind,
        status: response.status,
        source,
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
    const body = response.body
    let data
    try {
      data = JSON.parse(body)
    } catch {
      return await invalid('Invalid upstream JSON')
    }
    if (resource.kind === 'movie' && data?.data?.isSuccess === false) {
      await discardStale()
      return respond(body, 404, 'MISS')
    }
    if (!isContentResponseValid(resource.kind, data)) {
      return await invalid('Unexpected upstream schema')
    }
    // Finish the cache write before releasing the lease to avoid another cold miss.
    if (ownsLease())
      await Promise.all([
        cachePut(cache, key, body, resource.cacheTtl, source),
        ...(resource.kind === 'movie' ? [cachePut(cache, staleKey, body, STALE_TTL, source)] : [])
      ])
    return respond(body, 200, 'MISS', false, undefined, source)
  } catch (error) {
    // Kinopoisk errors carry an upstream status: throttling and 5xx back off
    // like a transient failure, anything else is a definitive answer.
    const status = error?.upstreamStatus
    const timeout = error?.reason === 'timeout' || /timeout/i.test(error?.message || '')
    console.error(
      JSON.stringify({
        event: 'content_error',
        kind: resource.kind,
        reason: timeout ? 'timeout' : error?.reason || 'connection',
        upstreamStatus: status,
        durationMs: Date.now() - started
      })
    )
    if (status && status !== 429 && status < 500) {
      if (status === 404) await discardStale()
      return respond(
        JSON.stringify({ error: 'Upstream HTTP error', upstreamStatus: status }),
        status === 404 ? 404 : 502,
        'MISS'
      )
    }
    return await transient(
      timeout ? 'Upstream timeout' : 'Upstream connection failed',
      timeout ? 504 : 502
    )
  } finally {
    if (leases.get(key) === lease) leases.delete(key)
  }
}
