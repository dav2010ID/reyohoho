import { createTestingPinia } from '@pinia/testing'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const useHeadMock = vi.fn()
const getKpInfoMock = vi.fn()
const authMock = { token: '', isWorkerSession: false }
const routeMock = reactive({ params: { kp_id: '123' }, query: {}, hash: '' })
const mainMock = {
  isCommentsEnabled: true,
  isStreamerMode: false,
  isMobile: false,
  isHistoryAllowed: false,
  contentApiProvider: 'kinobox',
  addToHistory: vi.fn()
}

vi.mock('@unhead/vue', () => ({
  useHead: useHeadMock
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({
    resolve: ({ path }) => ({ href: path }),
    replace: vi.fn()
  })
}))

vi.mock('@/api/movies', () => ({
  getKpInfo: getKpInfoMock,
  getShikiInfo: vi.fn(),
  getNudityInfoFromIMDB: vi.fn(),
  submitTiming: vi.fn(),
  updateTiming: vi.fn(),
  deleteTiming: vi.fn(),
  reportTiming: vi.fn(),
  getTopTimingSubmitters: vi.fn(),
  getAllTimingSubmissions: vi.fn(),
  approveTiming: vi.fn(),
  rejectTiming: vi.fn(),
  markAsCleanText: vi.fn(),
  voteOnTiming: vi.fn(),
  getTimingVote: vi.fn(),
  getMovieNote: vi.fn(),
  saveMovieNote: vi.fn(),
  deleteMovieNote: vi.fn()
}))

vi.mock('@/api/user', () => ({
  addToList: vi.fn(),
  delFromList: vi.fn(),
  getMovieListStatus: vi.fn().mockResolvedValue({})
}))

vi.mock('@/utils/dateUtils', () => ({
  formatDate: vi.fn(),
  parseTimingTextToSeconds: vi.fn(),
  formatSecondsToTime: vi.fn()
}))

vi.mock('@/constants', () => ({
  TYPES_ENUM: {},
  USER_LIST_TYPES_ENUM: {
    HISTORY: 'history',
    FAVORITE: 'favorite',
    LATER: 'later',
    WATCHING: 'watching',
    COMPLETED: 'completed',
    ABANDONED: 'abandoned'
  },
  handleApiError: () => ({ message: 'error', code: 500 })
}))

vi.mock('@/store/background', () => ({
  useBackgroundStore: () => ({
    updateMoviePoster: vi.fn()
  })
}))

vi.mock('@/store/main', () => ({
  useMainStore: () => mainMock
}))

vi.mock('@/store/auth', () => ({
  useAuthStore: () => authMock
}))

vi.mock('@/store/navbar', () => ({
  useNavbarStore: () => ({
    setHeaderContent: vi.fn(),
    clearHeaderContent: vi.fn()
  })
}))

vi.mock('@/store/player', () => ({
  usePlayerStore: () => ({})
}))

vi.mock('@/store/trailer', () => ({
  useTrailerStore: () => ({
    areTrailersActive: false
  })
}))

vi.mock('@/utils/ratingUtils', () => ({
  getRatingColor: vi.fn()
}))

vi.mock('@/utils/movieSeo', async () => {
  const actual = await vi.importActual('@/utils/movieSeo')
  return {
    ...actual,
    getMovieSeoEntry: vi.fn(() => ({
      kp_id: '123',
      title: 'Seed Movie',
      year: '2024',
      description: 'Seed description',
      poster: 'https://example.com/poster.jpg'
    }))
  }
})

