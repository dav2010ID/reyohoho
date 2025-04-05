import 'core-js/stable'
import jQuery from 'jquery'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import 'regenerator-runtime/runtime'
import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue' // Import createApp from Vue
import VueCookies from 'vue3-cookies'
import { initYandexMetrika } from 'yandex-metrika-vue3'
import App from './App.vue'
import router from './router' // Import the router
import Bugsnag from '@bugsnag/js'
import BugsnagPluginVue from '@bugsnag/plugin-vue'
import BugsnagPerformance from '@bugsnag/browser-performance'

console.log(`App version: ${import.meta.env.VITE_APP_VERSION_FULL_VERSION}`)

registerSW({ immediate: true })
const $ = jQuery
window.$ = $

window.addEventListener('vite:preloadError', (event) => {
  console.log(`vite:preloadError ${event}`)
  window.location.reload()
})

Bugsnag.start({
  appVersion: import.meta.env.VITE_APP_VERSION_FULL_VERSION,
  apiKey: import.meta.env.VITE_BUGSNAG_API_KEY,
  plugins: [new BugsnagPluginVue()]
})
BugsnagPerformance.start({
  appVersion: import.meta.env.VITE_APP_VERSION_FULL_VERSION,
  apiKey: import.meta.env.VITE_BUGSNAG_API_KEY
})
const bugsnagVue = Bugsnag.getPlugin('vue')

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app
  .use(bugsnagVue)
  .use(VueCookies)
  .use(router)
  .use(pinia)
  .use(initYandexMetrika, {
    id: import.meta.env.VITE_YANDEX_METRIKA_ID,
    router: router,
    env: process.env.NODE_ENV
  })
  .mount('#app')
