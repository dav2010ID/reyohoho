import { computed, nextTick, ref } from 'vue'

const aspectRatios = ['16:9', '12:5', '4:3']
const THEATER_MODE_BODY_CLASS = 'theater-mode-active'

const getViewportPlayerHeight = () => {
  if (typeof window === 'undefined') return 720
  return window.innerHeight * (window.innerWidth < 700 ? 0.6 : 0.985)
}

const isMobileViewport = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(max-width: 700px)').matches || window.innerWidth < 700
}

export const usePlayerLayout = ({ mainStore, playerStore, containerRef, playerIframe }) => {
  const theaterMode = ref(false)
  const closeButtonVisible = ref(false)
  const closeButtonWasVisible = ref(false)
  const theaterModeCloseButtonTimeout = ref(null)
  // Fix: store centerPlayer timeout so it can be cancelled on unmount (memory-leak fix)
  const centerPlayerTimeout = ref(null)
  const maxPlayerHeightValue = ref(getViewportPlayerHeight())
  const theaterFullscreenActive = ref(false)

  const maxPlayerHeight = computed(() => `${maxPlayerHeightValue.value}px`)
  const dimmingEnabled = computed(() => mainStore.dimmingEnabled)

  const aspectRatio = computed({
    get: () => playerStore.aspectRatio,
    set: (value) => playerStore.updateAspectRatio(value)
  })

  const isCentered = computed({
    get: () => playerStore.isCentered,
    set: (value) => playerStore.updateCentering(value)
  })

  const updateScaleFactor = () => {
    if (theaterMode.value || !containerRef.value) return
    maxPlayerHeightValue.value = getViewportPlayerHeight()
  }

  const containerStyle = computed(() => {
    if (theaterMode.value) return {}
    const [w, h] = aspectRatio.value.split(':').map(Number)
    const maxWidth = maxPlayerHeightValue.value * (w / h)
    return {
      width: '100%',
      maxWidth: `${maxWidth}px`,
      maxHeight: maxPlayerHeight.value,
      margin: '0 auto',
      overflow: 'hidden'
    }
  })

  const iframeWrapperStyle = computed(() => {
    const [w, h] = aspectRatio.value.split(':').map(Number)
    return {
      position: 'relative',
      width: '100%',
      paddingTop: `${(h / w) * 100}%`
    }
  })

  const centerPlayer = () => {
    if (containerRef.value) {
      // Fix: cancel previous pending scroll to avoid stale calls after unmount
      if (centerPlayerTimeout.value) clearTimeout(centerPlayerTimeout.value)
      centerPlayerTimeout.value = setTimeout(() => {
        nextTick(() => {
          centerPlayerTimeout.value = null
          containerRef.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          })
        })
      }, 500)
    }
  }

  const showCloseButton = () => {
    if (theaterModeCloseButtonTimeout.value) {
      clearTimeout(theaterModeCloseButtonTimeout.value)
    }

    closeButtonWasVisible.value = true
    closeButtonVisible.value = true
    theaterModeCloseButtonTimeout.value = setTimeout(() => {
      closeButtonVisible.value = false
      theaterModeCloseButtonTimeout.value = null
    }, 4000)
  }

  const lockMobileLandscape = async () => {
    if (!isMobileViewport() || typeof document === 'undefined') return

    try {
      if (!document.fullscreenElement && containerRef.value?.requestFullscreen) {
        await containerRef.value.requestFullscreen()
        theaterFullscreenActive.value = true
      }
    } catch {
      theaterFullscreenActive.value = false
    }

    try {
      await window.screen?.orientation?.lock?.('landscape')
    } catch {
      // Browser support is inconsistent; theater mode should still work without orientation lock.
    }
  }

  const unlockMobileLandscape = async () => {
    try {
      window.screen?.orientation?.unlock?.()
    } catch {
      // Some browsers expose orientation but reject unlock outside fullscreen.
    }

    if (
      theaterFullscreenActive.value &&
      typeof document !== 'undefined' &&
      document.fullscreenElement &&
      document.exitFullscreen
    ) {
      try {
        await document.exitFullscreen()
      } catch {
        // Leaving theater mode must not depend on fullscreen API support.
      }
    }

    theaterFullscreenActive.value = false
  }

  const toggleTheaterMode = () => {
    // Fix: SSR guard — window/document are not available during server-side rendering
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    theaterMode.value = !theaterMode.value
    if (theaterMode.value) {
      window.addEventListener('mousemove', showCloseButton)
      document.addEventListener('keydown', onKeyDown)
      document.body.classList.add('no-scroll')
      document.body.classList.add(THEATER_MODE_BODY_CLASS)
      lockMobileLandscape()
      // Fix: use showCloseButton() instead of direct assignment so any stale
      // hide-timeout from a previous theater session is cleared first.
      showCloseButton()
    } else {
      window.removeEventListener('mousemove', showCloseButton)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('no-scroll')
      document.body.classList.remove(THEATER_MODE_BODY_CLASS)
      unlockMobileLandscape()
      // Fix: explicitly cancel the auto-hide timeout when exiting
      if (theaterModeCloseButtonTimeout.value) {
        clearTimeout(theaterModeCloseButtonTimeout.value)
        theaterModeCloseButtonTimeout.value = null
      }
      closeButtonVisible.value = false
    }

    nextTick(() => {
      centerPlayer()
      if (playerIframe.value) {
        playerIframe.value.focus()
      }
    })
  }

  const toggleDimming = () => {
    if (!theaterMode.value) {
      mainStore.toggleDimming()
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && theaterMode.value) {
      toggleTheaterMode()
    } else if (event.altKey && event.keyCode === 84) {
      toggleTheaterMode()
    }
  }

  const setAspectRatio = (ratio) => {
    aspectRatio.value = ratio
    setTimeout(() => {
      if (isCentered.value) centerPlayer()
    }, 310)
  }

  const cycleAspectRatio = () => {
    const currentIndex = aspectRatios.indexOf(aspectRatio.value)
    const nextIndex = (currentIndex + 1) % aspectRatios.length
    setAspectRatio(aspectRatios[nextIndex])
  }

  const cleanupPlayerLayout = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', showCloseButton)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('no-scroll')
      document.body.classList.remove(THEATER_MODE_BODY_CLASS)
    }
    unlockMobileLandscape()

    if (theaterModeCloseButtonTimeout.value) {
      clearTimeout(theaterModeCloseButtonTimeout.value)
      theaterModeCloseButtonTimeout.value = null
    }
    // Fix: cancel any pending centerPlayer scroll on unmount
    if (centerPlayerTimeout.value) {
      clearTimeout(centerPlayerTimeout.value)
      centerPlayerTimeout.value = null
    }
  }

  return {
    theaterMode,
    closeButtonVisible,
    closeButtonWasVisible,
    aspectRatio,
    isCentered,
    dimmingEnabled,
    containerStyle,
    iframeWrapperStyle,
    aspectRatios,
    updateScaleFactor,
    centerPlayer,
    toggleTheaterMode,
    toggleDimming,
    setAspectRatio,
    cycleAspectRatio,
    cleanupPlayerLayout
  }
}
