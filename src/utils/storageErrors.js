export const STORAGE_ERROR_EVENT = 'reyohoho-storage-error'
let lastReport = 0

// Local writes fail when the quota is full or storage is blocked. Say so once a
// minute instead of losing the change silently.
export function reportStorageFailure(scope) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastReport < 60000) return
  lastReport = now
  window.dispatchEvent(new window.CustomEvent(STORAGE_ERROR_EVENT, { detail: { scope } }))
}
