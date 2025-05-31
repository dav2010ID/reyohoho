import axios from 'axios'
import { getConfigValue, initRemoteConfig } from '@/firebase/firebase'
import { useAuthStore } from '@/store/auth'

let apiInstance = null

export const getApi = async () => {
  if (!apiInstance) {
    const authStore = useAuthStore()

    await initRemoteConfig()
    const apiUrl = getConfigValue('api_url') || import.meta.env.VITE_APP_API_URL

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
    await initRemoteConfig()
    const apiUrl = getConfigValue('api_url') || import.meta.env.VITE_APP_API_URL
    return apiUrl
  } else {
    return apiInstance.defaults.baseURL
  }
}

export const getBaseURLSync = () => {
  return apiInstance.defaults.baseURL
}
