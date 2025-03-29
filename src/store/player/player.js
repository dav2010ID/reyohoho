import { defineStore } from 'pinia'
import { PLAYER_STORE_NAME } from '../constants'
import { beforeHydrateLegacyVuex } from '../uitls'

export const usePlayerStore = defineStore(PLAYER_STORE_NAME, {
  state: () => ({
    aspectRatio: '16:9',
    isCentered: false,
    preferredPlayer: '' // Например: 'ALLOHA' или 'TORRENTS'
  }),

  actions: {
    updateAspectRatio(ratio) {
      this.aspectRatio = ratio
    },
    updateCentering(isCentered) {
      this.isCentered = isCentered
    },
    updatePreferredPlayer(player) {
      this.preferredPlayer = player
    },
    clearPreferredPlayer() {
      this.preferredPlayer = ''
    }
  },

  persist: {
    key: PLAYER_STORE_NAME,
    beforeHydrate: beforeHydrateLegacyVuex
  }
})
