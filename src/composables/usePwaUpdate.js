import { ref, onMounted } from 'vue'
import { registerSW } from 'virtual:pwa-register'

export function usePwaUpdate() {
  const isUpdating = ref(false)
  const updateProgress = ref(0)
  const updateError = ref(null)

  let updateSW = null

  const simulateProgress = () => {
    return new Promise((resolve) => {
      updateProgress.value = 0
      const interval = setInterval(() => {
        updateProgress.value += Math.random() * 15 + 5
        if (updateProgress.value >= 95) {
          updateProgress.value = 100
          clearInterval(interval)
          setTimeout(resolve, 500)
        }
      }, 150)
    })
  }

  const startUpdate = async () => {
    if (!updateSW) return

    isUpdating.value = true
    updateError.value = null
    updateProgress.value = 0

    try {
      await simulateProgress()
      await updateSW(true)
    } catch (error) {
      console.error('PWA update failed:', error)
      updateError.value = 'Ошибка обновления'

      setTimeout(() => {
        isUpdating.value = false
        updateError.value = null
      }, 3000)
    }
  }

  const testUpdate = async () => {
    console.log('Testing PWA update process...')
    isUpdating.value = true
    updateError.value = null
    updateProgress.value = 0

    try {
      await simulateProgress()
      console.log('Test update completed successfully!')
      setTimeout(() => {
        isUpdating.value = false
      }, 1000)
    } catch (error) {
      console.error('Test update failed:', error)
      updateError.value = 'Ошибка тестового обновления'
      setTimeout(() => {
        isUpdating.value = false
        updateError.value = null
      }, 3000)
    }
  }

  const registerServiceWorker = () => {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('New version available, starting automatic update')
        startUpdate()
      },
      onOfflineReady() {
        console.log('PWA app ready to work offline')
      },
      onRegistered(r) {
        console.log('SW Registered: ' + r)
      },
      onRegisterError(error) {
        console.log('SW registration error', error)
      }
    })
  }

  onMounted(() => {
    registerServiceWorker()

    if (import.meta.env.DEV) {
      window.testPwaUpdate = testUpdate
      console.log('🔧 Development mode: Use window.testPwaUpdate() to test the update process')
    }
  })

  return {
    isUpdating,
    updateProgress,
    updateError,
    testUpdate
  }
}
