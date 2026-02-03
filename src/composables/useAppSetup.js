import router from '@/router'
import { createPinia } from 'pinia'
import VueCookies from 'vue3-cookies'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
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
  app.mount('#app')
}
