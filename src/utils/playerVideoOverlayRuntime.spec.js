import { sceneSelection } from '@/utils/sceneSelection'
import { nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayerVideoOverlayRuntime } from './playerVideoOverlayRuntime'

describe('playerVideoOverlayRuntime', () => {
  const runtimes = []
  const setup = () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument
    iframeDoc.body.innerHTML = '<div><video></video></div>'
    const video = iframeDoc.querySelector('video')
    Object.defineProperty(video, 'offsetWidth', { value: 640 })
    Object.defineProperty(video, 'offsetHeight', { value: 360 })
    const playerStore = reactive({
      videoOverlayEnabled2: true,
      overlaySettings: {
        showTitle: true,
        showDuration2: true,
        fontSize: 18,
        autoBlurTimings: true
      },
      updateVideoOverlay(value) {
        this.videoOverlayEnabled2 = value
      },
      updateOverlaySettings(value) {
        this.overlaySettings = { ...this.overlaySettings, ...value }
      }
    })
    const props = reactive({
      movieInfo: {
        title: 'Example movie',
        year: 2026,
        nudity_timings: [{ id: 1, timing_text: '00:10-00:20' }]
      }
    })
    const enableBlur = vi.fn()
    const disableBlur = vi.fn()
    const runtime = createPlayerVideoOverlayRuntime({
      isElectron: ref(true),
      playerStore,
      playerIframe: ref(iframe),
      props,
      enableBlur,
      disableBlur
    })
    runtimes.push(runtime)
    return { runtime, iframe, iframeDoc, video, playerStore, props, enableBlur, disableBlur }
  }
  beforeEach(() => {
    vi.useFakeTimers()
    window.iframeLoadTime = Date.now() - 1000
    window.electronAPI = { showToast: vi.fn() }
  })
  afterEach(() => {
    runtimes.splice(0).forEach((runtime) => runtime.dispose())
    document.body.innerHTML = ''
    delete window.iframeLoadTime
    delete window.electronAPI
    delete sceneSelection.overlayNudityTimings
    delete sceneSelection.selectedNudityTimings
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders persisted settings and restores an overlay after a provider replaces its video', async () => {
    const { runtime, iframeDoc, video } = setup()
    runtime.start()
    const overlay = iframeDoc.getElementById('reyohoho-video-overlay')
    expect(overlay.textContent).toContain('Example movie (2026)')
    expect(iframeDoc.querySelectorAll('#reyohoho-video-overlay')).toHaveLength(1)
    overlay.remove()
    const replacement = iframeDoc.createElement('video')
    video.replaceWith(replacement)
    await vi.advanceTimersByTimeAsync(1000)
    expect(iframeDoc.getElementById('reyohoho-video-overlay')).toBe(overlay)
    expect(overlay._videoElement).toBe(replacement)
  })

  it('removes timers, observers, fullscreen/resize/mouse listeners, settings UI and watchers on disposal', async () => {
    const { runtime, iframeDoc, video, playerStore } = setup()
    const removeDocumentListener = vi.spyOn(iframeDoc, 'removeEventListener')
    const removeWindowListener = vi.spyOn(iframeDoc.defaultView, 'removeEventListener')
    const removeVideoListener = vi.spyOn(video, 'removeEventListener')
    runtime.start()
    const overlay = iframeDoc.getElementById('reyohoho-video-overlay')
    const observerDisconnect = vi.spyOn(overlay._mutationObserver, 'disconnect')
    iframeDoc.dispatchEvent(new iframeDoc.defaultView.Event('mousemove'))
    overlay.querySelector('button[title="Настройки оверлея"]').click()
    await vi.advanceTimersByTimeAsync(100)
    expect(iframeDoc.getElementById('overlay-settings-modal')).not.toBeNull()
    runtime.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(observerDisconnect).toHaveBeenCalledTimes(1)
    expect(iframeDoc.getElementById('reyohoho-video-overlay')).toBeNull()
    expect(iframeDoc.getElementById('overlay-settings-modal')).toBeNull()
    expect(removeDocumentListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeDocumentListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function))
    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeVideoListener).toHaveBeenCalledWith('webkitbeginfullscreen', expect.any(Function))
    playerStore.updateOverlaySettings({ showBackground: true })
    await nextTick()
    runtime.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(vi.getTimerCount()).toBe(0)
    expect(iframeDoc.getElementById('reyohoho-video-overlay')).toBeNull()
  })

  it('cancels deferred settings opening when disposed immediately after click', async () => {
    const { runtime, iframeDoc } = setup()
    runtime.start()
    iframeDoc.querySelector('button[title="Настройки оверлея"]').click()
    runtime.dispose()
    await vi.advanceTimersByTimeAsync(1000)
    expect(iframeDoc.getElementById('overlay-settings-modal')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps auto-blur support with the visual overlay disabled and releases blur on disposal', async () => {
    const { runtime, video, playerStore, enableBlur, disableBlur } = setup()
    playerStore.updateVideoOverlay(false)
    sceneSelection.overlayNudityTimings = [1]
    Object.defineProperty(video, 'paused', { value: false })
    video.currentTime = 15
    runtime.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(enableBlur).toHaveBeenCalledTimes(1)
    runtime.dispose()
    expect(disableBlur).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['overlayNudityTimings', 'selectedNudityTimings'])(
    'applies and releases local blur at the selected scene boundaries from %s',
    async (selection) => {
      const { runtime, video, enableBlur, disableBlur } = setup()
      sceneSelection[selection] = ['1']
      Object.defineProperty(video, 'paused', { value: false })
      video.currentTime = 9
      runtime.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(enableBlur).not.toHaveBeenCalled()

      video.currentTime = 10
      await vi.advanceTimersByTimeAsync(100)
      expect(enableBlur).toHaveBeenCalledTimes(1)
      video.currentTime = 20
      await vi.advanceTimersByTimeAsync(500)
      expect(enableBlur).toHaveBeenCalledTimes(1)
      expect(disableBlur).not.toHaveBeenCalled()

      video.currentTime = 21
      await vi.advanceTimersByTimeAsync(100)
      expect(disableBlur).toHaveBeenCalledTimes(1)
      runtime.dispose()
      expect(disableBlur).toHaveBeenCalledTimes(1)
    }
  )

  it('releases local blur when auto-blur is disabled or the selected scene is cleared', async () => {
    const { runtime, video, playerStore, enableBlur, disableBlur } = setup()
    sceneSelection.overlayNudityTimings = [1]
    Object.defineProperty(video, 'paused', { value: false })
    video.currentTime = 15
    runtime.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(enableBlur).toHaveBeenCalledTimes(1)

    playerStore.updateOverlaySettings({ autoBlurTimings: false })
    await vi.advanceTimersByTimeAsync(100)
    expect(disableBlur).toHaveBeenCalledTimes(1)
    playerStore.updateOverlaySettings({ autoBlurTimings: true })
    await vi.advanceTimersByTimeAsync(100)
    expect(enableBlur).toHaveBeenCalledTimes(2)

    sceneSelection.overlayNudityTimings = []
    await vi.advanceTimersByTimeAsync(100)
    expect(disableBlur).toHaveBeenCalledTimes(2)
  })

  it('uses one creation path across enable and settings changes', async () => {
    const { runtime, iframeDoc, playerStore } = setup()
    runtime.start()
    playerStore.updateVideoOverlay(false)
    await nextTick()
    expect(iframeDoc.getElementById('reyohoho-video-overlay')).toBeNull()
    playerStore.updateVideoOverlay(true)
    await nextTick()
    playerStore.updateOverlaySettings({ showBackground: true })
    await nextTick()
    expect(iframeDoc.querySelectorAll('#reyohoho-video-overlay')).toHaveLength(1)
    runtime.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
