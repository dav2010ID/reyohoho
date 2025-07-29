export const useScrollTracking = () => {
  let userHasScrolled = false
  let scrollTimeoutId = null

  const handleScroll = () => {
    userHasScrolled = true

    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
    }

    scrollTimeoutId = setTimeout(() => {
      window.removeEventListener('scroll', handleScroll)
    }, 100)
  }

  const startTracking = () => {
    userHasScrolled = false
    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  const stopTracking = () => {
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
    }
    window.removeEventListener('scroll', handleScroll)
  }

  return { userHasScrolled, startTracking, stopTracking }
}
