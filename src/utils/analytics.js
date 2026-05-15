export const trackAnalyticsEvent = (event, params = {}) => {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event,
    ...params
  })
}
