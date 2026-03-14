import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { ViteSSG } from 'vite-ssg'
import { registerSW } from 'virtual:pwa-register'
import { useThemeStore } from './store/theme'
import { useAppSetup } from './composables/useAppSetup'
import { routes } from './router/routes'
import App from './App.vue'
import { buildMoviePath, getAllMovieSeoEntries } from '@/utils/movieSeo'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.VITE_BASE_URL || '/' },
  ({ app, router, isClient }) => {
    useAppSetup(app, { router, isClient })

    if (isClient) {
      registerSW({ immediate: true })

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
  const moviePaths = getAllMovieSeoEntries().map((movie) => buildMoviePath(movie.kp_id, movie.slug))
  return [...new Set([...staticPaths, ...moviePaths])]
}
