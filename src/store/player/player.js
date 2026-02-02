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
      fontSize: 18
    },
    obsSettings: {
      enabled: false,
      host: 'localhost',
      port: 4455,
      password: '',
      connected: false,
      filtersFound: [],
      selectedFilterId: null,
      showObsInOverlay: true
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
      this.videoOverlayEnabled2 = value
    },
    updateOverlaySettings(settings) {
      this.overlaySettings = { ...this.overlaySettings, ...settings }
    },
    updateObsSettings(settings) {
      this.obsSettings = { ...this.obsSettings, ...settings }
    },
    setObsConnected(connected) {
      this.obsSettings.connected = connected
    },
    setObsSelectedFilter(filterId) {
      this.obsSettings.selectedFilterId = filterId
    }
  },

  persist: {
    key: PLAYER_STORE_NAME,
    beforeHydrate: beforeHydrateLegacyVuex
  }
})
