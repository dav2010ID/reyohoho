import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { routes } from './routes'
import { useMainStore } from '@/store/main'
import { handleHashNavigation } from '@/helpers/hashHandler'
import { useScrollTracking } from '@/composables/useScrollTracking'

const base = import.meta.env.VITE_BASE_URL || '/'

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

  if (attempt < 10) {
    setTimeout(() => trackGoatCounterPageView(to, attempt + 1), 200)
  }
}

export const routerOptions = {
  history: createWebHistory(base),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    const { userHasScrolled } = useScrollTracking()
    const mainStore = useMainStore()

    return new Promise((resolve) => {
      nextTick(() => {
        if (to.name === 'movie-info') {
          return resolve({ top: 0, behavior: 'smooth' })
        } else if (
          savedPosition &&
          mainStore.rememberScrollPosition &&
          !userHasScrolled.value &&
          (to.name === 'top-movies' || to.name === 'lists')
        ) {
          setTimeout(() => resolve(savedPosition), 1000)
        } else {
          resolve({ top: 0, behavior: 'smooth' })
        }
      })
    })
  }
}

export const installRouterGuards = (router, { isClient = typeof window !== 'undefined' } = {}) => {
  const { startTracking } = useScrollTracking()
  let hasTrackedInitialRoute = false

  router.beforeEach((to, _from, next) => {
    if (isClient) {
      document.title = to.meta.title || 'ReYohoho'
      startTracking()
    }

    if (to.hash) {
      handleHashNavigation(to, next)
    } else {
      next()
    }
  })

  if (isClient) {
    router.afterEach((to) => {
      if (!hasTrackedInitialRoute) {
        hasTrackedInitialRoute = true
        return
      }

      trackGoatCounterPageView(to)
    })
  }

  return router
}

export const createAppRouter = (options = {}) => installRouterGuards(createRouter(routerOptions), options)

export default createAppRouter()
