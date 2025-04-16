import starsBackground from '@/assets/image-back-stars.png'
import { defineStore } from 'pinia'
import { BACKGROUND_STORE_NAME } from '../constants'
import { beforeHydrateLegacyVuex } from '../uitls'

export const useBackgroundStore = defineStore(BACKGROUND_STORE_NAME, {
  state: () => ({
    backgroundUrl: starsBackground,
    topMoviePoster: '',
    moviePoster: '',
    isBlurActive: false,
    backgroundType: 'stars',
    defaultBackground: starsBackground,
    isCardBorder: false,
    isCardHoverDisabled: false
  }),

  actions: {
    updateMoviePoster(poster) {
      if (this.backgroundType !== 'disabled') {
        const url = poster || this.defaultBackground

        if (this.backgroundType !== 'stars' && this.backgroundType !== 'disabled') {
          this.moviePoster = url
          if (this.backgroundUrl !== url) {
            this.backgroundUrl = url
          }
        }
      }
    },

    updateTopMoviePoster(poster) {
      if (this.backgroundType !== 'disabled') {
        const url = poster || this.defaultBackground

        if (this.backgroundType !== 'stars' && this.backgroundType !== 'disabled') {
          this.topMoviePoster = url
          if (this.backgroundUrl !== url) {
            this.backgroundUrl = url
          }
        }
      }
    },

    toggleBlur(isActive) {
      if (this.backgroundType !== 'stars' && this.backgroundType !== 'disabled') {
        this.SET_BLUR(isActive)
      }
    },

    updateBackgroundType(type) {
      this.SET_BACKGROUND_TYPE(type)
    },

    toggleCardBorder(isBorder) {
      this.isCardBorder = isBorder
    },

    toggleCardHover(isDisabled) {
      this.isCardHoverDisabled = isDisabled
    },

    resetBackground() {
      this.SET_BLUR(false)
      this.SET_BACKGROUND_TYPE('stars')
    },

    SET_BLUR(isActive) {
      if (this.backgroundType !== 'stars' && this.backgroundType !== 'disabled') {
        this.isBlurActive = isActive
      } else {
        this.isBlurActive = false
      }
    },

    SET_BACKGROUND_TYPE(type) {
      this.backgroundType = type

      if (type === 'dynamic') {
        // Автовключение блюра для динамического фона
        this.isBlurActive = true
        this.backgroundUrl = this.topMoviePoster
      } else if (type === 'disabled' || type === 'stars') {
        this.isBlurActive = false
        if (type === 'disabled') {
          this.backgroundUrl = ''
        } else if (type === 'stars') {
          this.backgroundUrl = starsBackground
        }
      }
    }
  },

  persist: {
    key: BACKGROUND_STORE_NAME,
    beforeHydrate: beforeHydrateLegacyVuex
  }
})
