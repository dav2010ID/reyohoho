import noPosterImage from '@/assets/image-no-poster.gif'
import { defineStore } from 'pinia'
import { MAIN_STORE_NAME } from '../constants'
import { beforeHydrateMainStore } from '../utils'
import { resolvePosterByMovie } from '@/utils/mediaUtils'
import { cardRatings } from '../../../shared/history-data.js'
import { replaceLocalList } from '@/utils/localUserLists'

export const useMainStore = defineStore(MAIN_STORE_NAME, {
  state: () => ({
    history: [],
    historyOwner: 'guest',
    cloudHistoryAccount: null,
    isHistoryAllowed: true,
    isCommentsEnabled: true,
    isAutoShowComments: false,
    commentsSortBy: 'rating',
    isMobile: false,
    dimmingEnabled: false,
    isCtrlFEnabled: true,
    submitterUsername: '',
    cardSize: 'medium',
    isStreamerMode: true,
    contentApiProvider: 'kinobox',
    searchApiProvider: 'kinobox',
    sidebarAutoHide: false,
    sidebarPosition: 'left'
  }),

  actions: {
    setHistory(history) {
      this.history = history
      replaceLocalList('history', history, this.historyOwner)
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
    setSubmitterUsername(username) {
      this.submitterUsername = username
    },

    addToHistory(movie) {
      // Проверяем, есть ли у фильма kp_id
      if (!movie?.kp_id) return

      // Находим индекс фильма в истории
      const existingMovieIndex = this.history.findIndex(
        (m) => String(m.kp_id) === String(movie.kp_id)
      )

      if (existingMovieIndex !== -1) {
        // Если фильм уже есть, обновляем время добавления и ставим первым
        this.history[existingMovieIndex] = {
          ...this.history[existingMovieIndex],
          ...cardRatings(movie),
          title: movie.title || this.history[existingMovieIndex].title || '',
          slug: movie.slug || this.history[existingMovieIndex].slug || '',
          year: movie.year || this.history[existingMovieIndex].year || '',
          type: movie.type || this.history[existingMovieIndex].type || '',
          poster:
            resolvePosterByMovie(movie) || this.history[existingMovieIndex].poster || noPosterImage,
          addedAt: new Date().toISOString()
        }

        // Перемещаем в начало
        const updatedMovie = this.history.splice(existingMovieIndex, 1)[0]
        this.history.unshift(updatedMovie)
      } else {
        // Если фильма нет, добавляем его в начало
        const movieWithDate = {
          kp_id: movie.kp_id,
          ...cardRatings(movie),
          title: movie.title || '',
          slug: movie.slug || '',
          year: movie.year || '',
          type: movie.type || '',
          poster: resolvePosterByMovie(movie) || noPosterImage,
          addedAt: new Date().toISOString()
        }
        this.history.unshift(movieWithDate)
      }
      replaceLocalList('history', this.history, this.historyOwner)
    },

    removeFromHistory(kp_id) {
      this.history = this.history.filter((movie) => String(movie.kp_id) !== String(kp_id))
      replaceLocalList('history', this.history, this.historyOwner)
    },

    cleanOldHistory() {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      this.history = this.history.filter((movie) => new Date(movie.addedAt) > thirtyDaysAgo)
      replaceLocalList('history', this.history, this.historyOwner)
    },

    clearAllHistory() {
      this.history = []
      replaceLocalList('history', [], this.historyOwner)
    },

    setHistoryAllowed(value) {
      this.isHistoryAllowed = value
    },

    setCommentsEnabled(value) {
      this.isCommentsEnabled = value
    },

    setAutoShowComments(value) {
      this.isAutoShowComments = value
    },

    setCommentsSortBy(value) {
      this.commentsSortBy = value
    },

    updateCardSize(size) {
      this.cardSize = size
    },

    setStreamerMode(value) {
      this.isStreamerMode = value
    },

    setContentApiProvider(value) {
      const normalizedProvider = String(value || '').toLowerCase()
      const aliases = {
        kinodb: 'kinobd'
      }
      const provider = aliases[normalizedProvider] || normalizedProvider
      this.contentApiProvider = ['kinobox', 'ddbb', 'ddbb_live', 'local'].includes(provider)
        ? provider
        : 'kinobox'
    },

    setSearchApiProvider(value) {
      this.searchApiProvider = ['kinobox', 'local'].includes(value) ? value : 'kinobox'
    },

    setSidebarAutoHide(value) {
      this.sidebarAutoHide = value
    },

    setSidebarPosition(value) {
      this.sidebarPosition = value
    }
  },

  persist: {
    key: MAIN_STORE_NAME,
    pick: [
      'history',
      'historyOwner',
      'cloudHistoryAccount',
      'isHistoryAllowed',
      'isCommentsEnabled',
      'isAutoShowComments',
      'commentsSortBy',
      'isCtrlFEnabled',
      'submitterUsername',
      'cardSize',
      'isStreamerMode',
      'contentApiProvider',
      'searchApiProvider',
      'sidebarAutoHide',
      'sidebarPosition'
    ],
    beforeHydrate: beforeHydrateMainStore
  }
})
