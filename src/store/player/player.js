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
    videoOverlayEnabled: true,
    overlaySettings: {
      showTitle: true,
      showDuration: true,
      showStartTime: true
    }
  }),

  actions: {
    updatePreferredPlayer(player) {
      this.preferredPlayer = player
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
      this.videoOverlayEnabled = value
    },
    updateOverlaySettings(settings) {
      this.overlaySettings = { ...this.overlaySettings, ...settings }
    },
    resetStartTime() {
    }
  },

  persist: {
    key: PLAYER_STORE_NAME,
    beforeHydrate: beforeHydrateLegacyVuex
  }
})
