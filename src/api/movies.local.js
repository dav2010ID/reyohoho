import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { LOCAL_API_URL } from '@/store/api'
import { isTrustedApiRequest } from '@/utils/apiTrust'

export const localApi = axios.create({
  baseURL: LOCAL_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})

localApi.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  config.headers = config.headers || {}
  if (
    authStore.token &&
    !authStore.token.startsWith('rh1_') &&
    isTrustedApiRequest({ baseURL: config.baseURL, url: config.url })
  ) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  } else {
    if (typeof config.headers.delete === 'function') config.headers.delete('Authorization')
    else
      for (const key of Object.keys(config.headers)) {
        if (key.toLowerCase() === 'authorization') delete config.headers[key]
      }
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

const getPlayers = async (kpId, { signal } = {}) => {
  const { data } = await localApi.post(
    '/cache',
    new URLSearchParams({ kinopoisk: kpId, type: 'movie' }),
    { signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

const getShikiPlayers = async (shikiId, { signal } = {}) => {
  const { data } = await localApi.post(
    '/cache_shiki',
    new URLSearchParams({ shikimori: shikiId, type: 'anime' }),
    { signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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
  getShikiPlayers,
  getMovies,
  getDiscussedMovies,
  getRandomMovie
}
