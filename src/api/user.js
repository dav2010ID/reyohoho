import { reactive } from 'vue'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { getCloudHistory, historyRequest, isCloudHistoryEnabled } from './cloudHistory'
import { normalizeHistory } from '../../shared/history-data.js'
import { useAuthStore } from '@/store/auth'
import { workerAccountAdapter, workerAccountRequest, workerAuthEnabled } from './workerAccount'
import { enrichListMetadata } from './listMetadata'
import {
  addLocalListItem,
  clearLocalList,
  getLocalList,
  removeLocalListItem,
  replaceLocalList
} from '@/utils/localUserLists'
import { chunkByBytes } from '@/utils/importBatches'
import {
  ackHistoryWrite,
  applyHistoryOutbox,
  clearHistoryOutbox,
  enqueueHistoryWrite,
  isPermanentFailure,
  pendingHistoryWrites
} from '@/utils/historyOutbox'

// Worker limits for POST /api/list/:type/import (workers/kinobox-search/account.mjs).
const LIST_IMPORT_ITEMS = 40
const LIST_IMPORT_BYTES = 60 * 1024

const apiCall = async (callFn) => {
  const auth = useAuthStore()
  const token = auth.token
  if (token && !auth.isWorkerSession) throw new Error('Войдите заново через Telegram')
  const response = await callFn(workerAccountAdapter)
  if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  return response
}
const listOwner = () => {
  const auth = useAuthStore()
  if (auth.token && !auth.user?.id) throw new Error('Дождитесь подтверждения аккаунта')
  return auth.token && auth.user?.id ? `worker:${auth.user.id}` : 'guest'
}
const listVersions = new Map()
const listKey = (owner, type) => `${owner}:${type}`
const invalidateList = (owner, type) => {
  const key = listKey(owner, type)
  const version = (listVersions.get(key) || 0) + 1
  listVersions.set(key, version)
  return version
}
const LIST_TYPES = new Set(['favorite', 'later', 'watching', 'completed', 'abandoned', 'history'])
const assertListCapability = (type) => {
  if (!LIST_TYPES.has(type)) throw new Error('Неизвестный список')
}

export async function getMovieListStatus(id) {
  if (!/^[1-9]\d{0,11}$/.test(String(id))) return {}
  const auth = useAuthStore()
  const token = auth.token
  if (auth.isWorkerSession) {
    try {
      return await workerAccountRequest(`/list-status/${id}`)
    } catch (error) {
      // Old Workers also reject Authorization in this route's CORS preflight.
      // Fall back to their existing private endpoints, never to cached membership.
      if (error.response?.status !== 404 && !(error instanceof TypeError)) throw error
    }
  }
  const types = Object.values(USER_LIST_TYPES_ENUM).filter((type) =>
    ['favorite', 'later', 'watching', 'completed', 'abandoned', 'history'].includes(type)
  )
  const entries = await Promise.all(
    types.map(async (type) => {
      const items =
        type === 'history' && isCloudHistoryEnabled()
          ? await getCloudHistory()
          : (await apiCall((api) => api.get(`/list/${type}`))).data
      return [
        type,
        Array.isArray(items) && items.some((item) => String(item.kp_id ?? item.id) === String(id))
      ]
    })
  )
  if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  return Object.fromEntries(entries)
}

export async function repairCardRatings(item, type, isCurrent = () => true) {
  const auth = useAuthStore()
  const token = auth.token
  const current = () => auth.token === token && isCurrent()
  const [result] = await enrichListMetadata([item], {
    includeRatings: true,
    isCurrent: current,
    persist:
      token &&
      auth.isWorkerSession &&
      ['history', 'favorite', 'later', 'watching', 'completed', 'abandoned'].includes(type)
        ? (card) => {
            const [metadata] = normalizeHistory([card])
            return type === USER_LIST_TYPES_ENUM.HISTORY
              ? historyRequest(`/${metadata.kp_id}`, 'PATCH', { metadata })
              : workerAccountRequest(`/list/${type}/${metadata.kp_id}`, 'PATCH', { metadata })
          }
        : undefined
  })
  return result
}

