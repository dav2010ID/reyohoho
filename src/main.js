import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { createApp } from 'vue'  // Import createApp from Vue
import App from './App.vue'
import router from './router' // Import the router
import VueCookies from 'vue3-cookies'
import store from './store/store'
import { createPinia } from 'pinia'
import jQuery from 'jquery'
import { initYandexMetrika } from 'yandex-metrika-vue3'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
const $ = jQuery
window.$ = $

const app = createApp(App)

const pinia = createPinia()

app
  .use(VueCookies)
  .use(router)
  .use(store)
  .use(pinia)
  .use(initYandexMetrika, {
    id: 94822173,
    router: router,
    env: process.env.NODE_ENV
  })
  .mount('#app')
