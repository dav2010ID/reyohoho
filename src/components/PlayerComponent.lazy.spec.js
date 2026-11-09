import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePlayerStore } from '@/store/player'
import PlayerComponent from './PlayerComponent.vue'
import { getPlayers } from '@/api/movies'

const optional = vi.hoisted(() => ({
  overlayEvaluated: vi.fn(),
  overlayCreated: vi.fn(),
  overlayStarted: vi.fn(),
  overlayDisposed: vi.fn()
}))

vi.mock('@/utils/playerVideoOverlayRuntime', () => {
  optional.overlayEvaluated()
  return {
    createPlayerVideoOverlayRuntime: (...args) => {
      optional.overlayCreated(...args)
      return { start: optional.overlayStarted, dispose: optional.overlayDisposed }
    }
  }
})

vi.mock('@/api/movies', () => ({
  getPlayers: vi.fn(async () => ({
    'KINOBOX>TEST': {
      source: 'KINOBOX',
      iframe: 'https://player.example/embed/123'
    }
  })),
  getShikiPlayers: vi.fn(),
  searchKinoBDPlayerCandidates: vi.fn(),
  getKinoBDPlayerDataByInid: vi.fn()
}))

vi.mock('@/store/main', () => ({
  useMainStore: () => ({ isMobile: false, dimmingEnabled: false, contentApiProvider: 'kinobox' })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { kp_id: '123' } }),
  useRouter: () => ({ push: vi.fn() })
}))

describe('PlayerComponent optional runtime boundaries', () => {
  const wrappers = []
  const setup = (videoOverlayEnabled2) => {
    const pinia = createPinia()
    const playerStore = usePlayerStore(pinia)
    playerStore.updateVideoOverlay(videoOverlayEnabled2)
    const wrapper = mount(PlayerComponent, {
      props: { kpId: '123', movieInfo: { title: 'Example movie' } },
      global: { plugins: [pinia] }
    })
    wrappers.push(wrapper)
    return { wrapper, playerStore }
  }

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    delete window.electronAPI
    delete window.dataLayer
    delete window.iframeLoadTime
    delete window.toggleCompressor
    delete window.toggleMirror
    vi.restoreAllMocks()
  })

  it('retries an empty result, discards a stale response and cancels on unmount', async () => {
    let resolveRetry
    getPlayers.mockResolvedValueOnce({}).mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve }))
    const { wrapper } = setup(false)
    await flushPromises()
    await wrapper.get('.player-empty-state button').trigger('click')
    const retrySignal = getPlayers.mock.calls.at(-1)[1].signal
    await wrapper.setProps({ kpId: '456' })
    await flushPromises()
    expect(retrySignal.aborted).toBe(true)
    resolveRetry({})
    await flushPromises()
    expect(wrapper.get('iframe').attributes('src')).toBe('https://player.example/embed/123')
    getPlayers.mockImplementationOnce(() => new Promise(() => {}))
    await wrapper.setProps({ kpId: '789' })
    const lastSignal = getPlayers.mock.calls.at(-1)[1].signal
    wrapper.unmount()
    wrappers.pop()
    expect(lastSignal.aborted).toBe(true)
  })

  it('keeps web playback light and loads the desktop overlay only on activation', async () => {
    const web = setup(true)
    await flushPromises()
    expect(web.wrapper.get('iframe').attributes('src')).toBe('https://player.example/embed/123')
    await web.wrapper.get('iframe').trigger('load')
    await vi.dynamicImportSettled()
    expect(web.playerStore.preferredPlayer).toBe('KINOBOX>TEST')
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'player_iframe_load', status: 'success' }),
        expect.objectContaining({
          event: 'player_iframe_security',
          iframe_origin: 'https://player.example'
        })
      ])
    )
    expect(optional.overlayEvaluated).not.toHaveBeenCalled()
    web.wrapper.unmount()
    wrappers.pop()

    window.electronAPI = { showToast: vi.fn() }
    const desktop = setup(false)
    await flushPromises()
    await desktop.wrapper.get('iframe').trigger('load')
    await vi.dynamicImportSettled()
    expect(optional.overlayEvaluated).not.toHaveBeenCalled()

    await desktop.wrapper.get('button.overlay-btn').trigger('click')
    await vi.dynamicImportSettled()
    expect(optional.overlayEvaluated).toHaveBeenCalledTimes(1)
    expect(optional.overlayCreated).toHaveBeenCalledTimes(1)
    expect(optional.overlayStarted).toHaveBeenCalledTimes(1)

    desktop.wrapper.unmount()
    wrappers.pop()
    expect(optional.overlayDisposed).toHaveBeenCalledTimes(1)
  })
})