const HISTORY = USER_LIST_TYPES_ENUM.HISTORY
const STATUS_TYPES = [
  USER_LIST_TYPES_ENUM.WATCHING,
  USER_LIST_TYPES_ENUM.COMPLETED,
  USER_LIST_TYPES_ENUM.ABANDONED
]
const isAccount = (owner) => owner !== 'guest'

// One history write to the server, without touching the outbox.
const sendHistory = async (entry) => {
  if (isCloudHistoryEnabled()) {
    return entry.op === 'add'
      ? historyRequest(`/${entry.kpId}`, 'PUT', { ...entry.metadata, viewedAt: entry.at })
      : historyRequest(`/${entry.kpId}`, 'DELETE')
  }
  const payload = { metadata: entry.metadata, viewedAt: entry.at }
  const { data } = await apiCall((api) =>
    entry.op === 'add'
      ? api.put(`/list/${HISTORY}/${entry.kpId}`, payload)
      : api.delete(`/list/${HISTORY}/${entry.kpId}`)
  )
  return data
}

// Clearing the history must win over writes already in flight: it bumps the
// owner's generation (an older replay stops) and waits for sent requests.
const historyGeneration = new Map()
const historyInFlight = new Map()
const sendHistoryTracked = (owner, entry) => {
  const sending = sendHistory(entry)
  const pending = historyInFlight.get(owner) || new Set()
  historyInFlight.set(owner, pending)
  pending.add(sending)
  const settle = () => pending.delete(sending)
  sending.then(settle, settle)
  return sending
}
// The queue itself is dropped only after the server confirmed the deletion:
// if the DELETE fails, unsent viewings and deletions stay queued.
const historyClearing = new Set()
const stopHistoryWrites = async (owner) => {
  historyGeneration.set(owner, (historyGeneration.get(owner) || 0) + 1)
  historyClearing.add(owner)
  await Promise.allSettled([...(historyInFlight.get(owner) || [])])
}

// History writes go through a durable outbox: queued before the request,
// acknowledged after a 2xx, dropped only when a retry can never succeed.
const writeHistory = async (owner, op, id, metadata) => {
  const entry = enqueueHistoryWrite(
    owner,
    op,
    id,
    op === 'add' ? normalizeHistory([{ ...metadata, kp_id: id }])[0] : null
  )
  try {
    const data = await sendHistoryTracked(owner, entry)
    ackHistoryWrite(owner, entry)
    return data
  } catch (error) {
    if (isPermanentFailure(error)) ackHistoryWrite(owner, entry)
    throw error
  }
}

const flushing = new Map()
// Replay queued history writes for the current account, oldest first.
export function flushHistoryOutbox() {
  let owner
  try {
    owner = listOwner()
  } catch {
    return Promise.resolve(0)
  }
  if (!isAccount(owner) || historyClearing.has(owner)) return Promise.resolve(0)
  if (flushing.has(owner)) return flushing.get(owner)
  const token = useAuthStore().token
  const generation = historyGeneration.get(owner) || 0
  const task = (async () => {
    let sent = 0
    for (const entry of pendingHistoryWrites(owner).reverse()) {
      if (useAuthStore().token !== token) break
      // The history was cleared meanwhile: the rest of this snapshot is void.
      if ((historyGeneration.get(owner) || 0) !== generation) break
      try {
        await sendHistoryTracked(owner, entry)
        ackHistoryWrite(owner, entry)
        sent++
      } catch (error) {
        if (!isPermanentFailure(error)) break
        ackHistoryWrite(owner, entry)
      }
    }
    return sent
  })().finally(() => flushing.delete(owner))
  flushing.set(owner, task)
  return task
}

