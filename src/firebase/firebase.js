import { initializeApp } from 'firebase/app'
import { getRemoteConfig, getValue, fetchAndActivate } from 'firebase/remote-config'
import { useApiStore } from '@/store/api'

console.log(import.meta.env.FIREBASE_PROJECT_ID)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const firebaseApp = initializeApp(firebaseConfig)

const remoteConfig = getRemoteConfig(firebaseApp)

remoteConfig.settings.minimumFetchIntervalMillis = 60000
remoteConfig.settings.fetchTimeoutMillis = 10000

remoteConfig.defaultConfig = {
  api_endpoints: JSON.stringify([
    {
      url: import.meta.env.VITE_APP_API_URL,
      description: 'Primary API'
    }
  ]),
  load_script: false
}

let isConfigInitialized = false
let initPromise = null

function parseApiEndpoints(configValue) {
  try {
    const parsed = JSON.parse(configValue)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (endpoint) =>
          endpoint && typeof endpoint.url === 'string' && typeof endpoint.description === 'string'
      )
    }
    return []
  } catch (error) {
    console.error('Failed to parse API endpoints from Remote Config:', error)
    return [
      {
        url: import.meta.env.VITE_APP_API_URL,
        description: 'Fallback API'
      }
    ]
  }
}

async function initRemoteConfig() {
  if (isConfigInitialized) return

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const apiStore = useApiStore()

    try {
      await fetchAndActivate(remoteConfig)
      isConfigInitialized = true

      const endpointsConfig = getValue(remoteConfig, 'api_endpoints').asString()
      const endpoints = parseApiEndpoints(endpointsConfig)

      console.log('Remote Config loaded, available endpoints:', endpoints)

      apiStore.setAvailableEndpoints(endpoints)

      await apiStore.selectWorkingEndpoint(endpoints)
      console.log('Selected API URL:', apiStore.currentApiUrl)
    } catch (err) {
      console.error('Failed to load Remote Config:', err)

      const fallbackEndpoints = [
        {
          url: import.meta.env.VITE_APP_API_URL,
          description: 'Fallback API'
        }
      ]

      apiStore.setAvailableEndpoints(fallbackEndpoints)
      await apiStore.selectWorkingEndpoint(fallbackEndpoints)
    }
  })()

  return initPromise
}

function getConfigValue(key) {
  if (!isConfigInitialized) {
    console.warn('Remote Config not initialized yet, using default value')
  }
  return getValue(remoteConfig, key).asString()
}

async function getCurrentApiUrl() {
  await initRemoteConfig()
  const apiStore = useApiStore()
  return apiStore.currentApiUrl || import.meta.env.VITE_APP_API_URL
}

export { remoteConfig, getValue, initRemoteConfig, getConfigValue, getCurrentApiUrl }
