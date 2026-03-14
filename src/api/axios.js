import axios from 'axios'
import { getCurrentApiUrl } from '@/firebase/firebase'
import { useAuthStore } from '@/store/auth'
import { useApiStore } from '@/store/api'

let apiInstance = null
let apiInstancePromise = null
let isApiReady = false

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
      console.error('Error', err)
      return Promise.reject(err)
    }
  )
}

export const getApi = async () => {
  if (apiInstance) {
    if (!isApiReady) {
      const baseURL = await getResolvedBaseUrl()
      apiInstance.defaults.baseURL = baseURL
      isApiReady = true
    }
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
    isApiReady = true

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
