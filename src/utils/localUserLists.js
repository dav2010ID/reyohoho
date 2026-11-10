const STORAGE_KEY = 'reyohoho-user-lists'

const storageKey = (owner) =>
  owner === 'guest' ? STORAGE_KEY : `${STORAGE_KEY}:${encodeURIComponent(owner)}`
const writeList = (type, items, owner = 'guest') => {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(storageKey(owner) + ':' + type, JSON.stringify(items))
    return true
  } catch { return false }
}
const readList = (type, owner = 'guest') => {
  if (typeof window === 'undefined') return []
  let items = []
  try {
    const key = storageKey(owner)
    const current = localStorage.getItem(key + ':' + type)
    if (current !== null) {
      const parsed = JSON.parse(current)
      return Array.isArray(parsed) ? parsed : []
    }
    const legacy = JSON.parse(localStorage.getItem(key)) || {}
    items = Array.isArray(legacy[type]) ? legacy[type] : []
    if (writeList(type, items, owner)) {
      delete legacy[type]
      if (Object.keys(legacy).length) localStorage.setItem(key, JSON.stringify(legacy))
      else localStorage.removeItem(key)
    }
  } catch { /* Keep the recovered items if removing the old copy fails. */ }
  return items
}

const normalizeItem = (id, metadata = {}) => ({
  ...metadata,
  id: String(id),
  kp_id: String(id),
  title: metadata?.title || metadata?.name_ru || metadata?.name_original || '',
  poster: metadata?.poster || metadata?.poster_url_preview || metadata?.poster_url || ''
})

export const getLocalList = (type, owner = 'guest') => readList(type, owner)
export const replaceLocalList = (type, items, owner = 'guest') => writeList(type, items || [], owner)
export const addLocalListItem = (type, id, metadata = {}, owner = 'guest') =>
  writeList(type, [normalizeItem(id, metadata), ...readList(type, owner).filter(item => String(item.kp_id) !== String(id))], owner)
export const removeLocalListItem = (type, id, owner = 'guest') =>
  writeList(type, readList(type, owner).filter(item => String(item.kp_id) !== String(id)), owner)
export const clearLocalList = (type, owner = 'guest') => writeList(type, [], owner)
