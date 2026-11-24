import { createTestingPinia } from '@pinia/testing'
import { config, flushPromises, shallowMount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const useHeadMock = vi.fn()
const getKpInfoMock = vi.fn()
const getMovieExtrasMock = vi.fn()
const authMock = { token: '', isWorkerSession: false }
const routeMock = reactive({ params: { kp_id: '123' }, query: {}, hash: '' })
const mainMock = {
  isMobile: false,
  isHistoryAllowed: false,
  contentApiProvider: 'ddbb_live',
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
  getKpInfo: getKpInfoMock
}))

vi.mock('@/api/movieExtras', async () => ({
  ...(await vi.importActual('@/api/movieExtras')),
  getMovieExtras: getMovieExtrasMock
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
  // The header facts sit in a Teleport (moved to the summary on phones); render its content in place.
  const teleportStub = config.global.stubs.teleport
  beforeAll(() => {
    config.global.stubs.teleport = true
  })
  afterAll(() => {
    config.global.stubs.teleport = teleportStub
  })
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(async () => {
    await Promise.all([
      import('./PlayerComponent.vue'),
      import('./movie/MovieMobileListDropdown.vue')
    ])
    authMock.token = ''
    routeMock.params.kp_id = '123'
    authMock.isWorkerSession = false
    mainMock.contentApiProvider = 'ddbb_live'
    mainMock.isMobile = false
    mainMock.isHistoryAllowed = false
    useHeadMock.mockReset()
    getKpInfoMock.mockReset()
    getMovieExtrasMock.mockReset().mockResolvedValue(null)
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
      await vi.waitFor(() =>
        expect(wrapper.findAllComponents({ name: 'PlayerComponent' })).toHaveLength(1)
      )
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

  it('renders the player and Kinopoisk link without backend-only widgets', async () => {
    authMock.token = `rh1_${'a'.repeat(43)}`
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { RouterLink: true } }
    })
    try {
      await vi.waitFor(() =>
        expect(wrapper.findComponent({ name: 'PlayerComponent' }).exists()).toBe(true)
      )
      expect(
        wrapper.find('.action-buttons-group, #movie-comments, .movie-note-display').exists()
      ).toBe(false)
      expect(wrapper.find('a[href*="kinopoisk.ru/film/"]').exists()).toBe(true)
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
              Notification: { template: '<div />', methods: { showNotification: vi.fn() } },
            MovieList: true,
            TrailerCarousel: true,
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
          MovieList: true,
          Notification: true,
          TrailerCarousel: true,
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
              MovieList: true,
            Notification: true,
            TrailerCarousel: true,
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

  it('fills in similar titles, tagline and extra ratings when extras arrive after the card', async () => {
    const card = {
      kp_id: 123,
      name_ru: 'Fetched Movie',
      description: 'Fetched description',
      slogan: null,
      similars: [],
      source: 'worker'
    }
    getKpInfoMock.mockResolvedValue(card)
    let deliver
    getMovieExtrasMock.mockReturnValue(new Promise((resolve) => (deliver = resolve)))
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { RouterLink: true } }
    })
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain('Fetched Movie'))
      expect(wrapper.findComponent({ name: 'MovieList' }).exists()).toBe(false)
      expect(getMovieExtrasMock.mock.calls[0][0]).toMatchObject({ kp_id: 123, source: 'worker' })
      deliver({
        slogan: 'Extra tagline',
        name_ru: 'Must not replace the title',
        rating_tmdb: 8.4,
        tmdb_id: 550,
        tmdb_type: 'movie',
        rating_rotten_tomatoes: 81,
        rating_metacritic: 67,
        similars: [{ film_id: 301, kp_id: 301, name_ru: 'Матрица' }]
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Extra tagline')
      // Extra ratings sit in the ratings row above the player, not in the details list.
      const chips = wrapper
        .findAll('.ratings-links .extra-rating')
        .map((chip) => [
          chip.find('img.rating-logo').attributes('alt'),
          chip.find('.rating-value').text()
        ])
      expect(chips).toEqual([
        ['TMDB', '8.4'],
        ['Rotten Tomatoes', '81%'],
        ['Metacritic', '67']
      ])
      const tmdbLink = wrapper.find('.ratings-links a[href="https://www.themoviedb.org/movie/550"]')
      expect(tmdbLink.exists()).toBe(true)
      expect(tmdbLink.attributes('rel')).toBe('noopener noreferrer')
      expect(wrapper.find('.additional-info').text()).not.toContain('Rotten Tomatoes')
      expect(wrapper.text()).not.toContain('Must not replace the title')
      expect(wrapper.findComponent({ name: 'MovieList' }).props('moviesList')).toEqual([
        expect.objectContaining({ kp_id: 301, title: 'Матрица' })
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('ignores extras that arrive after navigation to another title', async () => {
    getKpInfoMock.mockImplementation(async (id) => ({
      kp_id: Number(id),
      name_ru: 'Movie ' + id,
      slogan: null,
      source: 'worker'
    }))
    let deliverFirst
    getMovieExtrasMock
      .mockReturnValueOnce(new Promise((resolve) => (deliverFirst = resolve)))
      .mockResolvedValue(null)
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { RouterLink: true } }
    })
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain('Movie 123'))
      routeMock.params.kp_id = '124'
      await vi.waitFor(() => expect(wrapper.text()).toContain('Movie 124'))
      deliverFirst({ slogan: 'Tagline of the previous title' })
      await flushPromises()
      expect(wrapper.text()).not.toContain('Tagline of the previous title')
    } finally {
      wrapper.unmount()
    }
  })

  it('groups cast and crew into one panel with a link to the full cast', async () => {
    const person = (id, role) => ({
      staff_id: id,
      name_ru: 'Person ' + id,
      poster_url: '',
      profession_key: role
    })
    getKpInfoMock.mockResolvedValue({
      kp_id: 123,
      name_ru: 'Fetched Movie',
      source: 'worker',
      staff: [
        ...Array.from({ length: 14 }, (_, index) => person(index + 1, 'ACTOR')),
        person(100, 'DIRECTOR'),
        ...Array.from({ length: 7 }, (_, index) => person(200 + index, 'PRODUCER'))
      ]
    })
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { RouterLink: true, teleport: true }
      }
    })
    try {
      await vi.waitFor(() => expect(wrapper.find('#movie-staff').exists()).toBe(true))
      const panel = wrapper.find('#movie-staff')
      expect(panel.findAll('.staff-item')).toHaveLength(12)
      const more = panel.find('.movie-panel-link')
      expect(more.text()).toContain('Все актёры')
      expect(more.attributes('href')).toBe('https://www.kinopoisk.ru/film/123/cast/')
      const rows = panel.findAll('.crew-row')
      expect(rows.map((row) => row.find('dt').text())).toEqual(['Режиссёр', 'Продюсеры'])
      // Five names and an "и ещё 2" link to the full crew.
      expect(
        rows[1]
          .findAll('.staff-name-link')
          .map((link) => link.text())
          .at(-1)
      ).toBe('и ещё 2')
      expect(rows[1].findAll('.staff-name-link')).toHaveLength(6)
    } finally {
      wrapper.unmount()
    }
  })

  it('does not draw an empty cast panel', async () => {
    getKpInfoMock.mockResolvedValue({ kp_id: 123, name_ru: 'Fetched Movie', staff: [] })
    const MovieInfo = (await import('./MovieInfo.vue')).default
    const wrapper = shallowMount(MovieInfo, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { RouterLink: true, teleport: true }
      }
    })
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain('Fetched Movie'))
      expect(wrapper.find('#movie-staff').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
