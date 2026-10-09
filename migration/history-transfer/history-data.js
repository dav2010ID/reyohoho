export const MAX_HISTORY_ITEMS = 1000

export function cardRatings(item) {
  const result = {}
  const aliases = {
    rating_kp: item?.rating_kp ?? item?.rating_kinopoisk ?? item?.raw_data?.rating,
    rating_imdb: item?.rating_imdb ?? item?.raw_data?.rating_imdb,
    rating: item?.rating ?? item?.average_rating
  }
  for (const [key, value] of Object.entries(aliases)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const number = Number(String(value).replace(',', '.'))
    if (Number.isFinite(number) && number > 0 && number <= 10) result[key] = number
  }
  if (item?.ratings_checked === 1) result.ratings_checked = 1
  return result
}

export function normalizeHistory(items) {
  if (!Array.isArray(items) || items.length > MAX_HISTORY_ITEMS) {
    throw new Error('История должна содержать не более 1000 записей')
  }
  const result = new Map()
  for (const item of items) {
    const id = String(item?.kp_id ?? item?.id ?? '')
    if (!/^[1-9]\d{0,11}$/.test(id)) continue
    const text = (value, limit) => (typeof value === 'string' ? value.slice(0, limit) : '')
    const poster = text(item.poster || item.poster_url_preview || item.poster_url, 2048)
    const date = Date.parse(item.addedAt)
    const normalized = {
      kp_id: id,
      title: text(item.title || item.name_ru || item.name_original, 300),
      slug: text(item.slug, 300),
      year: text(String(item.year || ''), 20),
      type: text(item.type, 40),
      poster: /^https:\/\//i.test(poster) ? poster : '',
      ...cardRatings(item),
      addedAt: Number.isFinite(date) ? new Date(date).toISOString() : '1970-01-01T00:00:00.000Z'
    }
    const previous = result.get(id)
    if (!previous || normalized.addedAt > previous.addedAt) result.set(id, normalized)
  }
  return [...result.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export function readLegacyHistory(storage) {
  const all = []
  // Whitelist history fields only. Never read the persisted auth store.
  for (const key of ['main', 'reyohoho.store', 'vuex_backup', 'reyohoho-user-lists']) {
    try {
      const data = JSON.parse(storage.getItem(key) || 'null')
      const history = data?.history || data?.main?.history
      if (Array.isArray(history)) all.push(...normalizeHistory(history.slice(0, MAX_HISTORY_ITEMS)))
    } catch {
      /* An invalid legacy store must not prevent importing another format. */
    }
  }
  const unique = new Map()
  for (const item of all) if (!unique.has(item.kp_id)) unique.set(item.kp_id, item)
  return normalizeHistory([...unique.values()].slice(0, MAX_HISTORY_ITEMS))
}

export function mergeHistory(current, imported) {
  const existing = normalizeHistory(current)
  const ids = new Set(existing.map((item) => item.kp_id))
  const missing = normalizeHistory(imported).filter((item) => !ids.has(item.kp_id))
  // Preserve every current entry even when the combined history reaches the limit.
  return normalizeHistory([...existing, ...missing].slice(0, MAX_HISTORY_ITEMS))
}
