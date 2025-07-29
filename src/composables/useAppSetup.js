import router from '@/router'
import { createPinia } from 'pinia'
import VueCookies from 'vue3-cookies'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { initYandexMetrika } from 'yandex-metrika-vue3'
import VueLazyload from 'vue-lazyload'
import { LAZY_LOADING_CONFIG } from '@/constants'
import jQuery from 'jquery'

export const useAppSetup = (app) => {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.provide('$', jQuery)
  app
    .use(VueLazyload, LAZY_LOADING_CONFIG)
    .use(VueCookies)
    .use(router)
    .use(pinia)
    .use(initYandexMetrika, {
      id: import.meta.env.VITE_YANDEX_METRIKA_ID,
      router: router,
      env: process.env.NODE_ENV
    })
  app.mount('#app')
}
