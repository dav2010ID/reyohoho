import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { routes } from './routes'
import { useMainStore } from '@/store/main'
import { handleHashNavigation } from '@/helpers/hashHandler'
import { useScrollTracking } from '@/composables/useScrollTracking'

const base = import.meta.env.VITE_BASE_URL || '/'
const { userHasScrolled, startTracking } = useScrollTracking()
let hasTrackedInitialRoute = false

const shouldSkipGoatCounterTracking = (to) => {
  const path = to?.path || ''

  return path === '/auth-success' || path === '/reyohoho/auth-success'
}

const trackGoatCounterPageView = (to, attempt = 0) => {
  if (typeof window === 'undefined') return
  if (shouldSkipGoatCounterTracking(to)) return

  const goatcounter = window.goatcounter
  if (goatcounter?.count) {
    goatcounter.count({
      path: to.fullPath,
      title: document.title,
      event: false
    })
    return
  }

  // GoatCounter script is async in index.html; short retries cover fast route changes.
  if (attempt < 10) {
    setTimeout(() => trackGoatCounterPageView(to, attempt + 1), 200)
  }
}

const router = createRouter({
  history: createWebHistory(base),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    const mainStore = useMainStore()

    return new Promise((resolve) => {
      nextTick(() => {
        if (to.name === 'movie-info') {
          return resolve({ top: 0, behavior: 'smooth' })
        } else if (
          savedPosition &&
          mainStore.rememberScrollPosition &&
          !userHasScrolled &&
          (to.name === 'top-movies' || to.name === 'lists')
        ) {
          setTimeout(() => {
            return resolve(savedPosition)
          }, 1000)
        } else {
          return resolve({ top: 0, behavior: 'smooth' })
        }
      })
    })
  }
})

router.beforeEach((to, _from, next) => {
  const title = to.meta.title || 'ReYohoho'
  document.title = title

  startTracking()

  if (to.hash) {
    handleHashNavigation(to, next)
  } else {
    next()
  }
})

router.afterEach((to) => {
  if (!hasTrackedInitialRoute) {
    hasTrackedInitialRoute = true
    return
  }

  trackGoatCounterPageView(to)
})

export default router
