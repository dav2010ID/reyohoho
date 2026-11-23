import { usePlayerStore } from '@/store/player'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { LEGACY_STORE_KEY, PLAYER_STORE_NAME } from '../constants'

describe('Базовы persist тесты для player', () => {
  let app = null
  let pinia = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    window.localStorage.clear()

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
    window.localStorage.clear()
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

  it.each(['player', 'legacy vuex'])(
    'preserves all player preferences and removes retired OBS data from %s storage',
    async (storage) => {
      const preferences = {
        preferredPlayer: 'ALLOHA',
        aspectRatio: '4:3',
        isCentered: true,
        showFavoriteTooltip: false,
        compressorEnabled: true,
        mirrorEnabled: true,
        videoOverlayEnabled2: false,
        overlaySettings: {
          showTitle: false,
          showDuration2: true,
          showBackground: true,
          showTimingsOnMouseMove: true,
          highlightTimings: false,
          autoBlurTimings: false,
          fontSize: 24
        }
      }
      const savedPlayer = {
        ...preferences,
        obsSettings: {
          enabled: true,
          host: 'saved-host',
          port: 4455,
          password: 'retired-password',
          selectedFilterId: 'retired-filter'
        }
      }
      const unrelatedLegacyPreferences = { background: { isBlurActive: true } }
      if (storage === 'legacy vuex') {
        localStorage.setItem(
          LEGACY_STORE_KEY,
          JSON.stringify({ ...unrelatedLegacyPreferences, player: savedPlayer })
        )
      } else {
        localStorage.setItem(PLAYER_STORE_NAME, JSON.stringify(savedPlayer))
      }

      const store = usePlayerStore(pinia)

      expect(store.$state).toEqual(preferences)
      expect(store.$state).not.toHaveProperty('obsSettings')
      expect(JSON.parse(localStorage.getItem(PLAYER_STORE_NAME))).toEqual(preferences)
      if (storage === 'legacy vuex') {
        expect(JSON.parse(localStorage.getItem(LEGACY_STORE_KEY))).toEqual(
          unrelatedLegacyPreferences
        )
      }

      store.updateAspectRatio('21:9')
      await flushPromises()
      expect(JSON.parse(localStorage.getItem(PLAYER_STORE_NAME))).toEqual({
        ...preferences,
        aspectRatio: '21:9'
      })
    }
  )
})
