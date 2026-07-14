export const trackAnalyticsEvent = (event, params = {}) => {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event,
    ...params
  })
}

const DEFAULT_YANDEX_METRIKA_ID = 109132833
const METRIKA_RETRY_DELAY_MS = 200
const METRIKA_RETRY_LIMIT = 25
const ANALYTICS_DISABLED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

const configuredMetrikaId = () => {
  const value = Number(import.meta.env.VITE_YANDEX_METRIKA_ID || DEFAULT_YANDEX_METRIKA_ID)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export const normalizePageViewUrl = (value) => {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  } catch {
    return String(value || '').split('#')[0]
  }
}

export const createYandexPageViewSender = ({
  windowObject = typeof window !== 'undefined' ? window : null,
  counterId = configuredMetrikaId(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  retryLimit = METRIKA_RETRY_LIMIT
} = {}) => {
  const pending = []
  let retryCount = 0
  let retryScheduled = false

  const flush = () => {
    retryScheduled = false
    const metrika = windowObject?.ym

    if (typeof metrika !== 'function') {
      if (pending.length && retryCount < retryLimit) {
        retryCount += 1
        retryScheduled = true
        schedule(flush, METRIKA_RETRY_DELAY_MS)
      } else if (retryCount >= retryLimit) {
        pending.length = 0
      }
      return false
    }

    retryCount = 0
    while (pending.length) {
      const page = pending.shift()
      try {
        metrika(counterId, 'hit', page.url, {
          title: page.title,
          referer: page.referrer
        })
      } catch (error) {
        console.warn('Yandex Metrica page view failed:', error)
      }
    }
    return true
  }

  return (page) => {
    if (!windowObject || !counterId || !page?.url) return false
    if (ANALYTICS_DISABLED_HOSTS.has(windowObject.location?.hostname)) return false
    pending.push(page)
    if (!retryScheduled) flush()
    return true
  }
}

export const createSpaPageViewTracker = ({ sendPageView, getPage, shouldSkip = () => false }) => {
  let initialPageSeen = false
  let previousUrl = ''

  return (route) => {
    const page = getPage(route)

    // GTM initializes Metrica with defer=false, so it already records the first page.
    if (!initialPageSeen) {
      if (shouldSkip(route)) return false
      initialPageSeen = true
      previousUrl = page?.url || ''
      return false
    }

    if (!page?.url || page.url === previousUrl || shouldSkip(route)) return false

    const trackedPage = {
      ...page,
      referrer: previousUrl
    }
    previousUrl = page.url
    sendPageView(trackedPage)
    return true
  }
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
