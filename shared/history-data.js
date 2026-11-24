// One history capacity everywhere: guest storage, the old-origin bridge, files
// and the D1 quota (`history_quota`). Lists have their own 1000-item limit.
export const HISTORY_CAPACITY = 5000
export const MAX_HISTORY_ITEMS = HISTORY_CAPACITY
// Keys that may hold guest history, oldest format first. The current guest key
// is a bare array written by src/utils/localUserLists.js.
const LEGACY_HISTORY_KEYS = [
  'main',
  'reyohoho.store',
  'vuex_backup',
  'reyohoho-user-lists',
  'reyohoho-user-lists:history'
]

export class HistoryCapacityError extends Error {
  constructor(total, capacity = HISTORY_CAPACITY) {
    super(
      `История содержит ${total} записей, а лимит — ${capacity}. ` +
        `Удалите не меньше ${total - capacity} записей и повторите.`
    )
    this.name = 'HistoryCapacityError'
    this.code = 'history_capacity'
    this.total = total
    this.capacity = capacity
  }
}

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

export function normalizeHistory(items, maxItems = MAX_HISTORY_ITEMS) {
  if (!Array.isArray(items) || items.length > maxItems) {
    throw new Error(`История должна содержать не более ${maxItems} записей`)
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

export function readLegacyHistory(storage, capacity = HISTORY_CAPACITY) {
  const all = []
  // Whitelist history fields only. Never read the persisted auth store.
  for (const key of LEGACY_HISTORY_KEYS) {
    try {
      const data = JSON.parse(storage.getItem(key) || 'null')
      const history = Array.isArray(data) ? data : data?.history || data?.main?.history
      if (Array.isArray(history)) all.push(...normalizeHistory(history.slice(0, capacity), capacity))
    } catch {
      /* An invalid legacy store must not prevent importing another format. */
    }
  }
  // Same title in several formats: keep the newest viewing.
  return normalizeHistory(all, all.length).slice(0, capacity)
}

export function mergeHistory(current, imported, capacity = HISTORY_CAPACITY) {
  const existing = normalizeHistory(current, Math.max(capacity, current?.length || 0))
  const ids = new Set(existing.map((item) => item.kp_id))
  const missing = normalizeHistory(imported, Math.max(capacity, imported?.length || 0)).filter(
    (item) => !ids.has(item.kp_id)
  )
  // Never drop entries silently: the caller reports how many must go first.
  const total = existing.length + missing.length
  if (total > capacity) throw new HistoryCapacityError(total, capacity)
  return normalizeHistory([...existing, ...missing], capacity)
}
