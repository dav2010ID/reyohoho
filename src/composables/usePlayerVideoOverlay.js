import { sceneSelection } from '@/utils/sceneSelection'
import { computed, watch } from 'vue'
import { debugLog } from '@/utils/logger'

export function usePlayerVideoOverlay({
  isElectron,
  playerStore,
  playerIframe,
  props,
  enableBlur,
  disableBlur,
  loadOverlay = () => import('@/utils/playerVideoOverlayRuntime')
}) {
  const videoOverlayEnabled2 = computed({
    get: () => playerStore.videoOverlayEnabled2,
    set: (value) => playerStore.updateVideoOverlay(value)
  })
  let mounted = false
  let disposed = false
  let playbackReady = false
  let generation = 0
  let failedGeneration = null
  let runtime = null
  let pending = null
  let timingsCheckInterval = null
  let lastTimingsCount = 0

  const selectedTimingsCount = () =>
    (Array.isArray(sceneSelection.overlayNudityTimings) ? sceneSelection.overlayNudityTimings.length : 0) +
    (Array.isArray(sceneSelection.selectedNudityTimings) ? sceneSelection.selectedNudityTimings.length : 0)
  const needsRuntime = () => videoOverlayEnabled2.value || selectedTimingsCount() > 0
  const releaseRuntime = () => {
    generation++
    pending = null
    runtime?.dispose()
    runtime = null
  }

  const ensureRuntime = () => {
    if (
      disposed ||
      !mounted ||
      !isElectron.value ||
      !playbackReady ||
      !playerIframe.value ||
      !needsRuntime() ||
      failedGeneration === generation
    )
      return Promise.resolve(null)
    if (runtime) return Promise.resolve(runtime)
    if (pending) return pending.promise

    const iframe = playerIframe.value
    const src = iframe.getAttribute('src')
    const attempt = { generation }
    pending = attempt
    attempt.promise = (async () => {
      let created = null
      try {
        const { createPlayerVideoOverlayRuntime } = await loadOverlay()
        if (
          disposed ||
          attempt.generation !== generation ||
          !needsRuntime() ||
          playerIframe.value !== iframe ||
          iframe.getAttribute('src') !== src
        )
          return null
        created = createPlayerVideoOverlayRuntime({
          isElectron,
          playerStore,
          playerIframe,
          props,
          enableBlur,
          disableBlur
        })
        created.start()
        runtime = created
        return runtime
      } catch (error) {
        created?.dispose()
        if (!disposed && attempt.generation === generation) {
          failedGeneration = generation
          debugLog('Error loading video overlay:', error)
        }
        return null
      } finally {
        if (pending === attempt) pending = null
      }
    })()
    return attempt.promise
  }

  const checkTimings = () => {
    const count = selectedTimingsCount()
    if (count !== lastTimingsCount) failedGeneration = null
    if (count > lastTimingsCount && !videoOverlayEnabled2.value) {
      videoOverlayEnabled2.value = true
      window.electronAPI?.showToast?.('Оверлей автоматически включён - добавлены тайминги')
    }
    lastTimingsCount = count
    if (needsRuntime()) void ensureRuntime()
    else if (runtime || pending) releaseRuntime()
  }
  const stopEnabledWatcher = watch(
    videoOverlayEnabled2,
    () => {
      failedGeneration = null
      if (needsRuntime()) void ensureRuntime()
      else releaseRuntime()
    },
    { flush: 'sync' }
  )

  return {
    videoOverlayEnabled2,
    toggleVideoOverlay() {
      videoOverlayEnabled2.value = !videoOverlayEnabled2.value
    },
    mount() {
      if (mounted || disposed) return
      mounted = true
      if (!isElectron.value) return
      // The scene tool owns these legacy globals and can be closed while selections remain.
      timingsCheckInterval = setInterval(checkTimings, 1000)
      checkTimings()
    },
    onIframeLoad() {
      if (disposed) return Promise.resolve(null)
      releaseRuntime()
      playbackReady = true
      failedGeneration = null
      return ensureRuntime()
    },
    resetPlayback() {
      playbackReady = false
      lastTimingsCount = 0
      failedGeneration = null
      releaseRuntime()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopEnabledWatcher()
      clearInterval(timingsCheckInterval)
      releaseRuntime()
    }
  }
}
