import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { registerSW } from 'virtual:pwa-register'
import { useThemeStore } from './store/theme'
import { useAppSetup } from './composables/useAppSetup'
import { createApp } from 'vue'
import App from './App.vue'

registerSW({ immediate: true })

window.addEventListener('vite:preloadError', (event) => {
  if (import.meta.env.DEV) {
    window.__LAST_VITE_PRELOAD_ERROR__ = String(event)
  }
  window.location.reload()
})

const app = createApp(App)

useAppSetup(app)

// Может перенести это в App.vue? Выглядит здесь не к месту после .mount
const themeStore = useThemeStore()
themeStore.initTheme()
