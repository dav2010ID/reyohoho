import { dialogFocus } from '@/utils/dialogFocus'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { useAuthStore } from '@/store/auth'

export const useAppSetup = (app, { isClient = typeof window !== 'undefined' } = {}) => {
  app.directive('dialog-focus', dialogFocus)
  const pinia = createPinia()
  if (isClient) {
    pinia.use(piniaPluginPersistedstate)
  }

  app.use(pinia)
  if (isClient) useAuthStore(pinia)

  return { pinia }
}
