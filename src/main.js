import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { createApp } from 'vue'  // Import createApp from Vue
import App from './App.vue'
import router from './router' // Import the router
import VueCookies from 'vue3-cookies'
import store from './store/store'
import jQuery from 'jquery'
import { initYandexMetrika } from 'yandex-metrika-vue3'
const $ = jQuery
window.$ = $

const app = createApp(App)

app
  .use(VueCookies)
  .use(router)
  .use(store)
  .use(initYandexMetrika, {
    id: 94822173,
    router: router,
    env: process.env.NODE_ENV
  })
  .mount('#app')
