const STORAGE_KEY = 'reyohoho-user-lists'

const emptyLists = () => ({
  favorite: [],
  later: [],
  watching: [],
  completed: [],
  abandoned: [],
  history: []
})

const readLists = () => {
  if (typeof window === 'undefined') return emptyLists()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    return Object.fromEntries(
      Object.keys(emptyLists()).map((type) => [type, Array.isArray(parsed[type]) ? parsed[type] : []])
    )
  } catch {
    return emptyLists()
  }
}

const writeLists = (lists) => {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
    return true
  } catch {
    return false
  }
}

const normalizeItem = (id, metadata = {}) => ({
  ...metadata,
  id: String(id),
  kp_id: String(id),
  title: metadata?.title || metadata?.name_ru || metadata?.name_original || '',
  poster: metadata?.poster || metadata?.poster_url_preview || metadata?.poster_url || ''
})

export const getLocalList = (type) => readLists()[type] || []

export const replaceLocalList = (type, items) => {
  const lists = readLists()
  lists[type] = (items || []).map((item) =>
    normalizeItem(item?.kp_id || item?.kinopoisk_id || item?.id, item)
  )
  writeLists(lists)
}

export const addLocalListItem = (type, id, metadata = {}) => {
  const lists = readLists()
  const item = normalizeItem(id, metadata || {})
  lists[type] = [item, ...(lists[type] || []).filter((entry) => String(entry.kp_id) !== String(id))]
  writeLists(lists)
}

export const removeLocalListItem = (type, id) => {
  const lists = readLists()
  lists[type] = (lists[type] || []).filter((entry) => String(entry.kp_id) !== String(id))
  writeLists(lists)
}

export const clearLocalList = (type) => {
  const lists = readLists()
  lists[type] = []
  writeLists(lists)
}
