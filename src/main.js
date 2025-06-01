import 'core-js/stable'
import jQuery from 'jquery'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import 'regenerator-runtime/runtime'
import { createApp } from 'vue'
import VueCookies from 'vue3-cookies'
import { initYandexMetrika } from 'yandex-metrika-vue3'
import VueLazyload from 'vue-lazyload'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './store/theme'

console.log(`App version: ${import.meta.env.VITE_APP_VERSION_FULL_VERSION}`)

const $ = jQuery
window.$ = $

window.addEventListener('vite:preloadError', (event) => {
  console.log(`vite:preloadError ${event}`)
  window.location.reload()
})

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(VueLazyload, {
  preLoad: 1.3,
  error: '/src/assets/image-no-poster.gif',
  attempt: 2,
  observer: true,
  observerOptions: {
    rootMargin: '0px',
    threshold: 0.1
  },
  filter: {
    progressive(listener) {
      const quality = 'q_auto,f_auto,w_auto,dpr_auto'
      listener.src = `${listener.src}?${quality}`
    }
  },
  adapter: {
    loaded({ el }) {
      el.classList.add('loaded')
      el.classList.remove('loading')
    },
    loading({ el }) {
      el.classList.add('loading')
    },
    error({ el }) {
      el.classList.add('error')
    }
  }
})

app
  .use(VueCookies)
  .use(router)
  .use(pinia)
  .use(initYandexMetrika, {
    id: import.meta.env.VITE_YANDEX_METRIKA_ID,
    router: router,
    env: process.env.NODE_ENV
  })
  .mount('#app')

const themeStore = useThemeStore()
themeStore.initTheme()
