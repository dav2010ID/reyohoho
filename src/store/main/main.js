import noPosterImage from '@/assets/image-no-poster.gif'
import { defineStore } from 'pinia'
import { MAIN_STORE_NAME } from '../constants'
import { beforeHydrateLegacyVuex } from '../uitls'

export const useMainStore = defineStore(MAIN_STORE_NAME, {
  state: () => ({
    history: [],
    isHistoryAllowed: true,
    isMobile: false,
    dimmingEnabled: false,
    isCtrlFEnabled: true,
    showFavoriteTooltip: true
  }),

  actions: {
    setHistory(history) {
      this.history = history
    },
    setIsMobile(isMobile) {
      this.isMobile = isMobile
    },
    toggleDimming() {
      this.dimmingEnabled = !this.dimmingEnabled
    },
    toggleCtrlF() {
      this.isCtrlFEnabled = !this.isCtrlFEnabled
    },
    toggleFavoriteTooltip() {
      this.showFavoriteTooltip = !this.showFavoriteTooltip
    },

    addToHistory(movie) {
      // Проверяем, есть ли у фильма kp_id
      if (!movie?.kp_id) return

      // Находим индекс фильма в истории
      const existingMovieIndex = this.history.findIndex((m) => m.kp_id === movie.kp_id)

      if (existingMovieIndex !== -1) {
        // Если фильм уже есть, обновляем время добавления и ставим первым
        this.history[existingMovieIndex].addedAt = new Date().toISOString()

        // Перемещаем в начало
        const updatedMovie = this.history.splice(existingMovieIndex, 1)[0]
        this.history.unshift(updatedMovie)
      } else {
        // Если фильма нет, добавляем его в начало
        const movieWithDate = {
          kp_id: movie.kp_id,
          title: movie.title || '',
          year: movie.year || '',
          type: movie.type || '',
          poster: movie.poster || movie.cover || noPosterImage,
          addedAt: new Date().toISOString()
        }
        this.history.unshift(movieWithDate)
      }
    },

    removeFromHistory(kp_id) {
      this.history = this.history.filter((movie) => movie.kp_id !== kp_id)
    },

    cleanOldHistory() {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      this.history = this.history.filter((movie) => new Date(movie.addedAt) > thirtyDaysAgo)
    },

    clearAllHistory() {
      this.history = []
    },

    setHistoryAllowed(value) {
      this.isHistoryAllowed = value
    }
  },

  persist: {
    key: MAIN_STORE_NAME,
    pick: ['history', 'isHistoryAllowed', 'isCtrlFEnabled'],
    beforeHydrate: beforeHydrateLegacyVuex
  }
})
