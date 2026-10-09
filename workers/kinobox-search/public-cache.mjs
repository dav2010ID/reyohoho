// Only validated public provider payloads may enter this cache. No request headers,
// credentials, searches or identifiers are included in cache telemetry.
export function logPublicCache(kind, state, started, status = 200) {
  console.log(
    JSON.stringify({
      event: 'public_cache',
      kind,
      cache: state,
      status,
      durationMs: Date.now() - started
    })
  )
}

export async function cacheMatch(cache, key) {
  try {
    return await cache.match(key)
  } catch {
    console.error(JSON.stringify({ event: 'public_cache_error', operation: 'match' }))
    return undefined
  }
}

export async function cachePut(cache, key, body, ttl) {
  try {
    await cache.put(
      key,
      new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${ttl}`
        }
      })
    )
  } catch {
    console.error(JSON.stringify({ event: 'public_cache_error', operation: 'put' }))
  }
}
