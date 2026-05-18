export const trackAnalyticsEvent = (event, params = {}) => {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event,
    ...params
  })
}

let electronClientDetectedTracked = false

const markSessionEventTracked = (key) => {
  try {
    if (window.sessionStorage.getItem(key)) return false
    window.sessionStorage.setItem(key, '1')
    return true
  } catch {
    if (electronClientDetectedTracked) return false
    electronClientDetectedTracked = true
    return true
  }
}

export const trackElectronClientDetected = () => {
  if (typeof window === 'undefined') return
  if (!window.electronAPI) return

  const eventName = 'electron_client_detected'
  const shouldTrack = markSessionEventTracked('reyohoho:electron-client-detected')
  if (!shouldTrack) return

  trackAnalyticsEvent(eventName, {
    client: 'electron'
  })
}