const addToList = async (id, type, metadata = null) => {
  assertListCapability(type)
  const token = useAuthStore().token
  const owner = listOwner()
  invalidateList(owner, type)
  if (type === HISTORY && isAccount(owner)) {
    const data = await writeHistory(owner, 'add', id, metadata || {})
    if (useAuthStore().token === token) addLocalListItem(type, id, metadata || {}, owner)
    return data
  }
  // Cloud lists store cards, not full provider responses (cast, trailers, raw_data).
  const payload = { metadata: normalizeHistory([{ ...metadata, kp_id: id }])[0] }
  const { data } = await apiCall((api) => api.put(`/list/${type}/${id}`, payload))
  if (useAuthStore().token === token) {
    addLocalListItem(type, id, metadata || {}, owner)
    // The Worker moved the title out of the other status lists in the same write.
    if (STATUS_TYPES.includes(type))
      for (const other of STATUS_TYPES.filter((status) => status !== type)) {
        invalidateList(owner, other)
        removeLocalListItem(other, id, owner)
      }
  }
  return data
}

// Import is sequential across bounded batches; retries are idempotent on the server.
// Batches respect the Worker's item AND byte limits; a full list is reported, not hidden.
export async function importWorkerList(type, ids) {
  const auth = useAuthStore()
  const token = auth.token
  const owner = listOwner()
  if (!auth.isWorkerSession) throw new Error('Требуется аккаунт Worker')
  invalidateList(owner, type)
  const items = ids
    .map((item) => (typeof item === 'object' ? item : { kp_id: item }))
    .map((item) => normalizeHistory([item])[0])
    .filter(Boolean)
  const batches = chunkByBytes(items, {
    maxItems: LIST_IMPORT_ITEMS,
    maxBytes: LIST_IMPORT_BYTES,
    envelope: (batch) => ({ items: batch, partial: true })
  })
  let added = 0
  let rejected = 0
  for (const batch of batches) {
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите импорт')
    try {
      const result = await workerAccountRequest(`/list/${type}/import`, 'POST', {
        items: batch,
        partial: true
      })
      added += Number(result.added) || 0
      rejected += Number(result.rejected) || 0
    } catch (error) {
      if (error.code !== 'list_capacity') throw error
      rejected += batch.length
    }
  }
  if (rejected) {
    const error = new Error(
      `Список заполнен (не больше 1000 фильмов): перенесено ${added}, не поместилось ${rejected}. Удалите лишние и повторите.`
    )
    error.code = 'list_capacity'
    error.added = added
    error.rejected = rejected
    throw error
  }
  return added
}

const delFromList = async (id, type) => {
  assertListCapability(type)
  const token = useAuthStore().token
  const owner = listOwner()
  invalidateList(owner, type)
  if (type === HISTORY && isAccount(owner)) {
    const data = await writeHistory(owner, 'del', id)
    if (useAuthStore().token === token) removeLocalListItem(type, id, owner)
    return data
  }
  const { data } = await apiCall((api) => api.delete(`/list/${type}/${id}`))
  if (useAuthStore().token === token) removeLocalListItem(type, id, owner)
  return data
}

const delAllFromList = async (type) => {
  assertListCapability(type)
  const token = useAuthStore().token
  const owner = listOwner()
  invalidateList(owner, type)
  if (type === HISTORY) {
    try {
      await stopHistoryWrites(owner)
      // The DELETE carries the current token: never clear an account the user
      // switched to while the writes in flight were settling.
      if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
      const data = isCloudHistoryEnabled()
        ? await historyRequest('', 'DELETE')
        : (await apiCall((api) => api.delete(`/list/${type}`))).data
      clearHistoryOutbox(owner)
      if (useAuthStore().token === token) clearLocalList(type, owner)
      return data
    } finally {
      historyClearing.delete(owner)
    }
  }
  const { data } = await apiCall((api) => api.delete(`/list/${type}`))
  if (useAuthStore().token === token) clearLocalList(type, owner)
  return data
}

