import { getKinoboxCacheUrl, isKinoboxResponseValid } from './routes.mjs'
import { cacheMatch, cachePut, logPublicCache } from './public-cache.mjs'

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

export async function serveKinoboxContent(resource, url, headers, cache, requestUpstream) {
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
  const stale = resource.kind === 'movie' ? await cacheMatch(cache, staleKey) : undefined
  if (await cacheMatch(cache, retryKey)) {
    return stale ? respond(stale.body, 200, 'STALE') : unavailable()
  }
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
  const transient = async (error, status) => {
    await cachePut(cache, retryKey, '{}', RETRY_TTL)
    return stale
      ? respond(stale.body, 200, 'STALE')
      : respond(JSON.stringify({ error }), status, 'MISS', true)
  }
  try {
    const response = await requestUpstream({
      path: resource.path,
      params: {
        ...resource.params,
        ...(resource.kind !== 'players' ? { ts: Math.floor(Date.now() / 1000) } : {})
      }
    })
    console.log(
      JSON.stringify({
        event: 'kinobox_response',
        kind: resource.kind,
        status: response.status,
        protocol: response.tls.selectedAlpn,
        tls: response.tls.version,
        durationMs: Date.now() - started
      })
    )
    if (response.status === 429 || response.status >= 500)
      return await transient('Upstream temporarily unavailable', 502)
    if (response.status !== 200)
      return respond(
        JSON.stringify({
          error: 'Upstream HTTP error',
          upstreamStatus: response.status
        }),
        response.status === 404 ? 404 : 502,
        'MISS'
      )
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')
      return respond(JSON.stringify({ error: 'Unexpected upstream encoding' }), 502, 'MISS')
    let data
    try {
      data = JSON.parse(response.body.toString('utf8'))
    } catch {
      return respond(JSON.stringify({ error: 'Invalid upstream JSON' }), 502, 'MISS')
    }
    if (resource.kind === 'movie' && data?.data?.isSuccess === false)
      return respond(JSON.stringify(data), 404, 'MISS')
    if (!isKinoboxResponseValid(resource.kind, data))
      return respond(JSON.stringify({ error: 'Unexpected upstream schema' }), 502, 'MISS')
    const body = JSON.stringify(data)
    // Finish the cache write before releasing the lease to avoid another cold miss.
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
