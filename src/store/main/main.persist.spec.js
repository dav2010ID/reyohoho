import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { useBackgroundStore } from '../background'
import {
  BACKGROUND_STORE_NAME,
  LEGACY_STORE_KEY,
  MAIN_STORE_NAME,
  PLAYER_STORE_NAME
} from '../constants'
import { usePlayerStore } from '../player'
import { useMainStore } from './main'

const pickMainPersistedState = (state) => ({
  history: state.history,
  isHistoryAllowed: state.isHistoryAllowed,
  isCommentsEnabled: state.isCommentsEnabled,
  isAutoShowComments: state.isAutoShowComments,
  commentsSortBy: state.commentsSortBy,
  isCtrlFEnabled: state.isCtrlFEnabled,
  submitterUsername: state.submitterUsername,
  cardSize: state.cardSize,
  isStreamerMode: state.isStreamerMode,
  rememberScrollPosition: state.rememberScrollPosition,
  contentApiProvider: state.contentApiProvider,
  searchApiProvider: state.searchApiProvider
})

describe('Базовы persist тесты для main', () => {
  let app = null
  let pinia = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    vi.spyOn(window.localStorage.__proto__, 'setItem')
    vi.spyOn(window.localStorage.__proto__, 'getItem')

    // eslint-disable-next-line vue/one-component-per-file
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
    const store = useMainStore()

    const testData = {
      history: [
        {
          kp_id: '1',
          title: 'Existing Movie',
          year: 2000,
          type: 'FILM',
          poster: 'poster.jpg',
          addedAt: new Date().toISOString()
        },

        {
          kp_id: '2',
          title: 'Existing Movie 2',
          year: 2001,
          type: 'FILM',
          poster: 'poster.jpg',
          addedAt: new Date().toISOString()
        }
      ],
      isHistoryAllowed: false
    }

    store.setHistory(testData.history)
    store.setHistoryAllowed(testData.isHistoryAllowed)

    // Плагин может писать в localStorage асинхронно, ждём тик
    await flushPromises()

    expect(window.localStorage.getItem(MAIN_STORE_NAME)).toEqual(
      JSON.stringify(pickMainPersistedState(store.$state))
    )
  })
})

