export const trackAnalyticsEvent = (event, params = {}) => {
  if (typeof window === 'undefined') return
  if (isAuthCallback(window.location?.pathname)) return

  params = { ...params }
  delete params.kp_id
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event,
    ...params
  })
}

const DEFAULT_YANDEX_METRIKA_ID = 109132833
const ANALYTICS_LOAD_GRACE_MS = 5000
const ANALYTICS_IDLE_TIMEOUT_MS = 2000
const ANALYTICS_IDLE_FALLBACK_MS = 200
const ANALYTICS_INTERACTIONS = ['pointerdown', 'keydown', 'touchstart']
const ANALYTICS_DISABLED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

const isAuthCallback = (path = '') => /\/auth-success\/?$/.test(path)

const isAnalyticsAllowed = (windowObject, disabled) =>
  Boolean(
    windowObject &&
    !disabled &&
    !ANALYTICS_DISABLED_HOSTS.has(windowObject.location?.hostname) &&
    !windowObject.location?.hostname?.endsWith('.localhost') &&
    !isAuthCallback(windowObject.location?.pathname)
  )

export const createDeferredAnalyticsLoader = ({
  windowObject = typeof window !== 'undefined' ? window : null,
  disabled = import.meta.env.DEV,
  loadAnalytics = () => {
    if (
      typeof windowObject?.loadReyohohoAnalytics !== 'function' &&
      typeof windowObject?.loadReyohohoGoatCounter !== 'function'
    ) {
      return false
    }
    windowObject?.loadReyohohoAnalytics?.()
    windowObject?.loadReyohohoGoatCounter?.()
    return true
  }
} = {}) => {
  let armed = false
  let loaded = false
  let disposed = false
  let graceTimer = null
  let idleCallback = null
  let fallbackTimer = null

  const removeTriggers = () => {
    windowObject?.removeEventListener('load', onLoad)
    ANALYTICS_INTERACTIONS.forEach((event) =>
      windowObject?.removeEventListener(event, onInteraction, true)
    )
    if (graceTimer !== null) windowObject.clearTimeout(graceTimer)
    graceTimer = null
  }

  const cleanup = () => {
    removeTriggers()
    if (idleCallback !== null) windowObject.cancelIdleCallback(idleCallback)
    if (fallbackTimer !== null) windowObject.clearTimeout(fallbackTimer)
    idleCallback = null
    fallbackTimer = null
    windowObject?.removeEventListener('pagehide', onPageHide)
    windowObject?.removeEventListener('pageshow', schedule)
    armed = false
  }

  const load = () => {
    idleCallback = null
    fallbackTimer = null
    cleanup()
    if (!disposed && isAnalyticsAllowed(windowObject, disabled)) {
      loaded = loadAnalytics() === true
    }
  }

  const scheduleIdle = () => {
    if (!isAnalyticsAllowed(windowObject, disabled)) {
      cleanup()
      return
    }
    removeTriggers()
    if (typeof windowObject.requestIdleCallback === 'function') {
      idleCallback = windowObject.requestIdleCallback(load, { timeout: ANALYTICS_IDLE_TIMEOUT_MS })
    } else {
      fallbackTimer = windowObject.setTimeout(load, ANALYTICS_IDLE_FALLBACK_MS)
    }
  }

  const onLoad = () => {
    windowObject.removeEventListener('load', onLoad)
    if (graceTimer === null) {
      graceTimer = windowObject.setTimeout(scheduleIdle, ANALYTICS_LOAD_GRACE_MS)
    }
  }

  const onInteraction = (event) => {
    if (event.isTrusted) scheduleIdle()
  }

  const onPageHide = () => {
    cleanup()
    windowObject.addEventListener('pageshow', schedule, { once: true })
  }

  const schedule = () => {
    if (disposed || loaded) return false
    if (!isAnalyticsAllowed(windowObject, disabled)) {
      cleanup()
      return false
    }
    if (armed) return false
    armed = true
    windowObject.removeEventListener('pageshow', schedule)
    windowObject.addEventListener('pagehide', onPageHide)
    ANALYTICS_INTERACTIONS.forEach((event) =>
      windowObject.addEventListener(event, onInteraction, { passive: true, capture: true })
    )
    if (windowObject.document.readyState === 'complete') {
      onLoad()
    } else {
      windowObject.addEventListener('load', onLoad, { once: true })
    }
    return true
  }

  schedule.dispose = () => {
    disposed = true
    cleanup()
  }
  return schedule
}

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

