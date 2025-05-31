import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { routes } from './routes'

const base = import.meta.env.VITE_BASE_URL || '/'
console.log(`base: ${base}`)
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
    if (to.hash.startsWith('#/')) {
      const route = to.hash.substring(2)
      const routePath = route.split('?')[0]
      const queryString = route.includes('?') ? route.split('?')[1] : ''

      const queryParams = new URLSearchParams(queryString)
      const query = Object.fromEntries(queryParams)

      const targetPath = routePath || '/'
      next({ path: targetPath, query })
      return
    } else if (to.hash.startsWith('#search=')) {
      next()
    } else if (to.hash.startsWith('#imdb=')) {
      next()
    } else if (to.hash.startsWith('#shiki')) {
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