describe('Тесты миграций на новый способ хранения данных в локальном хранилище в браузере', () => {
  let app = null
  let pinia = null

  const OLD_LOCAL_STORAGE_DATA = {
    history: [
      {
        kp_id: '1253633',
        title: 'Ход королевы',
        year: 2020,
        type: 'MINI_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1253633.jpg',
        addedAt: '2025-03-27T12:18:28.770Z'
      },
      {
        kp_id: '1332407',
        title: 'В поисках любви',
        year: 2021,
        type: 'MINI_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1332407.jpg',
        addedAt: '2025-03-24T22:23:46.889Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-24T17:21:19.311Z'
      },
      {
        kp_id: '1055528',
        title: 'Побег из Претории',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1055528.jpg',
        addedAt: '2025-03-22T10:09:29.467Z'
      },
      {
        kp_id: '258048',
        title: 'Побег',
        year: 2005,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/258048.jpg',
        addedAt: '2025-03-22T10:09:26.047Z'
      },
      {
        kp_id: '1009536',
        title: 'Джон Уик 3',
        year: 2019,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1009536.jpg',
        addedAt: '2025-03-22T09:39:18.148Z'
      },
      {
        kp_id: '885658',
        title: 'Джон Уик 2',
        year: 2017,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/885658.jpg',
        addedAt: '2025-03-22T09:39:13.988Z'
      },
      {
        kp_id: '762738',
        title: 'Джон Уик',
        year: 2014,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/762738.jpg',
        addedAt: '2025-03-22T09:39:09.405Z'
      },
      {
        kp_id: '79848',
        title: 'Сопрано',
        year: 1999,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/79848.jpg',
        addedAt: '2025-03-22T09:38:53.626Z'
      },
      {
        kp_id: '470689',
        title: 'Пассажиры',
        year: '',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/470689.jpg',
        addedAt: '2025-03-17T20:46:30.918Z'
      }
    ],
    background: {
      backgroundUrl: '/reyohoho/assets/image-back-stars.png',
      topMoviePoster: '',
      moviePoster: '',
      isBlurActive: false,
      backgroundType: 'stars',
      defaultBackground: '/reyohoho/assets/image-back-stars.png',
      isCardBorder: false,
      isCardHoverDisabled: false
    },
    player: {
      aspectRatio: '4:3',
      isCentered: false,
      preferredPlayer: 'ALLOHA',
      showFavoriteTooltip: true,
      kinobdSourceByKpId: {},
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
    },
    isHistoryAllowed: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    window.localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(OLD_LOCAL_STORAGE_DATA))

    vi.spyOn(window.localStorage.__proto__, 'setItem')
    vi.spyOn(window.localStorage.__proto__, 'getItem')

    // eslint-disable-next-line vue/one-component-per-file
    app = createApp({})
    pinia = createPinia()

    pinia.use(piniaPluginPersistedstate)
    app.use(pinia)
  })

  afterEach(() => {
    app = null
    pinia = null

    window.localStorage.setItem(LEGACY_STORE_KEY, null)
  })

  it('Проверяем, что pinia получает данные из старого ключа localStorage', async () => {
    const store = useMainStore()
    const playerStore = usePlayerStore()
    const backgroundStore = useBackgroundStore()

    expect(store.history).toEqual(OLD_LOCAL_STORAGE_DATA.history)
    expect(store.isHistoryAllowed).toEqual(OLD_LOCAL_STORAGE_DATA.isHistoryAllowed)

    expect(playerStore.aspectRatio).toEqual(OLD_LOCAL_STORAGE_DATA.player.aspectRatio)
    expect(playerStore.isCentered).toEqual(OLD_LOCAL_STORAGE_DATA.player.isCentered)
    expect(playerStore.preferredPlayer).toEqual(OLD_LOCAL_STORAGE_DATA.player.preferredPlayer)

    expect(backgroundStore.backgroundUrl).toEqual(OLD_LOCAL_STORAGE_DATA.background.backgroundUrl)
    expect(backgroundStore.topMoviePoster).toEqual(OLD_LOCAL_STORAGE_DATA.background.topMoviePoster)
    expect(backgroundStore.moviePoster).toEqual(OLD_LOCAL_STORAGE_DATA.background.moviePoster)
    expect(backgroundStore.isBlurActive).toEqual(OLD_LOCAL_STORAGE_DATA.background.isBlurActive)
    expect(backgroundStore.backgroundType).toEqual(OLD_LOCAL_STORAGE_DATA.background.backgroundType)
    expect(backgroundStore.defaultBackground).toEqual(
      OLD_LOCAL_STORAGE_DATA.background.defaultBackground
    )
    expect(backgroundStore.isCardBorder).toEqual(OLD_LOCAL_STORAGE_DATA.background.isCardBorder)
    expect(backgroundStore.isCardHoverDisabled).toEqual(
      OLD_LOCAL_STORAGE_DATA.background.isCardHoverDisabled
    )
  })

  it('Проверяем, что данные из старого ключа localStorage переносятся в новые ключи и старый ключ удаляется', async () => {
    useMainStore()
    usePlayerStore()
    useBackgroundStore()

    await flushPromises()

    expect(JSON.parse(window.localStorage.getItem(MAIN_STORE_NAME))).toEqual({
      history: OLD_LOCAL_STORAGE_DATA.history,
      isHistoryAllowed: OLD_LOCAL_STORAGE_DATA.isHistoryAllowed
    })
    expect(JSON.parse(window.localStorage.getItem(PLAYER_STORE_NAME))).toEqual(
      OLD_LOCAL_STORAGE_DATA.player
    )

    expect(JSON.parse(window.localStorage.getItem(BACKGROUND_STORE_NAME))).toEqual(
      OLD_LOCAL_STORAGE_DATA.background
    )
    expect(window.localStorage.getItem(LEGACY_STORE_KEY)).toEqual(null)
  })

  it('Проверяем, что старые данные можно изменить и что изменения сохраняются', async () => {
    const store = useMainStore()
    const playerStore = usePlayerStore()
    const backgroundStore = useBackgroundStore()

    const resultData = {
      history: [],
      isHistoryAllowed: true,
      player: { ...OLD_LOCAL_STORAGE_DATA.player, preferredPlayer: null },
      background: {
        backgroundUrl: '/reyohoho/assets/image-back-stars.png',
        topMoviePoster: '',
        moviePoster: '',
        isBlurActive: false,
        backgroundType: 'stars',
        defaultBackground: '/reyohoho/assets/image-back-stars.png',
        isCardBorder: true,
        isCardHoverDisabled: false
      },
      main: {
        history: [],
        isHistoryAllowed: true,
        isCommentsEnabled: true,
        isAutoShowComments: false,
        commentsSortBy: 'rating',
        isCtrlFEnabled: true,
        submitterUsername: '',
        cardSize: 'medium',
        isStreamerMode: true,
        rememberScrollPosition: true,
        contentApiProvider: 'kinobd',
        searchApiProvider: 'rhserv'
      }
    }

    store.clearAllHistory()
    expect(store.history).toEqual(resultData.history)

    playerStore.clearPreferredPlayer()
    expect(playerStore.preferredPlayer).toEqual(resultData.player.preferredPlayer)

    backgroundStore.toggleCardBorder(true)
    expect(backgroundStore.isCardBorder).toEqual(resultData.background.isCardBorder)

    await flushPromises()

    expect(JSON.parse(window.localStorage.getItem(MAIN_STORE_NAME))).toEqual(resultData.main)

    expect(JSON.parse(window.localStorage.getItem(PLAYER_STORE_NAME))).toEqual(resultData.player)

    expect(JSON.parse(window.localStorage.getItem(BACKGROUND_STORE_NAME))).toEqual(
      resultData.background
    )
  })
})
