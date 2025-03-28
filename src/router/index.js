import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { routes } from './routes'

const base = import.meta.env.VITE_BASE_URL || '/'

const router = createRouter({
  history: createWebHistory(base),
  routes,
  scrollBehavior(to) {
    return new Promise((resolve) => {
      nextTick(() => {
        if (to.name === 'movie-info') resolve({ top: 0, behavior: 'smooth' })
      })
    })
  }
})

router.beforeEach((to, from, next) => {
  const title = to.meta.title || 'ReYohoho'
  document.title = title

  if (to.hash) {
    if (to.hash.startsWith('#search=')) {
      next()
    } else {
      const hash = to.hash.slice(1)
      next({ path: `/movie/${hash}` })
    }
  } else {
    next()
  }
})

export default router
