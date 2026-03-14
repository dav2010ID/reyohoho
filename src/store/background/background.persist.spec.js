import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { BACKGROUND_STORE_NAME } from '../constants'
import { useBackgroundStore } from './background'

describe('Базовые тесты persist для background', () => {
  let app = null
  let pinia = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    vi.spyOn(window.localStorage.__proto__, 'setItem')
    vi.spyOn(window.localStorage.__proto__, 'getItem')

    app = createApp({})
    pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    app.use(pinia)
  })

  it('Persist сохраняет изменения в localStorage', async () => {
    const store = useBackgroundStore()

    const testData = {
      backgroundType: 'dynamic',
      topMoviePoster: 'local-storage.jpg',
      isCardBorder: true
    }

    store.updateBackgroundType(testData.backgroundType)
    store.updateTopMoviePoster(testData.topMoviePoster)
    store.toggleCardBorder(testData.isCardBorder)

    await flushPromises()

    expect(localStorage.getItem(BACKGROUND_STORE_NAME)).toEqual(JSON.stringify(store.$state))
  })
})
