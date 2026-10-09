// Session-memory cache for public provider JSON only. Never use for account APIs.
// Clone payloads so list flags and UI mutations cannot contaminate other callers.
export function createPublicDataCache({
  maxEntries = 120,
  maxBytes = 4 * 1024 * 1024,
  now = Date.now
} = {}) {
  const values = new Map()
  const pending = new Map()
  let bytes = 0
  const remove = (key) => {
    bytes -= values.get(key)?.size || 0
    values.delete(key)
  }
  return async function get(
    key,
    load,
    ttl,
    { signal, validate = () => true, bypass = false } = {}
  ) {
    if (signal?.aborted) throw Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' })
    if (bypass) return load()
    for (const [entryKey, entry] of values) {
      if (entry.expires <= now()) remove(entryKey)
    }
    const hit = values.get(key)
    if (hit) {
      values.delete(key)
      values.set(key, hit)
      return JSON.parse(hit.json)
    }
    // A caller-owned AbortSignal must not cancel another caller's transport.
    // Signalled requests retain their own transport; settled data is still shared.
    if (!signal && pending.has(key)) return JSON.parse(await pending.get(key))
    const promise = (async () => {
      const data = await load()
      const json = JSON.stringify(data)
      const size = json.length * 2
      if (!signal?.aborted && validate(data) && size <= maxBytes) {
        remove(key)
        while (values.size >= maxEntries || bytes + size > maxBytes)
          remove(values.keys().next().value)
        values.set(key, { json, size, expires: now() + ttl })
        bytes += size
      }
      return json
    })()
    // Bound pending tracking too; excess distinct calls remain uncached in-flight.
    if (!signal && pending.size < maxEntries) pending.set(key, promise)
    try {
      return JSON.parse(await promise)
    } finally {
      if (pending.get(key) === promise) pending.delete(key)
    }
  }
}
