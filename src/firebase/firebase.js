import { initializeApp } from 'firebase/app'
import { getRemoteConfig, getValue, fetchAndActivate } from 'firebase/remote-config'
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
  api_url: import.meta.env.VITE_APP_API_URL
}

async function initRemoteConfig() {
  try {
    await fetchAndActivate(remoteConfig)
    console.log('Remote Config initialized:', getConfigValue('api_url'))
    console.log('Remote Config loaded')
  } catch (err) {
    console.error('Failed load Remote Config:', err)
  }
}

function getConfigValue(key) {
  return getValue(remoteConfig, key).asString()
}

export { remoteConfig, getValue, initRemoteConfig, getConfigValue }
