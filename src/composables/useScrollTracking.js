import { ref } from 'vue'

const userHasScrolled = ref(false)
let scrollTimeoutId = null

export const useScrollTracking = () => {
  const handleScroll = () => {
    userHasScrolled.value = true

    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
    }

    scrollTimeoutId = setTimeout(() => {
      window.removeEventListener('scroll', handleScroll)
      scrollTimeoutId = null
    }, 100)
  }

  const startTracking = () => {
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
      scrollTimeoutId = null
    }
    window.removeEventListener('scroll', handleScroll)
    userHasScrolled.value = false
    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  const stopTracking = () => {
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
      scrollTimeoutId = null
    }
    window.removeEventListener('scroll', handleScroll)
  }

  return { userHasScrolled, startTracking, stopTracking }
}