describe('MovieInfo SEO', () => {
  beforeEach(async () => {
    await Promise.all([
      import('./PlayerComponent.vue'),
      import('./MovieRating.vue'),
      import('./movie/MovieMobileListDropdown.vue')
    ])
    authMock.token = ''
    routeMock.params.kp_id = '123'
    authMock.isWorkerSession = false
    mainMock.contentApiProvider = 'kinobox'
    mainMock.isMobile = false
    mainMock.isHistoryAllowed = false
    useHeadMock.mockReset()
    getKpInfoMock.mockReset()
    getKpInfoMock.mockResolvedValue({
      kp_id: '123',
      kinopoisk_id: '123',
      name_ru: 'Fetched Movie',
      name_original: 'Fetched Movie',
      year: '2024',
      description: 'Fetched description'
    })
  })

  it('uses the initial SEO entry before client fetch resolves', async () => {
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false
          })
        ],
        stubs: {
          MovieList: true,
          ErrorMessage: true,
          SpinnerLoading: true,
          Notification: true,
          TrailerCarousel: true,
          Comments: true,
          RouterLink: true
        }
      }
    })

    expect(useHeadMock).toHaveBeenCalled()
    const headFactory = useHeadMock.mock.calls[0][0]
    const head = headFactory()

    expect(head.title).toContain('Seed Movie')
    expect(head.link[0].href).toContain('/movie/123/')
    wrapper.unmount()
  }, 10000)

  it('shows one player on catalog fallback and clears the error on retry or navigation', async () => {
    getKpInfoMock.mockRejectedValueOnce(new Error('offline'))
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { RouterLink: true } }
    })
    try {
      const error = () => wrapper.findComponent({ name: 'ErrorMessage' })
      await vi.waitFor(() => expect(wrapper.findAllComponents({ name: 'PlayerComponent' })).toHaveLength(1))
      expect(error().props('showRetry')).toBe(true)
      error().vm.$emit('retry')
      await flushPromises()
      expect(error().exists()).toBe(false)
      getKpInfoMock.mockRejectedValueOnce(new Error('offline'))
      routeMock.params.kp_id = '124'
      await flushPromises()
      expect(error().exists()).toBe(true)
      routeMock.params.kp_id = '125'
      await flushPromises()
      expect(error().exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it.each([false, true])(
    'keeps the player mounted when toggling favorite (mobile=%s)',
    async (mobile) => {
      authMock.token = 'test-session'
      mainMock.isMobile = mobile
      const { addToList, delFromList } = await import('@/api/user')
      addToList.mockReset()
      delFromList.mockReset()
      const MovieInfo = (await import('./MovieInfo.vue')).default
      const wrapper = shallowMount(MovieInfo, {
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn })],
          stubs: {
            PlayerComponent: {
              name: 'PlayerComponent',
              props: ['movieInfo'],
              emits: ['toggle-list'],
              template:
                '<div><iframe src="about:blank"></iframe><button type="button" @click="$emit(\'toggle-list\', \'favorite\')">Favorite</button></div>'
            },
            MovieRating: true,
            Notification: { template: '<div />', methods: { showNotification: vi.fn() } },
            MovieList: true,
            TrailerCarousel: true,
            Comments: true,
            RouterLink: true
          }
        }
      })
      try {
        await vi.waitFor(() => expect(wrapper.find('iframe').exists()).toBe(true))
        await flushPromises()
        const player = wrapper.findComponent({ name: 'PlayerComponent' })
        expect(player.exists()).toBe(true)
        const instance = player.vm
        const iframe = player.find('iframe').element
        const fetchCount = getKpInfoMock.mock.calls.length
        const trigger = () =>
          mobile
            ? wrapper
                .findComponent({ name: 'MovieMobileListDropdown' })
                .vm.$emit('toggle-list', 'favorite')
            : player.find('button').trigger('click')
        await trigger()
        await flushPromises()
        expect(addToList).toHaveBeenCalledTimes(1)
        expect(player.props('movieInfo').lists.isFavorite).toBe(true)
        expect(wrapper.find('.movie-skeleton').exists()).toBe(false)
        expect(wrapper.findComponent({ name: 'PlayerComponent' }).vm).toBe(instance)
        expect(wrapper.find('iframe').element).toBe(iframe)
        expect(getKpInfoMock).toHaveBeenCalledTimes(fetchCount)
        await trigger()
        await flushPromises()
        expect(delFromList).toHaveBeenCalledWith('123', 'favorite')
        expect(player.props('movieInfo').lists.isFavorite).toBe(false)
        expect(wrapper.find('iframe').element).toBe(iframe)
        expect(getKpInfoMock).toHaveBeenCalledTimes(fetchCount)
      } finally {
        wrapper.unmount()
      }
    }
  )

  it('renders details and player while a history write is pending and ignores its result after account change', async () => {
    authMock.token = 'account-A'
    mainMock.isHistoryAllowed = true
    const { addToList, getMovieListStatus } = await import('@/api/user')
    let finishWrite
    addToList.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve
        })
    )
    getMovieListStatus.mockClear()
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          PlayerComponent: {
            name: 'PlayerComponent',
            props: ['movieInfo'],
            template: '<iframe src="about:blank" />'
          },
          MovieRating: true,
          MovieList: true,
          Notification: true,
          TrailerCarousel: true,
          Comments: true,
          RouterLink: true
        }
      }
    })
    try {
      await vi.waitFor(() => expect(wrapper.find('iframe').exists()).toBe(true))
      expect(wrapper.find('#movie-details').exists()).toBe(true)
      expect(wrapper.find('.movie-skeleton').exists()).toBe(false)
      expect(addToList).toHaveBeenCalledWith('123', 'history', expect.any(Object))
      const statusReads = getMovieListStatus.mock.calls.length
      authMock.token = 'account-B'
      finishWrite({})
      await flushPromises()
      expect(getMovieListStatus).toHaveBeenCalledTimes(statusReads)
      expect(
        wrapper.getComponent({ name: 'PlayerComponent' }).props('movieInfo').lists.isHistory
      ).not.toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('mounts scene tools on first use, retains selection while closed and clears it on navigation', async () => {
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          PlayerComponent: { name: 'PlayerComponent', template: '<iframe src="about:blank" />' },
          MovieSceneTools: {
            name: 'MovieSceneTools',
            props: ['mode', 'movieId', 'refreshMovie'],
            emits: ['overlay-selection', 'close'],
            template: '<div class="test-scene-tools" />'
          },
          MovieRating: true,
          MovieList: true,
          Notification: true,
          TrailerCarousel: true,
          Comments: true,
          RouterLink: true
        }
      }
    })
    try {
      await vi.waitFor(() => expect(wrapper.find('iframe').exists()).toBe(true))
      expect(wrapper.find('.test-scene-tools').exists()).toBe(false)
      const button = wrapper.get('button[title^="Показать тайминги"]')
      await button.trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.test-scene-tools').exists()).toBe(true))
      const scene = wrapper.getComponent({ name: 'MovieSceneTools' })
      const instance = scene.vm
      expect(scene.props('mode')).toBe('timings')
      scene.vm.$emit('overlay-selection', [7])
      expect(window.overlayNudityTimings).toEqual([7])
      await button.trigger('click')
      expect(scene.props('mode')).toBe(null)
      await button.trigger('click')
      expect(wrapper.getComponent({ name: 'MovieSceneTools' }).vm).toBe(instance)
      expect(window.overlayNudityTimings).toEqual([7])
      routeMock.params.kp_id = '456'
      await flushPromises()
      expect(wrapper.find('.test-scene-tools').exists()).toBe(false)
      expect(window.overlayNudityTimings).toEqual([])
    } finally {
      wrapper.unmount()
      expect(window.overlayNudityTimings).toBeUndefined()
    }
  })

  it('preserves the iframe while refreshing movie timings', async () => {
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          PlayerComponent: {
            name: 'PlayerComponent',
            props: ['movieInfo'],
            template: '<iframe src="about:blank" />'
          },
          MovieSceneTools: {
            name: 'MovieSceneTools',
            props: ['refreshMovie'],
            template: '<div class="test-scene-tools" />'
          },
          MovieRating: true,
          MovieList: true,
          Notification: true,
          TrailerCarousel: true,
          Comments: true,
          RouterLink: true
        }
      }
    })
    let finishRefresh
    try {
      await vi.waitFor(() => expect(wrapper.find('iframe').exists()).toBe(true))
      const player = wrapper.getComponent({ name: 'PlayerComponent' }).vm
      const iframe = wrapper.get('iframe').element
      await wrapper.get('button[title^="Показать тайминги"]').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.test-scene-tools').exists()).toBe(true))
      const info = {
        ...wrapper.getComponent({ name: 'PlayerComponent' }).props('movieInfo'),
        nudity_timings: [{ id: 7 }]
      }
      getKpInfoMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRefresh = resolve
          })
      )
      const refresh = wrapper.getComponent({ name: 'MovieSceneTools' }).props('refreshMovie')()
      await flushPromises()
      expect(wrapper.find('.movie-skeleton').exists()).toBe(false)
      expect(wrapper.get('iframe').element).toBe(iframe)
      finishRefresh(info)
      await refresh
      await flushPromises()
      expect(wrapper.get('iframe').element).toBe(iframe)
      expect(wrapper.getComponent({ name: 'PlayerComponent' }).vm).toBe(player)
    } finally {
      finishRefresh?.({})
      wrapper.unmount()
    }
  })

  it.each([false, true])(
    'keeps the loading layout while movie data arrives before the player chunk (mobile=%s)',
    async (mobile) => {
      mainMock.isMobile = mobile
      let releasePlayer
      const pendingPlayer = new Promise((resolve) => {
        releasePlayer = resolve
      })
      vi.doMock('@/components/PlayerComponent.vue', async () => {
        await pendingPlayer
        return { default: { name: 'PlayerComponent', template: '<div class="test-player" />' } }
      })
      const MovieInfo = (await import('./MovieInfo.vue')).default
      const wrapper = shallowMount(MovieInfo, {
        global: {
          plugins: [createTestingPinia({ createSpy: vi.fn })],
          stubs: {
            PlayerComponent: { name: 'PlayerComponent', template: '<div class="test-player" />' },
            MovieRating: true,
            MovieList: true,
            Notification: true,
            TrailerCarousel: true,
            Comments: true,
            RouterLink: true
          }
        }
      })
      try {
        await flushPromises()
        expect(getKpInfoMock).toHaveBeenCalledTimes(1)
        expect(wrapper.find('.movie-skeleton').exists()).toBe(true)
        expect(wrapper.find('#movie-details').exists()).toBe(false)
        releasePlayer()
        await vi.waitFor(() => expect(wrapper.find('.test-player').exists()).toBe(true))
        expect(wrapper.find('#movie-details').exists()).toBe(true)
        expect(wrapper.find('.movie-skeleton').exists()).toBe(false)
        expect(getKpInfoMock).toHaveBeenCalledTimes(1)
      } finally {
        releasePlayer()
        await flushPromises()
        wrapper.unmount()
        vi.doUnmock('@/components/PlayerComponent.vue')
      }
    }
  )
})
