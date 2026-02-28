import { initializeApp } from 'firebase/app'
import { getRemoteConfig, getValue, fetchAndActivate } from 'firebase/remote-config'
import { useApiStore } from '@/store/api'

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
const fallbackEndpoint = {
  url: import.meta.env.VITE_APP_API_URL,
  description: 'Fallback API'
}

function getAllowedApiHosts() {
  let fallbackHost = null
  try {
    fallbackHost = new URL(import.meta.env.VITE_APP_API_URL).hostname
  } catch {
    fallbackHost = null
  }
  const configuredHosts = (import.meta.env.VITE_ALLOWED_API_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return new Set([fallbackHost, ...configuredHosts].filter(Boolean))
}

function isValidApiEndpoint(endpoint) {
  if (!endpoint || typeof endpoint.url !== 'string' || typeof endpoint.description !== 'string') {
    return false
  }

  try {
    const endpointUrl = new URL(endpoint.url)
    const allowedHosts = getAllowedApiHosts()
    const isAllowedHost = allowedHosts.has(endpointUrl.hostname)
    const isHttps = endpointUrl.protocol === 'https:'
    const isLocalDevHttp = import.meta.env.DEV && endpointUrl.hostname === 'localhost'

    return isAllowedHost && (isHttps || isLocalDevHttp)
  } catch {
    return false
  }
}

function parseApiEndpoints(configValue) {
  try {
    const parsed = JSON.parse(configValue)
    if (Array.isArray(parsed)) {
      const safeEndpoints = parsed.filter(isValidApiEndpoint)
      return safeEndpoints.length > 0 ? safeEndpoints : [fallbackEndpoint]
    }
    return [fallbackEndpoint]
  } catch {
    return [fallbackEndpoint]
  }
}

async function initRemoteConfig() {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const apiStore = useApiStore()

    try {
      if (!isConfigInitialized) {
        await fetchAndActivate(remoteConfig)
        isConfigInitialized = true
      }

      const endpointsConfig = getValue(remoteConfig, 'api_endpoints').asString()
      const endpoints = parseApiEndpoints(endpointsConfig)

      apiStore.setAvailableEndpoints(endpoints)

      await apiStore.selectWorkingEndpoint(endpoints)
    } catch {
      const fallbackEndpoints = [fallbackEndpoint]

      apiStore.setAvailableEndpoints(fallbackEndpoints)
      await apiStore.selectWorkingEndpoint(fallbackEndpoints)
    }
  })()

  return initPromise
}

function getConfigValue(key) {
  return getValue(remoteConfig, key).asString()
}

async function getCurrentApiUrl() {
  await initRemoteConfig()
  const apiStore = useApiStore()
  return apiStore.currentApiUrl || import.meta.env.VITE_APP_API_URL
}

export { remoteConfig, getValue, initRemoteConfig, getConfigValue, getCurrentApiUrl }
