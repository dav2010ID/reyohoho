import { useAuthStore } from '@/store/auth'
import { legacyMovieMethodAvailable } from '@/api/movieCapabilities'
import { getLegacyShikiId, handleHashNavigation } from '@/helpers/hashHandler'
import { buildMoviePath, getMovieSeoEntry } from '@/utils/movieSeo'
import {
  createDeferredAnalyticsLoader,
  createGoatCounterPageViewSender,
  createSpaPageViewTracker,
  createYandexPageViewSender,
  normalizePageViewUrl
} from '@/utils/analytics'

const analyticsRouters = new WeakSet()

const shouldSkipPageViewTracking = (to) => {
  const path = to?.path || ''

  return /\/auth-success\/?$/.test(path)
}

export const installRouterGuards = (router, { isClient = typeof window !== 'undefined' } = {}) => {
  router.beforeEach((to) => {
    const shikiLink =
      to.name === 'movie-info-shiki' ||
      (to.name === 'movie-info' && to.params.kp_id.startsWith('shiki')) ||
      (to.name === 'home' && getLegacyShikiId(to.hash))
    const imdbLink = to.name === 'home' && to.hash.startsWith('#imdb=')
    if (
      (shikiLink && !legacyMovieMethodAvailable('getShikiInfo')) ||
      (imdbLink && !legacyMovieMethodAvailable('getKpIDfromIMDB'))
    ) {
      return { name: 'Settings', query: { tab: 'api', unavailable: shikiLink ? 'shiki' : 'imdb' } }
    }
    if (to.name === 'auth-success' && Object.hasOwn(to.query, 'token')) {
      const query = { ...to.query }
      delete query.token
      return { path: to.path, query, hash: to.hash, replace: true }
    }
    if (to.meta?.requiresAuth) {
      const authStore = useAuthStore()

      if (!authStore.isAuthenticated) {
        return {
          name: 'login',
          query: {
            redirect: to.fullPath
          }
        }
      }
    }

    if (to.name === 'movie-info' && to.params?.kp_id) {
      const entry = getMovieSeoEntry(to.params.kp_id)
      const currentSlug = String(to.params.slug || '').trim()

      if (entry?.slug && currentSlug !== entry.slug) {
        return {
          path: buildMoviePath(to.params.kp_id, entry.slug),
          query: to.query,
          hash: to.hash,
          replace: true
        }
      }
    }

    if (isClient) {
      document.title = to.meta.title || 'ReYohoho'
    }

    if (to.hash) {
      return handleHashNavigation(to)
    }

    return true
  })

  if (isClient && !analyticsRouters.has(router)) {
    analyticsRouters.add(router)
    const scheduleAnalyticsLoad = createDeferredAnalyticsLoader()
    const getPage = () => ({
      url: normalizePageViewUrl(window.location.href),
      title: document.title,
      referrer: document.referrer
    })
    const trackYandexPageView = createSpaPageViewTracker({
      sendPageView: createYandexPageViewSender(),
      getPage,
      shouldSkip: shouldSkipPageViewTracking
    })
    const trackGoatCounterPageView = createSpaPageViewTracker({
      sendPageView: createGoatCounterPageViewSender(),
      getPage,
      automaticInitialPageView: false,
      shouldSkip: shouldSkipPageViewTracking
    })

    router.afterEach((to, _from, failure) => {
      if (failure) return
      trackGoatCounterPageView(to)
      trackYandexPageView(to)
      scheduleAnalyticsLoad()
    })
  }

  return router
}
