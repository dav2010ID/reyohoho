import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import VueCookies from 'vue3-cookies'
import store from './store/store'
import { createPinia } from 'pinia'
import jQuery from 'jquery'
import { initYandexMetrika } from 'yandex-metrika-vue3'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
const $ = jQuery
window.$ = $

window.addEventListener('vite:preloadError', (event) => {
  console.log(`vite:preloadError ${event}`)
  window.location.reload()
})

const app = createApp(App)

const pinia = createPinia()

app
  .use(VueCookies)
  .use(router)
  .use(store)
  .use(pinia)
  .use(initYandexMetrika, {
    id: import.meta.env.VITE_YANDEX_METRIKA_ID,
    router: router,
    env: process.env.NODE_ENV
  })
  .mount('#app')
