const isDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true'

export const debugLog = (...args) => {
  if (isDebugEnabled) {
    console.log(...args)
  }
}

export const debugInfo = (...args) => {
  if (isDebugEnabled) {
    console.info(...args)
  }
}
