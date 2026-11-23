import { HISTORY_CAPACITY } from '../../shared/history-data.js'
import { reportStorageFailure } from './storageErrors'

// Durable queue of history writes that the server has not acknowledged yet.
// It is scoped by account owner, keeps only the latest operation per title and
// is replayed on top of every server snapshot, so a refresh can never erase a
// viewing that failed to upload (offline, timeout, 5xx, rate limit).
const key = (owner) => `reyohoho-history-outbox:${encodeURIComponent(owner)}`

const read = (owner) => {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key(owner)) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((entry) => /^[1-9]\d{0,11}$/.test(entry?.kpId) && ['add', 'del'].includes(entry.op))
      : []
  } catch {
    return []
  }
}
const write = (owner, entries) => {
  if (typeof localStorage === 'undefined') return false
  try {
    if (entries.length) localStorage.setItem(key(owner), JSON.stringify(entries))
    else localStorage.removeItem(key(owner))
    return true
  } catch {
    reportStorageFailure('history-outbox')
    return false
  }
}

let sequence = 0
export function enqueueHistoryWrite(owner, op, kpId, metadata = null) {
  const entry = {
    op,
    kpId: String(kpId),
    at: new Date().toISOString(),
    seq: `${Date.now()}-${sequence++}`,
    ...(op === 'add' && metadata ? { metadata } : {})
  }
  const entries = [entry, ...read(owner).filter((item) => item.kpId !== entry.kpId)]
  write(owner, entries.slice(0, HISTORY_CAPACITY))
  return entry
}

// Remove an entry only if a newer operation for the same title did not replace it.
export function ackHistoryWrite(owner, entry) {
  const entries = read(owner)
  const next = entries.filter((item) => !(item.kpId === entry.kpId && item.seq === entry.seq))
  if (next.length !== entries.length) write(owner, next)
}

export const pendingHistoryWrites = (owner) => read(owner)
export const clearHistoryOutbox = (owner) => write(owner, [])

// Server snapshot + unacknowledged local operations = what the user expects to see.
export function applyHistoryOutbox(owner, items) {
  const entries = read(owner)
  if (!entries.length) return items
  const touched = new Set(entries.map((entry) => entry.kpId))
  const added = entries
    .filter((entry) => entry.op === 'add')
    .map((entry) => {
      const server = items.find((item) => String(item.kp_id) === entry.kpId)
      return { ...server, ...entry.metadata, kp_id: entry.kpId, addedAt: entry.at }
    })
  return [...added, ...items.filter((item) => !touched.has(String(item.kp_id)))].sort((a, b) =>
    String(b.addedAt || '').localeCompare(String(a.addedAt || ''))
  )
}

// 4xx other than timeouts, rate limits and auth can never succeed on retry.
export const isPermanentFailure = (error) => {
  const status = error?.response?.status
  return status >= 400 && status < 500 && ![401, 403, 408, 425, 429].includes(status)
}
