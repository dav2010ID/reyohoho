import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayerElectronControls } from './usePlayerElectronControls'

const createPlayerStore = () =>
  reactive({
    compressorEnabled: false,
    mirrorEnabled: false,
    updateCompressor(value) {
      this.compressorEnabled = value
    },
    updateMirror(value) {
      this.mirrorEnabled = value
    }
  })

const createCrossOriginIframe = () => {
  const iframe = document.createElement('iframe')

  Object.defineProperty(iframe, 'contentDocument', {
    get() {
      const error = new Error('Blocked by same-origin policy')
      error.name = 'SecurityError'
      throw error
    }
  })

  Object.defineProperty(iframe, 'contentWindow', {
    get() {
      const error = new Error('Blocked by same-origin policy')
      error.name = 'SecurityError'
      throw error
    }
  })

  return iframe
}

describe('usePlayerElectronControls', () => {
  beforeEach(() => {
    window.electronAPI = {
      showToast: vi.fn()
    }
  })

  afterEach(() => {
    delete window.electronAPI
  })

  it('falls back to iframe styles for blur and mirror on cross-origin players', () => {
    const iframe = createCrossOriginIframe()
    const playerStore = createPlayerStore()
    const controls = usePlayerElectronControls({
      isElectron: ref(true),
      playerStore,
      playerIframe: ref(iframe),
      kpId: ref('123')
    })

    controls.toggleBlur()
    expect(iframe.style.filter).toBe('blur(50px)')

    controls.toggleBlur()
    expect(iframe.style.filter).toBe('')

    controls.toggleMirror()
    expect(playerStore.mirrorEnabled).toBe(true)
    expect(iframe.style.transform).toBe('scaleX(-1)')

    controls.toggleMirror()
    expect(playerStore.mirrorEnabled).toBe(false)
    expect(iframe.style.transform).toBe('')
  })

  it('rolls compressor state back when a cross-origin player cannot expose video', async () => {
    const playerStore = createPlayerStore()
    const controls = usePlayerElectronControls({
      isElectron: ref(true),
      playerStore,
      playerIframe: ref(createCrossOriginIframe()),
      kpId: ref('123')
    })

    await controls.toggleCompressor()

    expect(playerStore.compressorEnabled).toBe(false)
    expect(window.electronAPI.showToast).toHaveBeenCalledWith(
      'Компрессор не поддерживается этим плеером'
    )
  })
})
