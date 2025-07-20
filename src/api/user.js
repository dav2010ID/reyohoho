import { getApi } from '@/api/axios'

const apiCall = async (callFn) => {
  const api = await getApi()
  return await callFn(api)
}

const addToList = async (id, type) => {
  const { data } = await apiCall((api) => api.put(`/list/${type}/${id}`))
  return data
}

const delFromList = async (id, type) => {
  const { data } = await apiCall((api) => api.delete(`/list/${type}/${id}`))
  return data
}

const delAllFromList = async (type) => {
  const { data } = await apiCall((api) => api.delete(`/list/${type}`))
  return data
}

const getMyLists = async (type) => {
  const { data } = await apiCall((api) => api.get(`/list/${type}`))
  return data
}

const getUserLists = async (type, userId) => {
  const { data } = await apiCall((api) => api.get(`/user-list/${userId}/${type}`))
  return data
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
