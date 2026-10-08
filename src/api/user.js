import { getApi } from '@/api/axios'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { historyRequest, isCloudHistoryEnabled } from './cloudHistory'
import { normalizeHistory } from '../../migration/history-transfer/history-data.js'
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

const apiCall = async (callFn) => {
  const api = useAuthStore().isWorkerSession ? workerAccountAdapter : await getApi()
  return await callFn(api)
}

const addToList = async (id, type, metadata = null) => {
  const token = useAuthStore().token
  if (useAuthStore().isWorkerSession) {
    ;[metadata] = await enrichListMetadata([{ ...metadata, kp_id: String(id) }], {
      isCurrent: () => useAuthStore().token === token
    })
  }
  // Cloud lists store cards, not full provider responses (cast, trailers, raw_data).
  // Preserve the legacy backend payload contract.
  const payload = useAuthStore().isWorkerSession
    ? { metadata: normalizeHistory([{ ...metadata, kp_id: id }])[0] }
    : metadata ? { metadata } : undefined
  addLocalListItem(type, id, metadata || {})
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const [item] = normalizeHistory([{ ...metadata, kp_id: id }])
    return historyRequest(`/${encodeURIComponent(id)}`, 'PUT', item)
  }
  const { data } = await apiCall((api) => api.put(`/list/${type}/${id}`, payload))
  return data
}

const delFromList = async (id, type) => {
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const data = await historyRequest(`/${encodeURIComponent(id)}`, 'DELETE')
    removeLocalListItem(type, id)
    return data
  }
  const { data } = await apiCall((api) => api.delete(`/list/${type}/${id}`))
  removeLocalListItem(type, id)
  return data
}

const delAllFromList = async (type) => {
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const data = await historyRequest('', 'DELETE')
    clearLocalList(type)
    return data
  }
  const { data } = await apiCall((api) => api.delete(`/list/${type}`))
  clearLocalList(type)
  return data
}

const getMyLists = async (type) => {
  const auth = useAuthStore()
  const token = auth.token
  const hydrate = (items) =>
    enrichListMetadata(items, {
      isCurrent: () => useAuthStore().token === token,
      persist: auth.isWorkerSession
        ? (item) => {
            const [metadata] = normalizeHistory([item])
            return type === USER_LIST_TYPES_ENUM.HISTORY
              ? historyRequest(`/${metadata.kp_id}`, 'PATCH', { metadata })
              : workerAccountRequest(`/list/${type}/${metadata.kp_id}`, 'PATCH', { metadata })
          }
        : undefined
    })
  if (type === USER_LIST_TYPES_ENUM.HISTORY && isCloudHistoryEnabled()) {
    const history = await hydrate(normalizeHistory((await historyRequest()).history))
    replaceLocalList(type, history)
    return history
  }
  try {
    const { data } = await apiCall((api) => api.get(`/list/${type}`))
    const normalized = await hydrate(
      await normalizeMovieListResponse(data, {
        enrichMissingSeo: type !== USER_LIST_TYPES_ENUM.HISTORY
      })
    )
    replaceLocalList(type, normalized)
    return normalized
  } catch (error) {
    if (useAuthStore().token !== token) throw error
    if (!error.response) return getLocalList(type)
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
