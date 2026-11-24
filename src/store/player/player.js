import { defineStore } from 'pinia'
import { PLAYER_STORE_NAME } from '../constants'
import { beforeHydrateLegacyVuex } from '../utils'

export const usePlayerStore = defineStore(PLAYER_STORE_NAME, {
  state: () => ({
    preferredPlayer: null,
    aspectRatio: '16:9',
    isCentered: false,
    showFavoriteTooltip: true,
    compressorEnabled: false,
    mirrorEnabled: false,
    videoOverlayEnabled2: true,
    overlaySettings: {
      showTitle: true,
      showDuration2: false,
      showBackground: false,
      showTimingsOnMouseMove: false,
      highlightTimings: true,
      autoBlurTimings: true,
      fontSize: 18
    }
  }),

  actions: {
    updatePreferredPlayer(player) {
      this.preferredPlayer = player
    },
    clearPreferredPlayer() {
      this.preferredPlayer = null
    },
    updateAspectRatio(ratio) {
      this.aspectRatio = ratio
    },
    updateCentering(value) {
      this.isCentered = value
    },
    setFavoriteTooltip(value) {
      this.showFavoriteTooltip = value
    },
    updateCompressor(value) {
      this.compressorEnabled = value
    },
    updateMirror(value) {
      this.mirrorEnabled = value
    },
    updateVideoOverlay(value) {
      this.videoOverlayEnabled2 = value
    },
    updateOverlaySettings(settings) {
      this.overlaySettings = { ...this.overlaySettings, ...settings }
    }
  },

  persist: {
    key: PLAYER_STORE_NAME,
    pick: [
      'preferredPlayer',
      'aspectRatio',
      'isCentered',
      'showFavoriteTooltip',
      'compressorEnabled',
      'mirrorEnabled',
      'videoOverlayEnabled2',
      'overlaySettings'
    ],
    beforeHydrate: beforeHydrateLegacyVuex,
    // Rewrite existing and migrated data with only supported preferences.
    afterHydrate: ({ store }) => store.$persist()
  }
})
