import { sceneSelection } from '@/utils/sceneSelection'
import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayerVideoOverlay } from './usePlayerVideoOverlay'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('usePlayerVideoOverlay lazy activation', () => {
  const overlays = []
  const setup = ({ electron = true, enabled = true, loadOverlay } = {}) => {
    const playerStore = reactive({
      videoOverlayEnabled2: enabled,
      updateVideoOverlay(value) {
        this.videoOverlayEnabled2 = value
      }
    })
    const playerIframe = ref(document.createElement('iframe'))
    playerIframe.value.setAttribute('src', 'https://player.example/movie/1')
    const runtime = { start: vi.fn(), dispose: vi.fn() }
    const createPlayerVideoOverlayRuntime = vi.fn(() => runtime)
    const loader = loadOverlay || vi.fn(async () => ({ createPlayerVideoOverlayRuntime }))
    const overlay = usePlayerVideoOverlay({
      isElectron: ref(electron),
      playerStore,
      playerIframe,
      props: {},
      enableBlur: vi.fn(),
      disableBlur: vi.fn(),
      loadOverlay: loader
    })
    overlays.push(overlay)
    overlay.mount()
    return { overlay, playerStore, playerIframe, loader, runtime, createPlayerVideoOverlayRuntime }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    window.electronAPI = { showToast: vi.fn() }
  })
  afterEach(() => {
    overlays.splice(0).forEach((overlay) => overlay.dispose())
    delete window.electronAPI
    delete sceneSelection.overlayNudityTimings
    delete sceneSelection.selectedNudityTimings
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('never imports the overlay on web even with persisted overlay settings and timings', async () => {
    sceneSelection.overlayNudityTimings = [1]
    const { overlay, loader } = setup({ electron: false })
    await overlay.onIframeLoad()
    await vi.advanceTimersByTimeAsync(5000)
    expect(loader).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for an actual loaded iframe and restores the enabled desktop overlay once', async () => {
    const { overlay, loader, runtime } = setup()
    await vi.advanceTimersByTimeAsync(2000)
    expect(loader).not.toHaveBeenCalled()
    await overlay.onIframeLoad()
    await vi.advanceTimersByTimeAsync(3000)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(runtime.start).toHaveBeenCalledTimes(1)
  })

  it('keeps a disabled desktop overlay unloaded until it is enabled', async () => {
    const { overlay, loader, playerStore, runtime } = setup({ enabled: false })
    await overlay.onIframeLoad()
    await vi.advanceTimersByTimeAsync(2000)
    expect(loader).not.toHaveBeenCalled()
    playerStore.updateVideoOverlay(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(runtime.start).toHaveBeenCalledTimes(1)
    playerStore.updateVideoOverlay(false)
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
  })

  it('auto-enables for scene selections and retains timing support while they remain selected', async () => {
    const { overlay, loader, playerStore, runtime } = setup({ enabled: false })
    await overlay.onIframeLoad()
    sceneSelection.overlayNudityTimings = [10]
    await vi.advanceTimersByTimeAsync(1000)
    expect(playerStore.videoOverlayEnabled2).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
    playerStore.updateVideoOverlay(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.dispose).not.toHaveBeenCalled()
    sceneSelection.overlayNudityTimings = []
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
  })

  it.each(['dispose', 'resetPlayback', 'disable', 'replaceIframe', 'replaceSrc'])(
    'ignores a module resolving after %s',
    async (action) => {
      const module = deferred()
      const loader = vi.fn(() => module.promise)
      const { overlay, playerStore, playerIframe, createPlayerVideoOverlayRuntime } = setup({
        loadOverlay: loader
      })
      const pending = overlay.onIframeLoad()
      if (action === 'disable') playerStore.updateVideoOverlay(false)
      else if (action === 'replaceIframe') playerIframe.value = document.createElement('iframe')
      else if (action === 'replaceSrc')
        playerIframe.value.setAttribute('src', 'https://player.example/movie/2')
      else overlay[action]()
      module.resolve({ createPlayerVideoOverlayRuntime })
      await pending
      expect(createPlayerVideoOverlayRuntime).not.toHaveBeenCalled()
    }
  )

  it('keeps only the latest iframe load when the same import resolves for both routes', async () => {
    const module = deferred()
    const { overlay, runtime, playerIframe, createPlayerVideoOverlayRuntime } = setup({
      loadOverlay: vi.fn(() => module.promise)
    })
    const oldLoad = overlay.onIframeLoad()
    overlay.resetPlayback()
    playerIframe.value.setAttribute('src', 'https://player.example/movie/2')
    const newLoad = overlay.onIframeLoad()
    module.resolve({ createPlayerVideoOverlayRuntime })
    await Promise.all([oldLoad, newLoad])
    expect(createPlayerVideoOverlayRuntime).toHaveBeenCalledTimes(1)
    overlay.dispose()
    overlay.dispose()
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('contains import failures without polling retries and retries on explicit enable', async () => {
    const runtime = { start: vi.fn(), dispose: vi.fn() }
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Chunk unavailable'))
      .mockResolvedValue({ createPlayerVideoOverlayRuntime: () => runtime })
    const { overlay, playerStore } = setup({ loadOverlay: loader })
    await expect(overlay.onIframeLoad()).resolves.toBeNull()
    await vi.advanceTimersByTimeAsync(5000)
    expect(loader).toHaveBeenCalledTimes(1)
    playerStore.updateVideoOverlay(false)
    playerStore.updateVideoOverlay(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(loader).toHaveBeenCalledTimes(2)
    expect(runtime.start).toHaveBeenCalledTimes(1)
  })

  it('disposes a partially started runtime if initialization fails', async () => {
    const runtime = {
      start: vi.fn(() => {
        throw new Error('DOM unavailable')
      }),
      dispose: vi.fn()
    }
    const { overlay } = setup({
      loadOverlay: vi.fn(async () => ({ createPlayerVideoOverlayRuntime: () => runtime }))
    })
    await expect(overlay.onIframeLoad()).resolves.toBeNull()
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
    overlay.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
