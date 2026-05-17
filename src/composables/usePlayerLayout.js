import { computed, nextTick, ref } from 'vue'

const aspectRatios = ['16:9', '12:5', '4:3']

const getViewportPlayerHeight = () => {
  if (typeof window === 'undefined') return 720
  return window.innerHeight * (window.innerWidth < 700 ? 0.6 : 0.985)
}

export const usePlayerLayout = ({ mainStore, playerStore, containerRef, playerIframe }) => {
  const theaterMode = ref(false)
  const closeButtonVisible = ref(false)
  const theaterModeCloseButtonTimeout = ref(null)
  const maxPlayerHeightValue = ref(getViewportPlayerHeight())

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
      setTimeout(() => {
        nextTick(() => {
          containerRef.value.scrollIntoView({
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

    closeButtonVisible.value = true
    theaterModeCloseButtonTimeout.value = setTimeout(() => {
      closeButtonVisible.value = false
      theaterModeCloseButtonTimeout.value = null
    }, 4000)
  }

  const toggleTheaterMode = () => {
    theaterMode.value = !theaterMode.value
    if (theaterMode.value) {
      window.addEventListener('mousemove', showCloseButton)
      document.addEventListener('keydown', onKeyDown)
      document.body.classList.add('no-scroll')
    } else {
      window.removeEventListener('mousemove', showCloseButton)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('no-scroll')
    }

    closeButtonVisible.value = theaterMode.value
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
    window.removeEventListener('mousemove', showCloseButton)
    document.removeEventListener('keydown', onKeyDown)
    document.body.classList.remove('no-scroll')

    if (theaterModeCloseButtonTimeout.value) {
      clearTimeout(theaterModeCloseButtonTimeout.value)
      theaterModeCloseButtonTimeout.value = null
    }
  }

  return {
    theaterMode,
    closeButtonVisible,
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
