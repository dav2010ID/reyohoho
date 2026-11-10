import { getApi } from '@/api/axios'
import { reactive } from 'vue'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { getCloudHistory, historyRequest, isCloudHistoryEnabled } from './cloudHistory'
import { normalizeHistory } from '../../shared/history-data.js'
import { useAuthStore } from '@/store/auth'
import { workerAccountAdapter, workerAccountRequest, workerAuthEnabled } from './workerAccount'
import { enrichListMetadata } from './listMetadata'
import { accountCapabilities } from './accountCapabilities'
import {
  addLocalListItem,
  clearLocalList,
  getLocalList,
  removeLocalListItem,
  replaceLocalList
} from '@/utils/localUserLists'

const apiCall = async (callFn) => {
  const auth = useAuthStore()
  const token = auth.token
  const api = auth.isWorkerSession ? workerAccountAdapter : await getApi()
  if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  const response = await callFn(api)
  if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  return response
}
const listOwner = () => {
  const auth = useAuthStore()
  if (auth.token && !auth.user?.id) throw new Error('Дождитесь подтверждения аккаунта')
  return auth.token && auth.user?.id
    ? `${auth.isWorkerSession ? 'worker' : 'legacy'}:${auth.user.id}`
    : 'guest'
}
const listVersions = new Map()
const listKey = (owner, type) => `${owner}:${type}`
const invalidateList = (owner, type) => {
  const key = listKey(owner, type)
  const version = (listVersions.get(key) || 0) + 1
  listVersions.set(key, version)
  return version
}
const assertListCapability = (type) => {
  if (type === USER_LIST_TYPES_ENUM.RATED && !accountCapabilities(useAuthStore()).rated)
    throw new Error('Оценки недоступны для этого аккаунта')
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

const addToList = async (id, type, metadata = null) => {
  assertListCapability(type)
  const token = useAuthStore().token
  const owner = listOwner()
  invalidateList(owner, type)
  // Cloud lists store cards, not full provider responses (cast, trailers, raw_data).
  // Preserve the legacy backend payload contract.
  const payload = useAuthStore().isWorkerSession
    ? { metadata: normalizeHistory([{ ...metadata, kp_id: id }])[0] }
    : metadata
      ? { metadata }
      : undefined
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const [item] = normalizeHistory([{ ...metadata, kp_id: id }])
    const data = await historyRequest(`/${encodeURIComponent(id)}`, 'PUT', item)
    if (useAuthStore().token === token) addLocalListItem(type, id, metadata || {}, owner)
    return data
  }
  const { data } = await apiCall((api) => api.put(`/list/${type}/${id}`, payload))
  if (useAuthStore().token === token) addLocalListItem(type, id, metadata || {}, owner)
  return data
}

// Import is sequential across bounded batches; retries are idempotent on the server.
export async function importWorkerList(type, ids) {
  const auth = useAuthStore()
  const token = auth.token
  const owner = listOwner()
  if (!auth.isWorkerSession) throw new Error('Требуется аккаунт Worker')
  invalidateList(owner, type)
  let added = 0
  for (let i = 0; i < ids.length; i += 40) {
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите импорт')
    const items = ids.slice(i, i + 40).map(item => typeof item === 'object' ? item : { kp_id: item })
    const result = await workerAccountRequest(`/list/${type}/import`, 'POST', { items })
    added += result.added
  }
  return added
}

const delFromList = async (id, type) => {
  assertListCapability(type)
  const token = useAuthStore().token
  const owner = listOwner()
  invalidateList(owner, type)
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const data = await historyRequest(`/${encodeURIComponent(id)}`, 'DELETE')
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
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const data = await historyRequest('', 'DELETE')
    if (useAuthStore().token === token) clearLocalList(type, owner)
    return data
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
        `${auth.isWorkerSession ? 'worker' : 'legacy'}:${auth.user.id}` === owner)) &&
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
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const history = await hydrate(await getCloudHistory())
    storeList(history)
    return history
  }
  try {
    const { data } = await apiCall((api) => api.get(`/list/${type}`))
    if (!Array.isArray(data)) throw new Error('Неполный ответ списка')
    const normalized = await hydrate(
      await normalizeMovieListResponse(data, {
        enrichMissingSeo: false
      })
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

const generateToken = async () => {
  if (workerAuthEnabled)
    return workerAccountRequest('/auth/telegram-login-token', 'POST', {}, { anonymous: true })
  const { data } = await apiCall((api) => api.get('/auth/telegram-login-token'))
  return data
}

const getTGAuthResult = async (token) => {
  if (workerAuthEnabled)
    return workerAccountRequest('/auth/check-telegram-auth', 'POST', { token }, { anonymous: true })
  const { data } = await apiCall((api) => api.get(`/auth/check-telegram-auth?token=${token}`))
  return data
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