const safePageViewUrl = (value, fallback = '') => {
  const normalized = normalizePageViewUrl(value)
  try {
    const url = new URL(normalized)
    return isAuthCallback(url.pathname) ? fallback : normalized
  } catch {
    return isAuthCallback(normalized.split('?')[0]) ? fallback : normalized
  }
}

export const createYandexPageViewSender = ({
  windowObject = typeof window !== 'undefined' ? window : null,
  counterId = configuredMetrikaId(),
  disabled = import.meta.env.DEV
} = {}) => {
  let initialPageCaptured = false

  const getMetrika = () => {
    if (typeof windowObject.ym !== 'function') {
      const metrika = (...args) => metrika.a.push(args)
      metrika.a = []
      metrika.l = Date.now()
      windowObject.ym = metrika
    }
    return windowObject.ym
  }

  const canSend = (page) =>
    isAnalyticsAllowed(windowObject, disabled) && counterId && safePageViewUrl(page?.url)

  const sendPageView = (page) => {
    if (!canSend(page)) return false
    try {
      getMetrika()(counterId, 'hit', safePageViewUrl(page.url), {
        title: page.title,
        referer: safePageViewUrl(page.referrer)
      })
    } catch (error) {
      console.warn('Yandex Metrica page view failed:', error)
    }
    return true
  }

  sendPageView.captureInitialPage = (page) => {
    if (initialPageCaptured || !canSend(page)) return false
    initialPageCaptured = true
    const initialUrl = safePageViewUrl(page.url)
    // Empty referrers fall back to document.referrer inside Metrica, so replace
    // sensitive auth referrers with a safe URL instead of an empty string.
    const initialReferrer = safePageViewUrl(
      page.referrer || windowObject.document?.referrer,
      initialUrl
    )
    const originalMetrika = getMetrika()

    // init has no title override. Use the supported hit title option and defer
    // this counter's automatic pageview to avoid counting the initial page twice.
    // The standard ym.a queue retains hits in order until GTM initializes it.
    const metrika = (...args) => {
      if (Number(args[0]) === counterId && args[1] === 'init') {
        args[2] = { ...args[2], defer: true, url: initialUrl, referrer: initialReferrer }
      }
      return originalMetrika(...args)
    }
    metrika.a = originalMetrika.a
    metrika.l = originalMetrika.l
    windowObject.ym = metrika
    return sendPageView({
      url: initialUrl,
      title: page.title ?? windowObject.document?.title,
      referrer: initialReferrer
    })
  }

  return sendPageView
}

export const createGoatCounterPageViewSender = ({
  windowObject = typeof window !== 'undefined' ? window : null,
  disabled = import.meta.env.DEV
} = {}) => {
  const pending = []

  const flush = () => {
    const goatcounter = windowObject?.goatcounter
    if (!isAnalyticsAllowed(windowObject, disabled) || typeof goatcounter?.count !== 'function') {
      return
    }
    delete goatcounter.reyohohoFlush
    while (pending.length) {
      const page = pending.shift()
      try {
        const url = new URL(page.url)
        goatcounter.count({
          path: url.pathname + url.search,
          title: page.title,
          referrer: safePageViewUrl(page.referrer),
          event: false
        })
      } catch (error) {
        console.warn('GoatCounter page view failed:', error)
      }
    }
  }

  const sendPageView = (page) => {
    if (!isAnalyticsAllowed(windowObject, disabled) || !safePageViewUrl(page?.url)) return false
    windowObject.goatcounter = windowObject.goatcounter || {}
    windowObject.goatcounter.reyohohoFlush = flush
    pending.push({ ...page })
    flush()
    return true
  }
  sendPageView.flush = flush
  return sendPageView
}

export const createSpaPageViewTracker = ({
  sendPageView,
  getPage,
  shouldSkip = () => false,
  automaticInitialPageView = true
}) => {
  let initialPageSeen = false
  let previousUrl = ''

  return (route) => {
    if (shouldSkip(route)) return false
    const page = getPage(route)
    const url = safePageViewUrl(page?.url)
    if (!url) return false
    if (url === previousUrl) {
      sendPageView.flush?.()
      return false
    }

    const trackedPage = {
      ...page,
      url,
      referrer: previousUrl || safePageViewUrl(page.referrer)
    }

    // Let the sender own the initial pageview across deferred startup.
    if (!initialPageSeen) {
      initialPageSeen = true
      previousUrl = url
      if (automaticInitialPageView) {
        sendPageView.captureInitialPage?.(trackedPage)
        return false
      }
    }

    previousUrl = url
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
