import { computed, ref } from 'vue'
import { showMessageToast } from '@/helpers/ui'
import { debugLog } from '@/utils/logger'

const DESKTOP_APP_URL = 'https://t.me/ReYohoho/126'
const DESKTOP_ONLY_MESSAGE = 'Доступно только в приложении ReYohoho Desktop'

export const usePlayerElectronControls = ({ isElectron, playerStore, playerIframe, kpId }) => {
  const mirrorCheckInterval = ref(null)
  const currentMirrorState = ref(false)
  const currentCompressorState = ref(false)
  const audioContext = ref(null)
  const compressorNode = ref(null)
  const mediaSource = ref(null)
  const gainNode = ref(null)
  const bypassGainNode = ref(null)
  const currentVideoElement = ref(null)

  const compressorEnabled = computed({
    get: () => playerStore.compressorEnabled,
    set: (value) => playerStore.updateCompressor(value)
  })

  const mirrorEnabled = computed({
    get: () => playerStore.mirrorEnabled,
    set: (value) => playerStore.updateMirror(value)
  })

  const showDesktopOnlyMessage = () => {
    showMessageToast(DESKTOP_ONLY_MESSAGE)
    window.open(DESKTOP_APP_URL, '_blank')
  }

  const initializeAudioContext = () => {
    try {
      if (!audioContext.value) {
        audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
      }

      if (!compressorNode.value) {
        compressorNode.value = audioContext.value.createDynamicsCompressor()
        compressorNode.value.threshold.value = -50
        compressorNode.value.knee.value = 40
        compressorNode.value.ratio.value = 12
        compressorNode.value.attack.value = 0
        compressorNode.value.release.value = 0.25

        gainNode.value = audioContext.value.createGain()
        bypassGainNode.value = audioContext.value.createGain()

        gainNode.value.gain.value = 0
        bypassGainNode.value.gain.value = 1

        compressorNode.value.connect(gainNode.value)
        gainNode.value.connect(audioContext.value.destination)
        bypassGainNode.value.connect(audioContext.value.destination)
      }

      return true
    } catch (error) {
      debugLog('Error initializing audio context:', error)
      return false
    }
  }

  const setupVideoAudio = async (video) => {
    try {
      if (!audioContext.value || currentVideoElement.value === video) return true

      const iframe = playerIframe.value
      const iframeSrc = iframe?.src || ''

      if (
        iframeSrc.includes('videoframe') ||
        iframeSrc.includes('kinoserial.net') ||
        iframeSrc.includes('allarknow')
      ) {
        debugLog('Player detected as unsupported for compressor:', iframeSrc)
        currentVideoElement.value = video
        mediaSource.value = null
        currentCompressorState.value = false

        if (isElectron.value) {
          window.electronAPI.showToast('Компрессор не поддерживается этим плеером')
        }
        return false
      }

      if (mediaSource.value) {
        try {
          mediaSource.value.disconnect()
        } catch {
          // ignore
        }
      }

      const attemptConnection = async (delay = 0) => {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        try {
          mediaSource.value = audioContext.value.createMediaElementSource(video)
          currentVideoElement.value = video

          mediaSource.value.connect(compressorNode.value)
          mediaSource.value.connect(bypassGainNode.value)

          debugLog(`Video audio setup completed (attempt with ${delay}ms delay)`)
          return true
        } catch (error) {
          if (error.name === 'InvalidStateError' && error.message.includes('already connected')) {
            debugLog(`MediaElementSource already connected (${delay}ms delay attempt)`)
            return false
          }
          throw error
        }
      }

      if (await attemptConnection(0)) return true
      if (await attemptConnection(100)) return true
      if (await attemptConnection(300)) return true
      if (await attemptConnection(800)) return true

      debugLog('Video element has internal audio processing, compressor not available for this player')
      currentVideoElement.value = video
      mediaSource.value = null
      currentCompressorState.value = false

      if (isElectron.value) {
        window.electronAPI.showToast('Компрессор не поддерживается этим плеером')
      }
      return false
    } catch (error) {
      debugLog('Error setting up video audio:', error)
      return false
    }
  }

  const applyCompressorEffect = async (enabled) => {
    if (!playerIframe.value) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      if (videos.length === 0) return

      const video = videos[0]

      if (!initializeAudioContext()) return

      const audioSetupSuccess = await setupVideoAudio(video)
      if (!audioSetupSuccess || !mediaSource.value) {
        debugLog('Compressor not available for this player')
        return
      }

      if (enabled && !currentCompressorState.value) {
        gainNode.value.gain.setValueAtTime(1, audioContext.value.currentTime)
        bypassGainNode.value.gain.setValueAtTime(0, audioContext.value.currentTime)
        currentCompressorState.value = true

        if (isElectron.value) {
          window.electronAPI.showToast('Компрессор включён')
        }
        debugLog('Compressor enabled')
      } else if (!enabled && currentCompressorState.value) {
        gainNode.value.gain.setValueAtTime(0, audioContext.value.currentTime)
        bypassGainNode.value.gain.setValueAtTime(1, audioContext.value.currentTime)
        currentCompressorState.value = false

        if (isElectron.value) {
          window.electronAPI.showToast('Компрессор отключён')
        }
        debugLog('Compressor disabled')
      }
    } catch (error) {
      debugLog('Compressor error:', error)
      if (isElectron.value) {
        window.electronAPI.showToast('Ошибка при включении компрессора')
      }
    }
  }

  const setBlur = (enabled) => {
    if (!playerIframe.value) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      const target = videos.length > 0 ? videos[0] : iframe
      target.style.filter = enabled ? 'blur(50px)' : ''
    } catch (error) {
      debugLog(`Error ${enabled ? 'enabling' : 'disabling'} blur:`, error)
    }
  }

  const enableBlur = () => setBlur(true)

  const disableBlur = () => setBlur(false)

  const toggleBlur = () => {
    if (!isElectron.value) {
      showDesktopOnlyMessage()
      return
    }

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      const target = videos.length > 0 ? videos[0] : iframe
      target.style.filter = target.style.filter.includes('blur') ? '' : 'blur(50px)'
    } catch (error) {
      debugLog('Error toggling blur:', error)
    }
  }

  const applyMirrorEffect = (enabled) => {
    if (!playerIframe.value) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      if (videos.length > 0) {
        videos.forEach((video) => {
          video.style.transform = enabled ? 'scaleX(-1)' : 'scaleX(1)'
        })

        currentMirrorState.value = enabled

        if (isElectron.value) {
          const message = enabled ? 'Зеркало включено' : 'Зеркало отключено'
          window.electronAPI.showToast(message)
        }
      }
    } catch {
      // ignore
    }
  }

  const toggleCompressor = () => {
    if (!isElectron.value) {
      showDesktopOnlyMessage()
      return
    }

    compressorEnabled.value = !compressorEnabled.value
    applyCompressorEffect(compressorEnabled.value)
  }

  const toggleMirror = () => {
    if (!isElectron.value) {
      showDesktopOnlyMessage()
      return
    }

    mirrorEnabled.value = !mirrorEnabled.value
    applyMirrorEffect(mirrorEnabled.value)
  }

  const startMirrorMonitoring = () => {
    if (mirrorCheckInterval.value) {
      clearInterval(mirrorCheckInterval.value)
    }

    mirrorCheckInterval.value = setInterval(() => {
      if (!playerIframe.value) return

      try {
        const iframe = playerIframe.value
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        if (!iframeDoc) return

        const videos = iframeDoc.querySelectorAll('video')
        if (videos.length > 0) {
          const video = videos[0]

          const transform = video.style.transform
          const isCurrentlyMirrored = transform === 'scaleX(-1)'

          if (mirrorEnabled.value && !isCurrentlyMirrored) {
            video.style.transform = 'scaleX(-1)'
            currentMirrorState.value = true
          } else if (!mirrorEnabled.value && isCurrentlyMirrored) {
            video.style.transform = 'scaleX(1)'
            currentMirrorState.value = false
          }

          if (currentVideoElement.value !== video) {
            currentVideoElement.value = null
            currentCompressorState.value = false

            if (compressorEnabled.value) {
              setTimeout(() => {
                applyCompressorEffect(true)
              }, 500)
            }
          } else if (compressorEnabled.value !== currentCompressorState.value && mediaSource.value) {
            debugLog('Compressor state mismatch, reapplying')
            applyCompressorEffect(compressorEnabled.value)
          }
        }
      } catch {
        // ignore
      }
    }, 1000)
  }

  const openAppLink = () => {
    const appUrl = `reyohoho://#${kpId.value}`
    try {
      window.location.href = appUrl
    } catch (error) {
      console.error('Ошибка при открытии ссылки:', error)
    }
  }

  const togglePiP = async () => {
    if (!isElectron.value) {
      showDesktopOnlyMessage()
      return
    }

    if (!playerIframe.value) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const video = iframeDoc.querySelector('video')
      if (!video) return

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      } else {
        showMessageToast('Ваш браузер не поддерживает режим "Картинка в картинке"')
      }
    } catch (error) {
      console.error('Error toggling PiP:', error)
      showMessageToast('Не удалось включить режим "Картинка в картинке"')
    }
  }

  const resetElectronPlaybackState = () => {
    currentMirrorState.value = false
    currentCompressorState.value = false
    currentVideoElement.value = null

    if (mirrorCheckInterval.value) {
      clearInterval(mirrorCheckInterval.value)
      mirrorCheckInterval.value = null
    }
  }

  const cleanupAudioContext = () => {
    try {
      if (mediaSource.value) {
        mediaSource.value.disconnect()
        mediaSource.value = null
      }
      if (audioContext.value) {
        audioContext.value.close()
        audioContext.value = null
      }
      compressorNode.value = null
      gainNode.value = null
      bypassGainNode.value = null
      currentVideoElement.value = null
      currentCompressorState.value = false
    } catch (error) {
      debugLog('Error cleaning up audio context:', error)
    }
  }

  const cleanupElectronControls = () => {
    resetElectronPlaybackState()
    cleanupAudioContext()

    delete window.toggleCompressor
    delete window.toggleMirror
  }

  return {
    compressorEnabled,
    mirrorEnabled,
    enableBlur,
    disableBlur,
    toggleBlur,
    toggleCompressor,
    toggleMirror,
    startMirrorMonitoring,
    openAppLink,
    togglePiP,
    resetElectronPlaybackState,
    cleanupElectronControls
  }
}
