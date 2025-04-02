import { defineStore } from 'pinia'

export const useTrailerStore = defineStore('trailer', {
  state: () => ({
    areTrailersActive: true // По умолчанию активны
  }),
  actions: {
    activateTrailers() {
      this.areTrailersActive = true
    },
    deactivateTrailers() {
      this.areTrailersActive = false
    },
    toggleTrailers() {
      this.areTrailersActive = !this.areTrailersActive
    }
  },
  persist: true
})
