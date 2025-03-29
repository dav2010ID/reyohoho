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

const getKpIDfromTMDB = async (tmdb_id) => {
  const { data } = await apiCall((api) => api.get(`/tmdb_to_kp/${tmdb_id}`))
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
  getKpIDfromTMDB
}

// ===== Универсальный обработчик ошибок =====
export const handleApiError = (error) => {
  if (error.code === 'ECONNABORTED') {
    return {
      message: 'Ошибка: сервер не отвечает (таймаут)',
      code: 408
    }
  } else if (error.response) {
    if (error.response.status >= 500) {
      return {
        message: 'Ошибка на сервере. Пожалуйста, попробуйте позже',
        code: error.response.status
      }
    }

    switch (error.response.status) {
      case 403:
        return {
          message: 'Упс, недоступно по требованию правообладателя',
          code: 403
        }
      case 404:
        return {
          message: 'Данные не найдены',
          code: 404
        }
      default:
        return {
          message: `Произошла неизвестная ошибка. Ошибка: ${error.response.status}`,
          code: error.response.status
        }
    }
  } else {
    return {
      message: `Ошибка: ${error.message}`,
      code: null
    }
  }
}

// ===== Функция для включения/выключения симуляции =====
export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