const getMyLists = async (type, { fresh = false, awaitMetadata = false } = {}) => {
  assertListCapability(type)
  const auth = useAuthStore()
  const token = auth.token
  const owner = listOwner()
  const version = invalidateList(owner, type)
  const current = () =>
    auth.token === token &&
    (!token ||
      (auth.user?.id &&
        `worker:${auth.user.id}` === owner)) &&
    listVersions.get(listKey(owner, type)) === version
  const storeList = (items) => {
    if (!current()) throw new Error('Список изменился. Повторите операцию')
    replaceLocalList(type, items, owner)
  }
  const hydrate = (items) => {
    const cards = reactive(items)
    const task = enrichListMetadata(cards, {
      isCurrent: current,
      onItem: (item, index) => {
        if (current()) {
          cards[index] = item
        }
      },
      persist: auth.isWorkerSession
        ? (item) => {
            const [metadata] = normalizeHistory([item])
            return type === USER_LIST_TYPES_ENUM.HISTORY
              ? historyRequest(`/${metadata.kp_id}`, 'PATCH', { metadata })
              : workerAccountRequest(`/list/${type}/${metadata.kp_id}`, 'PATCH', { metadata })
          }
        : undefined
    })
    if (awaitMetadata) return task
    // Persist once per batch instead of serializing the entire list for every card.
    // A mutation invalidates this generation, so late metadata cannot restore deleted cards.
    void task.then(() => { if (current()) replaceLocalList(type, cards, owner) }).catch(() => {})
    return cards
  }
  // A server snapshot never erases history writes that are still queued.
  const withOutbox = (items) => {
    if (type !== HISTORY || !isAccount(owner)) return items
    void flushHistoryOutbox().catch(() => {})
    return applyHistoryOutbox(owner, items)
  }
  if (type === HISTORY && isCloudHistoryEnabled()) {
    const history = await hydrate(withOutbox(await getCloudHistory()))
    storeList(history)
    return history
  }
  try {
    const { data } = await apiCall((api) => api.get(`/list/${type}`))
    if (!Array.isArray(data)) throw new Error('Неполный ответ списка')
    const normalized = await hydrate(
      withOutbox(
        await normalizeMovieListResponse(data, {
          enrichMissingSeo: false
        })
      )
    )
    storeList(normalized)
    return normalized
  } catch (error) {
    if (!current()) throw error
    if (!fresh && !error.response) return getLocalList(type, owner)
    throw error
  }
}

const getUserLists = async (type, userId) => {
  if (useAuthStore().isWorkerSession && String(useAuthStore().user?.id) === String(userId))
    return getMyLists(type)
  const { data } = await apiCall((api) => api.get(`/user-list/${userId}/${type}`))
  return await normalizeMovieListResponse(data, {
    enrichMissingSeo: type !== USER_LIST_TYPES_ENUM.HISTORY
  })
}

const getListCounters = async (userId) => {
  const { data } = await apiCall((api) => api.get(`/user-list-counters/${userId}`))
  return data
}

const getUser = async () => {
  const { data } = await apiCall((api) => api.get('/user'))
  return data
}

const assertLoginEnabled = () => {
  if (!workerAuthEnabled) throw new Error('Вход временно недоступен')
}

const generateToken = async () => {
  assertLoginEnabled()
  return workerAccountRequest('/auth/telegram-login-token', 'POST', {}, { anonymous: true })
}

const getTGAuthResult = async (token) => {
  assertLoginEnabled()
  return workerAccountRequest('/auth/check-telegram-auth', 'POST', { token }, { anonymous: true })
}

const updateUserName = async (name) => {
  const { data } = await apiCall((api) => api.put('/user/name', { name }))
  return data
}

export {
  addToList,
  getMyLists,
  getUser,
  delAllFromList,
  delFromList,
  generateToken,
  getTGAuthResult,
  getUserLists,
  getListCounters,
  updateUserName
}
