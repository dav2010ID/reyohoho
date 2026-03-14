import { usePlayerStore } from '@/store/player'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { PLAYER_STORE_NAME } from '../constants'

describe('Базовы persist тесты для player', () => {
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

  afterEach(() => {
    app = null
    pinia = null
  })

  it('Сохраняет изменения state в localStorage (проверка работы плагина)', async () => {
    const store = usePlayerStore()

    const testData = {
      aspectRatio: '21:9',
      isCentered: true,
      preferredPlayer: 'TORRENTS'
    }

    store.updateAspectRatio(testData.aspectRatio)
    store.updateCentering(testData.isCentered)
    store.updatePreferredPlayer(testData.preferredPlayer)

    await flushPromises()

    expect(localStorage.getItem(PLAYER_STORE_NAME)).toEqual(JSON.stringify(store.$state))
  })
})
