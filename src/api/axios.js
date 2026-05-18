import axios from 'axios'
import { getCurrentApiUrl } from '@/firebase/firebase'
import { useAuthStore } from '@/store/auth'
import { useApiStore } from '@/store/api'

let apiInstance = null
let apiInstancePromise = null

const getResolvedBaseUrl = async () => {
  const apiStore = useApiStore()
  return apiStore.currentApiUrl || (await getCurrentApiUrl())
}

const attachDynamicRequestState = (instance) => {
  instance.interceptors.request.use(
    async (config) => {
      const authStore = useAuthStore()
      const baseURL = await getResolvedBaseUrl()
      config.headers = config.headers || {}

      config.baseURL = baseURL
      instance.defaults.baseURL = baseURL

      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`
        instance.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`
      } else {
        delete config.headers.Authorization
        delete instance.defaults.headers.common['Authorization']
      }

      return config
    },
    (err) => Promise.reject(err)
  )

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const method = err.config?.method?.toUpperCase?.() || 'REQUEST'
      const baseURL = err.config?.baseURL || instance.defaults.baseURL || ''
      const url = err.config?.url || ''
      const requestUrl = url.startsWith('http') ? url : `${baseURL}${url}`

      console.error('[API Error]', {
        method,
        url: requestUrl,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      })
      return Promise.reject(err)
    }
  )
}

export const getApi = async () => {
  if (apiInstance) {
    return apiInstance
  }

  if (apiInstancePromise) {
    return apiInstancePromise
  }

  apiInstancePromise = (async () => {
    const apiUrl = await getResolvedBaseUrl()

    apiInstance = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' }
    })
    attachDynamicRequestState(apiInstance)

    return apiInstance
  })()

  return apiInstancePromise
}

export const getBaseURL = async () => {
  if (!apiInstance) {
    return await getCurrentApiUrl()
  } else {
    return apiInstance.defaults.baseURL
  }
}

export const getBaseURLSync = () => {
  if (!apiInstance) {
    const apiStore = useApiStore()
    return apiStore.currentApiUrl || import.meta.env.VITE_APP_API_URL
  }
  return apiInstance.defaults.baseURL
}

export const getCurrentApiInfo = () => {
  const apiStore = useApiStore()
  return {
    url: apiStore.currentApiUrl || import.meta.env.VITE_APP_API_URL,
    description: apiStore.getCurrentApiDescription(),
    isCheckingHealth: apiStore.isCheckingHealth,
    lastCheckedAt: apiStore.lastCheckedAt,
    availableEndpoints: apiStore.availableEndpoints
  }
}

/**
 * Force-invalidate the cached axios instance (e.g. when the API endpoint changes).
 * The next call to getApi() will create a fresh instance with the new URL.
 */
export const resetApi = () => {
  apiInstance = null
  apiInstancePromise = null
}
