import { sceneSelection } from '@/utils/sceneSelection'
import { computed, ref, watch } from 'vue'

import { parseTimingTextToSeconds, formatSecondsToTime } from '@/utils/dateUtils'

import { debugLog } from '@/utils/logger'

import {
  applyOverlayButtonHoverStyle,
  applyOverlayProgressBackgroundStyle,
  applyOverlayTimingsBackgroundStyle,
  applyOverlayTitleBackgroundStyle,
  applyOverlayVisibilityStyle,
  applySettingsButtonHoverStyle,
  getControlsContainerStyle,
  getDurationProgressMarkup,
  getMainInfoStyle,
  getMovieTitleStyle,
  getOverlayBaseStyle,
  getOverlayButtonStyle,
  getOverlayPositionStyle,
  getOverlaySettingsMarkup,
  getSettingsModalContentStyle,
  getSettingsModalStyle,
  getTimingChipStyle,
  getTimingsListStyle,
  getTimingsContentStyle,
  getTimingsPanelStyle,
  getVideoProgressStyle
} from '@/utils/playerOverlayStyles'

export function createPlayerVideoOverlayRuntime({
  isElectron,
  playerStore,
  playerIframe,
  props,
  enableBlur,
  disableBlur
}) {
  let videoPositionInterval = null
  const timeouts = new Set()
  const overlayIntervals = new Set()
  const overlayListeners = new Set()
  const stopWatchers = []
  let disposed = false
  let settingsModal = null
  let blurApplied = false

  const schedule = (callback, delay) => {
    const timer = setTimeout(() => {
      timeouts.delete(timer)
      if (!disposed) callback()
    }, delay)
    timeouts.add(timer)
    return timer
  }
  const cancelTimeout = (timer) => {
    clearTimeout(timer)
    timeouts.delete(timer)
  }
  const repeat = (callback, delay) => {
    const timer = setInterval(() => {
      if (!disposed) callback()
    }, delay)
    overlayIntervals.add(timer)
    return timer
  }
  const cancelInterval = (timer) => {
    clearInterval(timer)
    overlayIntervals.delete(timer)
  }
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler)
    overlayListeners.add(() => target.removeEventListener(event, handler))
  }

  const videoOverlayEnabled2 = computed({
    get: () => playerStore.videoOverlayEnabled2,
    set: (value) => playerStore.updateVideoOverlay(value)
  })

  const overlaySettings = computed({
    get: () => playerStore.overlaySettings,
    set: (value) => playerStore.updateOverlaySettings(value)
  })
  const currentVideoTime = ref(0)
  const totalVideoDuration = ref(0)
  const activeTimingTexts = ref([])
  const hasActiveTimings = ref(false)
  const videoOverlayManuallyHidden = ref(false)
  let hideTimingsTimeout = null

  const currentOverlayElement = ref(null)
  const overlayControlsTimeout = ref(null)
  const overlayCreationInProgress = ref(false)

  const shouldRenderVideoOverlay = () => {
    return (
      videoOverlayEnabled2.value && (!videoOverlayManuallyHidden.value || hasActiveTimings.value)
    )
  }

  const getIframeFullscreenElement = (iframeDoc) => {
    return (
      iframeDoc?.fullscreenElement ||
      iframeDoc?.webkitFullscreenElement ||
      iframeDoc?.mozFullScreenElement ||
      iframeDoc?.msFullscreenElement ||
      null
    )
  }

  const isIframeVideoFullscreen = (iframeDoc, video) => {
    const fullscreenElement = getIframeFullscreenElement(iframeDoc)

    return (
      fullscreenElement === video ||
      video?.webkitDisplayingFullscreen ||
      (video?.offsetWidth === window.screen.width && video?.offsetHeight === window.screen.height)
    )
  }

  const applyManualHiddenOverlayState = () => {
    const overlay = currentOverlayElement.value
    if (!overlay || !videoOverlayManuallyHidden.value || hasActiveTimings.value) {
      return false
    }

    const mainInfo = overlay.children[0]
    const timingsPanel = overlay.children[1]
    const controlsContainer = overlay.children[2]

    if (mainInfo) {
      mainInfo.style.opacity = '0'
    }

    if (timingsPanel) {
      applyOverlayVisibilityStyle(timingsPanel, false)
    }

    if (controlsContainer) {
      applyOverlayVisibilityStyle(controlsContainer, false)
    }

    cancelTimeout(hideTimingsTimeout)
    hideTimingsTimeout = null
    cancelTimeout(overlayControlsTimeout.value)
    overlayControlsTimeout.value = null

    return true
  }

  const startVideoPositionMonitoring = (isDebug = false) => {
    if (disposed || !isElectron.value) return

    clearInterval(videoPositionInterval)

    let blurIntervals = []

    function updateBlurIntervals() {
      blurIntervals = []
      if (overlaySettings.value.autoBlurTimings === false) return

      const selectedTimingIds = new Set(
        [
          ...(Array.isArray(sceneSelection.selectedNudityTimings) ? sceneSelection.selectedNudityTimings : []),
          ...(Array.isArray(sceneSelection.overlayNudityTimings) ? sceneSelection.overlayNudityTimings : [])
        ].map((id) => String(id))
      )

      if (selectedTimingIds.size > 0 && props.movieInfo?.nudity_timings) {
        for (const timing of props.movieInfo.nudity_timings) {
          if (selectedTimingIds.has(String(timing.id))) {
            const parsedRanges = parseTimingTextToSeconds(timing.timing_text)
            if (parsedRanges && parsedRanges.length > 0) {
              blurIntervals.push(...parsedRanges)
            }
          }
        }
      }
    }

    updateBlurIntervals()

    videoPositionInterval = setInterval(() => {
      if (disposed || !playerIframe.value) return

      updateBlurIntervals()

      try {
        const iframe = playerIframe.value
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        if (!iframeDoc) return

        const videos = iframeDoc.querySelectorAll('video')
        if (videos.length > 0) {
          const video = videos[0]

          currentVideoTime.value = video.currentTime || 0
          totalVideoDuration.value = video.duration || 0

          ensureVideoOverlay()

          if (isElectron.value && props.movieInfo?.nudity_timings) {
            const currentTime = video.currentTime
            const selectedTimings = []
            const activeTimingIds = []

            if (
              sceneSelection.overlayNudityTimings &&
              Array.isArray(sceneSelection.overlayNudityTimings) &&
              sceneSelection.overlayNudityTimings.length > 0
            ) {
              for (const timing of props.movieInfo.nudity_timings) {
                if (sceneSelection.overlayNudityTimings.includes(timing.id)) {
                  const parsedRanges = parseTimingTextToSeconds(timing.timing_text)

                  if (parsedRanges && parsedRanges.length > 0) {
                    const intervals = []

                    for (const [start, end] of parsedRanges) {
                      let status = 'normal'
                      if (currentTime >= start && currentTime <= end) {
                        status = 'active'
                        activeTimingIds.push(timing.id)
                      } else if (start > currentTime && start - currentTime <= 5) {
                        status = 'upcoming'
                      }

                      intervals.push({
                        text: `[${formatSecondsToTime(start)}-${formatSecondsToTime(end)}]`,
                        status: status
                      })
                    }

                    selectedTimings.push({
                      id: timing.id,
                      intervals: intervals
                    })
                  }
                }
              }
            }

            activeTimingTexts.value = selectedTimings
            hasActiveTimings.value =
              activeTimingIds.length > 0 ||
              selectedTimings.some((timing) =>
                timing.intervals.some((interval) => interval.status === 'upcoming')
              )
          }

          if (
            isElectron.value &&
            currentOverlayElement.value &&
            videoOverlayManuallyHidden.value &&
            !hasActiveTimings.value
          ) {
            applyManualHiddenOverlayState()
          }

          if (hasActiveTimings.value) ensureVideoOverlay()

          if (isElectron.value && currentOverlayElement.value && shouldRenderVideoOverlay()) {
            updateVideoOverlay()
          }

          if (!video.paused) {
            const currentTime = video.currentTime
            const duration = video.duration
            const progress = duration > 0 ? (currentTime / duration) * 100 : 0

            if (isDebug) {
              debugLog(
                `Video position: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s (${progress.toFixed(1)}%)`
              )

              if (blurIntervals.length > 0) {
                const activeIntervals = blurIntervals
                  .map(
                    ([start, end]) => `${formatSecondsToTime(start)} - ${formatSecondsToTime(end)}`
                  )
                  .join(', ')
                debugLog(`Active blur intervals: [${activeIntervals}]`)
              }
            }

            let shouldBlur = false
            for (const [start, end] of blurIntervals) {
              if (currentTime >= start && currentTime <= end) {
                shouldBlur = true
                break
              }
            }

            if (shouldBlur && !blurApplied && isElectron.value) {
              enableBlur()
              blurApplied = true
              debugLog('Blur applied at', currentTime.toFixed(2), 'seconds')
            } else if (!shouldBlur && blurApplied) {
              disableBlur()
              blurApplied = false
              debugLog('Blur removed at', currentTime.toFixed(2), 'seconds')
            }
          }
        }
      } catch (error) {
        debugLog('Error monitoring video position:', error)
      }
    }, 100)
  }

  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }

      const iframe = playerIframe.value
      if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        if (iframeDoc) {
          if (iframeDoc.exitFullscreen) {
            iframeDoc.exitFullscreen()
          } else if (iframeDoc.webkitExitFullscreen) {
            iframeDoc.webkitExitFullscreen()
          } else if (iframeDoc.mozCancelFullScreen) {
            iframeDoc.mozCancelFullScreen()
          } else if (iframeDoc.msExitFullscreen) {
            iframeDoc.msExitFullscreen()
          }

          const video = iframeDoc.querySelector('video')
          if (video) {
            if (video.webkitExitFullscreen) {
              video.webkitExitFullscreen()
            } else if (video.exitFullscreen) {
              video.exitFullscreen()
            }
          }
        }
      }
    } catch (error) {
      debugLog('Error exiting fullscreen:', error)
    }
  }

  const showOverlaySettings = () => {
    if (!isElectron.value) return

    const iframe = playerIframe.value
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (!iframeDoc) return

    if (iframeDoc.getElementById('overlay-settings-modal')) return

    const settings = overlaySettings.value

    const modal = iframeDoc.createElement('div')
    modal.id = 'overlay-settings-modal'
    settingsModal = modal
    modal.style.cssText = getSettingsModalStyle()

    const modalContent = iframeDoc.createElement('div')
    modalContent.style.cssText = getSettingsModalContentStyle()

    modalContent.innerHTML = getOverlaySettingsMarkup(settings)
    ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      modalContent.addEventListener(eventType, (e) => {
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })

    modal.appendChild(modalContent)

    modal.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (e.target === modal) {
        modal.remove()
      }
    })
    ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      modal.addEventListener(eventType, (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })

    modalContent.querySelector('#saveSettings').addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const newSettings = {
        showTitle: modalContent.querySelector('#showTitle').checked,
        showDuration2: modalContent.querySelector('#showDuration').checked,
        showBackground: modalContent.querySelector('#showBackground').checked,
        showTimingsOnMouseMove: modalContent.querySelector('#showTimingsOnMouseMove').checked,
        highlightTimings: modalContent.querySelector('#highlightTimings').checked,
        autoBlurTimings: modalContent.querySelector('#autoBlurTimings').checked
      }
      overlaySettings.value = newSettings
      window.electronAPI?.showToast('Настройки оверлея сохранены')
      modal.remove()
    })

    modalContent.querySelector('#cancelSettings').addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      modal.remove()
    })

    const buttons = modalContent.querySelectorAll('button')
    buttons.forEach((button) => {
      button.addEventListener('mouseenter', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        applySettingsButtonHoverStyle(button, true)
      })
      button.addEventListener('mouseleave', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        applySettingsButtonHoverStyle(button, false)
      })
      ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
        button.addEventListener(eventType, (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        })
      })
    })

    const checkboxes = modalContent.querySelectorAll('input[type="checkbox"]')
    const labels = modalContent.querySelectorAll('label')

    checkboxes.forEach((checkbox) => {
      ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach(
        (eventType) => {
          checkbox.addEventListener(eventType, (e) => {
            if (eventType !== 'click') {
              e.preventDefault()
              e.stopPropagation()
              e.stopImmediatePropagation()
            } else {
              e.stopPropagation()
            }
          })
        }
      )
    })

    labels.forEach((label) => {
      ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
        label.addEventListener(eventType, (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        })
      })
    })

    iframeDoc.body.appendChild(modal)
  }

  const createVideoOverlay = (iframeDoc, video) => {
    if (!shouldRenderVideoOverlay()) {
      return
    }
    if (currentOverlayElement.value) {
      return
    }
    if (overlayCreationInProgress.value) {
      return
    }

    overlayCreationInProgress.value = true

    const overlay = iframeDoc.createElement('div')
    overlay.id = 'reyohoho-video-overlay'
    currentOverlayElement.value = overlay

    let applyOverlayStyles = () => {
      overlay.style.cssText = getOverlayBaseStyle()
    }

    const mainInfo = iframeDoc.createElement('div')
    mainInfo.style.cssText = getMainInfoStyle()

    const movieTitle = iframeDoc.createElement('div')
    const initialFontSize = overlaySettings.value.fontSize || 18

    movieTitle.style.cssText = getMovieTitleStyle({
      fontSize: initialFontSize,
      showBackground: overlaySettings.value.showBackground
    })

    const videoProgress = iframeDoc.createElement('div')
    videoProgress.style.cssText = getVideoProgressStyle({
      fontSize: initialFontSize,
      showBackground: overlaySettings.value.showBackground
    })

    const timingsPanel = iframeDoc.createElement('div')
    timingsPanel.style.cssText = getTimingsPanelStyle({
      showBackground: overlaySettings.value.showBackground
    })

    const timingsContent = iframeDoc.createElement('div')
    timingsContent.style.cssText = getTimingsContentStyle({ fontSize: initialFontSize })

    const controlsContainer = iframeDoc.createElement('div')
    controlsContainer.style.cssText = getControlsContainerStyle()

    const settingsBtn = iframeDoc.createElement('button')
    settingsBtn.style.cssText = getOverlayButtonStyle()
    settingsBtn.innerHTML = '⚙️'
    settingsBtn.title = 'Настройки оверлея'

    const fontDecreaseBtn = iframeDoc.createElement('button')
    fontDecreaseBtn.style.cssText = getOverlayButtonStyle({ fontSize: 15, fontWeight: '700' })
    fontDecreaseBtn.innerHTML = 'A-'
    fontDecreaseBtn.title = 'Уменьшить шрифт'

    const fontIncreaseBtn = iframeDoc.createElement('button')
    fontIncreaseBtn.style.cssText = getOverlayButtonStyle({ fontSize: 15, fontWeight: '700' })
    fontIncreaseBtn.innerHTML = 'A+'
    fontIncreaseBtn.title = 'Увеличить шрифт'

    const toggleBtn = iframeDoc.createElement('button')
    toggleBtn.style.cssText = getOverlayButtonStyle()
    toggleBtn.innerHTML = '👁️'
    toggleBtn.title = 'Отключить оверлей'

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      videoOverlayManuallyHidden.value = true
      applyManualHiddenOverlayState()
    })

    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()

      exitFullscreen()

      schedule(() => {
        showOverlaySettings()
      }, 100)
    })

    fontDecreaseBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const currentSize = overlaySettings.value.fontSize || 18
      if (currentSize > 10) {
        overlaySettings.value = { ...overlaySettings.value, fontSize: currentSize - 2 }
      }
    })

    fontIncreaseBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const currentSize = overlaySettings.value.fontSize || 18
      if (currentSize < 36) {
        overlaySettings.value = { ...overlaySettings.value, fontSize: currentSize + 2 }
      }
    })
    ;[settingsBtn, toggleBtn, fontDecreaseBtn, fontIncreaseBtn].forEach((btn) => {
      btn.addEventListener('mouseenter', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        applyOverlayButtonHoverStyle(btn, true)
      })
      btn.addEventListener('mouseleave', (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        applyOverlayButtonHoverStyle(btn, false)
      })
      ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
        btn.addEventListener(eventType, (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        })
      })
    })
    ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      controlsContainer.addEventListener(eventType, (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })

    controlsContainer.appendChild(fontDecreaseBtn)
    controlsContainer.appendChild(fontIncreaseBtn)
    controlsContainer.appendChild(settingsBtn)
    controlsContainer.appendChild(toggleBtn)

    timingsPanel.appendChild(timingsContent)

    mainInfo.appendChild(movieTitle)
    mainInfo.appendChild(videoProgress)

    overlay.appendChild(mainInfo)
    overlay.appendChild(timingsPanel)
    overlay.appendChild(controlsContainer)

    controlsContainer.style.transition = 'opacity 0.3s ease, visibility 0.3s ease'
    applyOverlayVisibilityStyle(controlsContainer, false)

    mainInfo.style.transition = 'opacity 0.3s ease'
    let hideMainInfoTimeout = null

    const handleMouseMove = () => {
      if (applyManualHiddenOverlayState()) {
        return
      }

      applyOverlayVisibilityStyle(controlsContainer, true)
      mainInfo.style.opacity = '0'

      if (overlaySettings.value.showTimingsOnMouseMove && activeTimingTexts.value.length > 0) {
        applyOverlayVisibilityStyle(timingsPanel, true)
        cancelTimeout(hideTimingsTimeout)
        hideTimingsTimeout = null

        if (!hasActiveTimings.value) {
          hideTimingsTimeout = schedule(() => {
            applyOverlayVisibilityStyle(timingsPanel, false)
            hideTimingsTimeout = null
          }, 3000)
        }
      }

      cancelTimeout(overlayControlsTimeout.value)
      cancelTimeout(hideMainInfoTimeout)

      overlayControlsTimeout.value = schedule(() => {
        applyOverlayVisibilityStyle(controlsContainer, false)
      }, 3000)

      hideMainInfoTimeout = schedule(() => {
        mainInfo.style.opacity = '1'
      }, 2000)
    }

    listen(iframeDoc, 'mousemove', handleMouseMove)

    overlay.addEventListener('mouseenter', () => {
      if (applyManualHiddenOverlayState()) {
        return
      }

      applyOverlayVisibilityStyle(controlsContainer, true)
      mainInfo.style.opacity = '0'
      cancelTimeout(hideMainInfoTimeout)
    })

    overlay.addEventListener('mouseleave', () => {
      cancelTimeout(overlayControlsTimeout.value)
      cancelTimeout(hideMainInfoTimeout)
      applyOverlayVisibilityStyle(controlsContainer, false)
      mainInfo.style.opacity = '1'
    })

    overlay._mouseHandler = handleMouseMove

    const findBestContainer = (videoElement) => {
      const fullscreenElement = getIframeFullscreenElement(iframeDoc)
      const isFullscreen = isIframeVideoFullscreen(iframeDoc, videoElement)

      if (isFullscreen) {
        return iframeDoc.body || iframeDoc.documentElement
      }

      if (fullscreenElement && fullscreenElement !== videoElement) {
        return fullscreenElement
      }

      let container = videoElement.parentNode
      let attempts = 0
      const maxAttempts = 5

      while (container?.nodeType === 1 && attempts < maxAttempts) {
        const computedStyle = iframeDoc.defaultView.getComputedStyle(container)
        const rect = container.getBoundingClientRect()

        if (
          rect.width > 0 &&
          rect.height > 0 &&
          (computedStyle.position === 'relative' ||
            computedStyle.position === 'absolute' ||
            computedStyle.position === 'fixed' ||
            container.tagName === 'BODY')
        ) {
          return container
        }

        container = container.parentNode
        attempts++
      }

      return videoElement.parentElement || iframeDoc.body
    }

    const targetContainer = findBestContainer(video)

    overlay._targetContainer = targetContainer
    overlay._videoElement = video

    const applyOverlayStylesUpdated = () => {
      const video = overlay._videoElement
      const container = overlay._targetContainer

      const fullscreenElement = getIframeFullscreenElement(iframeDoc)
      const isFullscreen = isIframeVideoFullscreen(iframeDoc, video)

      if (isFullscreen) {
        overlay.style.cssText = getOverlayPositionStyle({ fullscreen: true })
      } else if (fullscreenElement) {
        overlay.style.cssText = getOverlayPositionStyle({
          fullscreen: false,
          top: 0,
          left: 0,
          width:
            fullscreenElement.clientWidth || fullscreenElement.offsetWidth || window.innerWidth,
          height:
            fullscreenElement.clientHeight || fullscreenElement.offsetHeight || window.innerHeight
        })
      } else {
        const videoStyle = iframeDoc.defaultView.getComputedStyle(video)
        const containerRect = container.getBoundingClientRect()

        const videoWidth =
          video.offsetWidth || video.clientWidth || parseFloat(videoStyle.width) || 0
        const videoHeight =
          video.offsetHeight || video.clientHeight || parseFloat(videoStyle.height) || 0

        const videoRect = video.getBoundingClientRect()
        const relativeTop = videoRect.top - containerRect.top + container.scrollTop
        const relativeLeft = videoRect.left - containerRect.left + container.scrollLeft

        overlay.style.cssText = getOverlayPositionStyle({
          fullscreen: false,
          top: relativeTop,
          left: relativeLeft,
          width: videoWidth,
          height: videoHeight
        })
      }
    }

    applyOverlayStyles = applyOverlayStylesUpdated

    video.style.position = 'relative'
    if (targetContainer.style.position === '' || targetContainer.style.position === 'static') {
      targetContainer.style.position = 'relative'
    }

    targetContainer.appendChild(overlay)

    applyOverlayStyles()

    currentOverlayElement.value = overlay
    overlayCreationInProgress.value = false

    const overlayMonitorInterval = repeat(() => {
      if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
        cancelInterval(overlayMonitorInterval)
        return
      }

      if (!iframeDoc.body.contains(overlay)) {
        try {
          const videos = iframeDoc.querySelectorAll('video')
          if (videos.length > 0) {
            const newVideo = videos[0]

            overlay._videoElement = newVideo

            const targetContainer = findBestContainer(newVideo)
            overlay._targetContainer = targetContainer
            targetContainer.appendChild(overlay)
            applyOverlayStyles()

            if (overlay._mouseHandler) {
              iframeDoc.removeEventListener('mousemove', overlay._mouseHandler)
              iframeDoc.addEventListener('mousemove', overlay._mouseHandler)
            }
          }
        } catch (e) {
          debugLog('Error re-adding overlay to DOM:', e)
        }
      }

      const computedStyle = iframeDoc.defaultView.getComputedStyle(overlay)
      if (
        computedStyle.visibility === 'hidden' ||
        computedStyle.display === 'none' ||
        computedStyle.opacity === '0'
      ) {
        applyOverlayStyles()
      }

      const currentZIndex = parseInt(computedStyle.zIndex) || 0
      if (currentZIndex < 999999999) {
        applyOverlayStyles()
      }

      if (overlay._videoElement && overlay._targetContainer) {
        const video = overlay._videoElement
        const videoStyle = iframeDoc.defaultView.getComputedStyle(video)

        const fullscreenElement = getIframeFullscreenElement(iframeDoc)
        const isFullscreen = isIframeVideoFullscreen(iframeDoc, video)

        let expectedWidth, expectedHeight

        if (isFullscreen) {
          expectedWidth = window.innerWidth
          expectedHeight = window.innerHeight
        } else if (fullscreenElement) {
          expectedWidth =
            fullscreenElement.clientWidth || fullscreenElement.offsetWidth || window.innerWidth
          expectedHeight =
            fullscreenElement.clientHeight || fullscreenElement.offsetHeight || window.innerHeight
        } else {
          expectedWidth =
            video.offsetWidth || video.clientWidth || parseFloat(videoStyle.width) || 0
          expectedHeight =
            video.offsetHeight || video.clientHeight || parseFloat(videoStyle.height) || 0
        }

        const currentWidth = parseInt(computedStyle.width) || 0
        const currentHeight = parseInt(computedStyle.height) || 0

        if (
          Math.abs(currentWidth - expectedWidth) > 5 ||
          Math.abs(currentHeight - expectedHeight) > 5
        ) {
          applyOverlayStyles()
        }
      }
    }, 1000)

    const overlayObserver = new window.MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target === overlay) {
          if (mutation.attributeName === 'style') {
            schedule(() => {
              if (currentOverlayElement.value && videoOverlayEnabled2.value) {
                applyOverlayStyles()
              }
            }, 100)
          }
        }
      })
    })

    overlay._mutationObserver = overlayObserver
    overlayObserver.observe(overlay, {
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    const resizeHandler = () => {
      if (currentOverlayElement.value && videoOverlayEnabled2.value) {
        applyOverlayStyles()
      }
    }

    const fullscreenHandler = () => {
      if (currentOverlayElement.value && videoOverlayEnabled2.value) {
        schedule(() => {
          applyOverlayStyles()
        }, 100)
      }
    }

    listen(iframeDoc.defaultView, 'resize', resizeHandler)
    listen(iframeDoc, 'fullscreenchange', fullscreenHandler)
    listen(iframeDoc, 'webkitfullscreenchange', fullscreenHandler)

    listen(video, 'webkitbeginfullscreen', fullscreenHandler)
    listen(video, 'webkitendfullscreen', fullscreenHandler)

    overlay._monitorInterval = overlayMonitorInterval
    overlay._mutationObserver = overlayObserver
    overlay._resizeHandler = resizeHandler
    overlay._fullscreenHandler = fullscreenHandler
    overlay._iframeDoc = iframeDoc

    const initialProtectionInterval = repeat(() => {
      if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
        cancelInterval(initialProtectionInterval)
        return
      }
      applyOverlayStyles()
    }, 500)

    schedule(() => {
      cancelInterval(initialProtectionInterval)
    }, 10000)
  }

  const updateVideoOverlay = () => {
    if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
      return
    }

    const iframe = playerIframe.value
    if (!iframe) return
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (!iframeDoc) return

    const overlay = currentOverlayElement.value
    const mainInfo = overlay.children[0]
    const timingsPanel = overlay.children[1]

    const computedStyle = iframeDoc.defaultView.getComputedStyle(overlay)
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      overlay.style.setProperty('display', 'flex', 'important')
      overlay.style.setProperty('visibility', 'visible', 'important')
    }

    const currentFontSize = overlaySettings.value.fontSize || 18
    const movieTitle = mainInfo.children[0]
    movieTitle.style.fontSize = `${currentFontSize + 2}px`
    if (overlaySettings.value.showTitle) {
      movieTitle.style.display = 'block'
      const title =
        props.movieInfo?.title ||
        props.movieInfo?.name_ru ||
        props.movieInfo?.name_en ||
        props.movieInfo?.name_original ||
        'Загрузка...'
      const year = props.movieInfo?.year ? ` (${props.movieInfo.year})` : ''
      movieTitle.textContent = title + year

      applyOverlayTitleBackgroundStyle(movieTitle, overlaySettings.value.showBackground)
    } else {
      movieTitle.style.display = 'none'
    }

    const videoProgress = mainInfo.children[1]
    videoProgress.style.fontSize = `${currentFontSize}px`
    let progressHtml = ''

    if (overlaySettings.value.showDuration2) {
      const currentTimeFormatted = formatSecondsToTime(currentVideoTime.value)
      const totalTimeFormatted = formatSecondsToTime(totalVideoDuration.value)
      progressHtml = getDurationProgressMarkup({ currentTimeFormatted, totalTimeFormatted })
    }

    if (progressHtml) {
      videoProgress.style.display = 'flex'
      videoProgress.innerHTML = progressHtml
      applyOverlayProgressBackgroundStyle(videoProgress, overlaySettings.value.showBackground)
    } else {
      videoProgress.style.display = 'none'
    }

    if (activeTimingTexts.value.length > 0) {
      const timingsContent = timingsPanel.children[0]
      timingsContent.style.cssText = getTimingsContentStyle({ fontSize: currentFontSize })
      timingsContent.innerHTML = ''

      const list = iframeDoc.createElement('div')
      list.style.cssText = getTimingsListStyle()

      activeTimingTexts.value.forEach((timing) => {
        timing.intervals.forEach((interval) => {
          const intervalSpan = iframeDoc.createElement('div')
          intervalSpan.textContent = interval.text
          intervalSpan.style.cssText = getTimingChipStyle({
            status: interval.status,
            highlight: overlaySettings.value.highlightTimings
          })

          list.appendChild(intervalSpan)
        })
      })

      timingsContent.appendChild(list)
      timingsPanel.style.display = 'block'

      if (!overlaySettings.value.showTimingsOnMouseMove || hasActiveTimings.value) {
        applyOverlayVisibilityStyle(timingsPanel, true)
      }

      applyOverlayTimingsBackgroundStyle(timingsPanel, overlaySettings.value.showBackground)
    } else {
      timingsPanel.style.display = 'none'
    }

    if (
      overlaySettings.value.showTimingsOnMouseMove &&
      hasActiveTimings.value &&
      activeTimingTexts.value.length > 0
    ) {
      applyOverlayVisibilityStyle(timingsPanel, true)
      cancelTimeout(hideTimingsTimeout)
    } else if (
      overlaySettings.value.showTimingsOnMouseMove &&
      !hasActiveTimings.value &&
      activeTimingTexts.value.length > 0 &&
      timingsPanel.style.opacity === '1' &&
      !hideTimingsTimeout
    ) {
      hideTimingsTimeout = schedule(() => {
        applyOverlayVisibilityStyle(timingsPanel, false)
        hideTimingsTimeout = null
      }, 3000)
    }
  }

  const removeVideoOverlay = () => {
    for (const timer of timeouts) clearTimeout(timer)
    timeouts.clear()
    for (const timer of overlayIntervals) clearInterval(timer)
    overlayIntervals.clear()
    for (const removeListener of overlayListeners) removeListener()
    overlayListeners.clear()
    settingsModal?.remove()
    settingsModal = null

    const overlay = currentOverlayElement.value
    currentOverlayElement.value = null
    overlay?._mutationObserver?.disconnect()
    overlay?.remove()
    overlayCreationInProgress.value = false
    overlayControlsTimeout.value = null
    hideTimingsTimeout = null
  }

  // Only called by this runtime after its iframe has loaded.
  const ensureVideoOverlay = () => {
    if (disposed || !shouldRenderVideoOverlay() || currentOverlayElement.value) return
    const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
    if (timeSinceLoad < 100) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document
      const video = iframeDoc?.querySelector('video')
      if (!video) return
      createVideoOverlay(iframeDoc, video)
      updateVideoOverlay()
    } catch (error) {
      removeVideoOverlay()
      debugLog('Error creating video overlay:', error)
    }
  }

  stopWatchers.push(
    watch(videoOverlayEnabled2, (enabled) => {
      videoOverlayManuallyHidden.value = false
      if (enabled) ensureVideoOverlay()
      else removeVideoOverlay()
    }),
    watch(
      overlaySettings,
      (newSettings, oldSettings) => {
        if (!shouldRenderVideoOverlay()) return
        if (newSettings.showBackground !== oldSettings?.showBackground) {
          removeVideoOverlay()
          ensureVideoOverlay()
        } else if (currentOverlayElement.value) {
          updateVideoOverlay()
        }
      },
      { deep: true }
    )
  )

  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const stop of stopWatchers) stop()
    clearInterval(videoPositionInterval)
    videoPositionInterval = null
    removeVideoOverlay()
    if (blurApplied) {
      disableBlur()
      blurApplied = false
    }
  }

  return {
    start() {
      if (disposed) return
      ensureVideoOverlay()
      startVideoPositionMonitoring()
    },
    dispose
  }
}
