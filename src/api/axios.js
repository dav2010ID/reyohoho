import axios from 'axios'
import { getCurrentApiUrl } from '@/firebase/firebase'
import { useAuthStore } from '@/store/auth'
import { useApiStore } from '@/store/api'

let apiInstance = null

export const getApi = async () => {
  if (!apiInstance) {
    const authStore = useAuthStore()

    const apiUrl = await getCurrentApiUrl()

    apiInstance = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' }
    })
    if (authStore.token) {
      apiInstance.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`
    }
    apiInstance.interceptors.request.use(
      (config) => {
        return config
      },
      (err) => Promise.reject(err)
    )

    apiInstance.interceptors.response.use(
      (res) => res,
      async (err) => {
        console.error('Error', err)
        return Promise.reject(err)
      }
    )
  }

  return apiInstance
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
    availableEndpoints: apiStore.availableEndpoints,
    userSelectedApiUrl: apiStore.userSelectedApiUrl
  }
}
