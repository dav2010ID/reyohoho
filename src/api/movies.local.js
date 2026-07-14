import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { LOCAL_API_URL } from '@/store/api'

export const localApi = axios.create({
  baseURL: LOCAL_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})

localApi.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  config.headers = config.headers || {}
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  } else {
    delete config.headers.Authorization
  }
  return config
})

const apiSearch = async (searchTerm, requestConfig = {}) => {
  const { data } = await localApi.get(`/search/${encodeURIComponent(searchTerm)}`, requestConfig)
  return data
}

const getKpInfo = async (kpId, requestConfig = {}) => {
  const { data } = await localApi.get(`/kp_info2/${kpId}`, requestConfig)
  return data
}

const getShikiInfo = async (shikiId, requestConfig = {}) => {
  const { data } = await localApi.get(`/shiki_info/${shikiId}`, requestConfig)
  return data
}

const getKpIDfromSHIKI = async (shikiId, requestConfig = {}) => {
  const cleanId = String(shikiId || '').replace(/\D/g, '')
  const { data } = await localApi.get(`/shiki_to_kp/${cleanId}`, requestConfig)
  return {
    ...data,
    id_kp: data?.id_kp || data?.kinopoisk_id || null
  }
}

const getPlayers = async (kpId) => {
  const { data } = await localApi.post(
    '/cache',
    new URLSearchParams({ kinopoisk: kpId, type: 'movie' }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return data
}

const getRating = async (kpId) => {
  const { data } = await localApi.get(`/rating/${kpId}`)
  return data
}

const setRating = async (kpId, rating) => {
  const { data } = await localApi.post(`/rating/${kpId}`, { rating })
  return data
}

const getComments = async (movieId, requestConfig = {}) =>
  (await localApi.get(`/comments/${movieId}`, requestConfig)).data
const createComment = async (movieId, content, parentId = null) =>
  (await localApi.post(`/comments/${movieId}`, { content, parent_id: parentId })).data
const updateComment = async (commentId, content) =>
  (await localApi.put(`/comments/${commentId}`, { content })).data
const deleteComment = async (commentId) => (await localApi.delete(`/comments/${commentId}`)).data
const rateComment = async (commentId, rating) =>
  (await localApi.post(`/comments/${commentId}/rate`, { rating })).data
const submitTiming = async (kpId, timingText) =>
  (await localApi.post(`/timings/${kpId}`, { timing_text: timingText })).data
const updateTiming = async (timingId, timingText) =>
  (await localApi.put(`/timings/${timingId}`, { timing_text: timingText })).data
const deleteTiming = async (timingId) => (await localApi.delete(`/timings/${timingId}`)).data
const reportTiming = async (timingId, reportText) =>
  (await localApi.post(`/timings/${timingId}/report`, { report_text: reportText })).data
const getTopTimingSubmitters = async () => (await localApi.get('/timings/top')).data
const getAllTimingSubmissions = async () => (await localApi.get('/timings/all')).data
const approveTiming = async (submissionId) =>
  (await localApi.post(`/timings/submission/${submissionId}/approve`)).data
const rejectTiming = async (submissionId) =>
  (await localApi.post(`/timings/submission/${submissionId}/reject`)).data
const markAsCleanText = async (submissionId) =>
  (await localApi.post(`/timings/submission/${submissionId}/clean_text`)).data
const voteOnTiming = async (timingId, voteType) =>
  (await localApi.post(`/timings/${timingId}/vote`, { vote_type: voteType })).data
const getTimingVote = async (timingId) => (await localApi.get(`/timings/${timingId}/vote`)).data
const getMovieNote = async (kpId) => (await localApi.get(`/movies/${kpId}/note`)).data
const saveMovieNote = async (kpId, noteText) =>
  (await localApi.post(`/movies/${kpId}/note`, { note_text: noteText })).data
const deleteMovieNote = async (kpId) => (await localApi.delete(`/movies/${kpId}/note`)).data
const getNudityInfoFromIMDB = async (imdbId) =>
  (await localApi.get(`/imdb_parental_guide/${imdbId}`)).data
const getTwitchStream = async (username) => (await localApi.get(`/twitch/${username}`)).data

const getShikiPlayers = async (shikiId) => {
  const { data } = await localApi.post(
    '/cache_shiki',
    new URLSearchParams({ shikimori: shikiId, type: 'anime' }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return data
}

const getMovies = async ({
  activeTime = 'all',
  typeFilter = 'all',
  limit = null,
  page = null
} = {}) => {
  const { data } = await localApi.get(`/top/${activeTime}`, {
    params: { type: typeFilter, limit, page }
  })
  return data
}

const getDiscussedMovies = async (type = 'hot', { page = null, limit = null } = {}) => {
  const { data } = await localApi.get(`/discussed/${type}`, { params: { page, limit } })
  return data
}

const getRandomMovie = async () => {
  const { data } = await localApi.get('/chance')
  return data
}

export {
  apiSearch,
  getKpInfo,
  getShikiInfo,
  getKpIDfromSHIKI,
  getPlayers,
  getRating,
  setRating,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  rateComment,
  submitTiming,
  updateTiming,
  deleteTiming,
  reportTiming,
  getTopTimingSubmitters,
  getAllTimingSubmissions,
  approveTiming,
  rejectTiming,
  markAsCleanText,
  voteOnTiming,
  getTimingVote,
  getMovieNote,
  saveMovieNote,
  deleteMovieNote,
  getNudityInfoFromIMDB,
  getTwitchStream,
  getShikiPlayers,
  getMovies,
  getDiscussedMovies,
  getRandomMovie
}
