import { createTestingPinia } from '@pinia/testing'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useHeadMock = vi.fn()
const getKpInfoMock = vi.fn()
const authMock = { token: '' }
const mainMock = {
  isCommentsEnabled: true,
  isStreamerMode: false,
  isMobile: false,
  isHistoryAllowed: false,
  addToHistory: vi.fn()
}

vi.mock('@unhead/vue', () => ({
  useHead: useHeadMock
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { kp_id: '123' },
    query: {},
    hash: ''
  }),
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
    HISTORY: 'history', FAVORITE: 'favorite', LATER: 'later',
    WATCHING: 'watching', COMPLETED: 'completed', ABANDONED: 'abandoned'
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
      import('./PlayerComponent.vue'), import('./MovieRating.vue'),
      import('./movie/MovieMobileListDropdown.vue')
    ])
    authMock.token = ''
    mainMock.isMobile = false
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

  it(
    'uses the initial SEO entry before client fetch resolves',
    async () => {
      const MovieInfo = (await import('./MovieInfo.vue')).default
      shallowMount(MovieInfo, {
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
    },
    10000
  )

  it.each([false, true])('keeps the player mounted when toggling favorite (mobile=%s)', async (mobile) => {
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
            template: '<div><iframe src="about:blank"></iframe><button type="button" @click="$emit(\'toggle-list\', \'favorite\')">Favorite</button></div>'
          },
          MovieRating: true,
          Notification: { template: '<div />', methods: { showNotification: vi.fn() } },
          MovieList: true, TrailerCarousel: true, Comments: true, RouterLink: true
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
      const trigger = () => mobile
        ? wrapper.findComponent({ name: 'MovieMobileListDropdown' }).vm.$emit('toggle-list', 'favorite')
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
  })
})
