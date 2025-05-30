import { getApi } from '@/api/axios'

// ===== Симуляция ошибки =====
let isErrorSimulationEnabled = false // Переменная для включения/отключения симуляции ошибки
const simulatedErrorCode = 500

const simulateErrorIfNeeded = async () => {
  if (isErrorSimulationEnabled && simulatedErrorCode) {
    const status = parseInt(simulatedErrorCode, 10)
    const error = new Error(`Симулированная ошибка ${status}`)
    error.response = { status }
    throw error
  }
}

// Универсальный вызов запроса с симуляцией ошибки
const apiCall = async (callFn) => {
  await simulateErrorIfNeeded()
  const api = await getApi()
  return await callFn(api)
}

// ===== API-функции =====
const apiSearch = async (searchTerm) => {
  const { data } = await apiCall((api) => api.get(`/search/${searchTerm}`))
  return data
}

const getShikiInfo = async (shikiId) => {
  const { data } = await apiCall((api) => api.get(`/shiki_info/${shikiId}`))
  return data
}

const getKpInfo = async (kpId) => {
  const { data } = await apiCall((api) => api.get(`/kp_info2/${kpId}`))
  return data
}

const getPlayers = async (kpId) => {
  const { data } = await apiCall((api) =>
    api.post(
      '/cache',
      new URLSearchParams({
        kinopoisk: kpId,
        type: 'movie'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
  )
  return data
}

const getMovies = async ({ activeTime = 'all', typeFilter = 'all', limit = null } = {}) => {
  const limitParam = limit ? `&limit=${limit}` : ''
  const { data } = await apiCall((api) =>
    api.get(`/top/${activeTime}?type=${typeFilter}${limitParam}`)
  )
  return data
}

const getDons = async () => {
  const { data } = await apiCall((api) => api.get('/get_dons'))
  return data
}

const getKpIDfromIMDB = async (imdb_id) => {
  const { data } = await apiCall((api) => api.get(`/imdb_to_kp/${imdb_id}`))
  return data
}

const getNudityInfoFromIMDB = async (imdb_id) => {
  const { data } = await apiCall((api) => api.get(`/imdb_parental_guide/${imdb_id}`))
  return data
}

const getKpIDfromSHIKI = async (shiki_id) => {
  const { data } = await apiCall((api) => api.get(`/shiki_to_kp/${shiki_id}`))
  return data
}

const getRating = async (kpId) => {
  const { data } = await apiCall((api) => api.get(`/rating/${kpId}`))
  return data
}

const setRating = async (kpId, rating) => {
  const { data } = await apiCall((api) => api.post(`/rating/${kpId}`, { rating }))
  return data
}

const getComments = async (movieId) => {
  const { data } = await apiCall((api) => api.get(`/comments/${movieId}`))
  return data
}

const createComment = async (movieId, content, parentId = null) => {
  const { data } = await apiCall((api) =>
    api.post(`/comments/${movieId}`, { content, parent_id: parentId })
  )
  return data
}

const updateComment = async (commentId, content) => {
  const { data } = await apiCall((api) => api.put(`/comments/${commentId}`, { content }))
  return data
}

const deleteComment = async (commentId) => {
  const { data } = await apiCall((api) => api.delete(`/comments/${commentId}`))
  return data
}

const rateComment = async (commentId, rating) => {
  const { data } = await apiCall((api) =>
    api.post(`/comments/${commentId}/rate`, { rating: rating })
  )
  return data
}

export {
  apiSearch,
  getShikiInfo,
  getKpInfo,
  getPlayers,
  getMovies,
  getDons,
  getKpIDfromIMDB,
  getKpIDfromSHIKI,
  getRating,
  setRating,
  getNudityInfoFromIMDB,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  rateComment
}

// ===== Функция для включения/выключения симуляции =====
export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
