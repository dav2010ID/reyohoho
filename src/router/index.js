import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { routes } from './routes'
import { useMainStore } from '@/store/main'
import { handleHashNavigation } from '@/helpers/hashHandler'
import { useScrollTracking } from '@/composables/useScrollTracking'

const base = import.meta.env.VITE_BASE_URL || '/'
console.log(`base: ${base}`)
const { userHasScrolled, startTracking } = useScrollTracking()
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

export default router
