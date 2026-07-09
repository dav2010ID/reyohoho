import { getApi } from '@/api/axios'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import {
  addLocalListItem,
  clearLocalList,
  getLocalList,
  removeLocalListItem,
  replaceLocalList
} from '@/utils/localUserLists'

const apiCall = async (callFn) => {
  const api = await getApi()
  return await callFn(api)
}

const addToList = async (id, type, metadata = null) => {
  const payload = metadata ? { metadata } : undefined
  addLocalListItem(type, id, metadata || {})
  const { data } = await apiCall((api) => api.put(`/list/${type}/${id}`, payload))
  return data
}

const delFromList = async (id, type) => {
  const { data } = await apiCall((api) => api.delete(`/list/${type}/${id}`))
  removeLocalListItem(type, id)
  return data
}

const delAllFromList = async (type) => {
  const { data } = await apiCall((api) => api.delete(`/list/${type}`))
  clearLocalList(type)
  return data
}

const getMyLists = async (type) => {
  try {
    const { data } = await apiCall((api) => api.get(`/list/${type}`))
    const normalized = await normalizeMovieListResponse(data, {
      enrichMissingSeo: type !== USER_LIST_TYPES_ENUM.HISTORY
    })
    replaceLocalList(type, normalized)
    return normalized
  } catch (error) {
    if (!error.response) return getLocalList(type)
    throw error
  }
}

const getUserLists = async (type, userId) => {
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
  const { data } = await apiCall((api) => api.get('/auth/telegram-login-token'))
  return data
}

const getTGAuthResult = async (token) => {
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
