import { ViteSSG } from 'vite-ssg'
import { registerSW } from 'virtual:pwa-register'
import { useThemeStore } from './store/theme'
import { useAppSetup } from './composables/useAppSetup'
import { routes } from './router/routes'
import { installRouterGuards } from './router'
import { buildMoviePath, getPrerenderMovieSeoEntries } from './utils/movieSeo'
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.VITE_BASE_URL || '/' },
  ({ app, router, isClient }) => {
    installRouterGuards(router, { isClient })
    useAppSetup(app, { router, isClient })

    if (isClient) {
      if (import.meta.env.DEV && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister())
        })
      }

      const registerServiceWorker = () => registerSW({ immediate: true })

      if (!import.meta.env.DEV) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(registerServiceWorker, { timeout: 3000 })
        } else {
          window.addEventListener('load', registerServiceWorker, { once: true })
        }
      }

      window.addEventListener('vite:preloadError', (event) => {
        if (import.meta.env.DEV) {
          window.__LAST_VITE_PRELOAD_ERROR__ = String(event)
        }
        window.location.reload()
      })

      const themeStore = useThemeStore()
      themeStore.initTheme()
    }
  }
)

export const includedRoutes = async (paths) => {
  const staticPaths = paths.filter((path) => !path.includes(':'))
  const movieSeoEntries = await getPrerenderMovieSeoEntries()
  const moviePaths = movieSeoEntries.map((movie) =>
    buildMoviePath(movie.kp_id, movie.slug)
  )

  return Array.from(new Set([...staticPaths, ...moviePaths]))
}
