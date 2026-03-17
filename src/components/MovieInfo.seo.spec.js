import { createTestingPinia } from '@pinia/testing'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useHeadMock = vi.fn()
const getKpInfoMock = vi.fn()

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
  delFromList: vi.fn()
}))

vi.mock('@/utils/dateUtils', () => ({
  formatDate: vi.fn(),
  parseTimingTextToSeconds: vi.fn(),
  formatSecondsToTime: vi.fn()
}))

vi.mock('@/constants', () => ({
  TYPES_ENUM: {},
  USER_LIST_TYPES_ENUM: { HISTORY: 'history' },
  handleApiError: () => ({ message: 'error', code: 500 })
}))

vi.mock('@/store/background', () => ({
  useBackgroundStore: () => ({
    updateMoviePoster: vi.fn()
  })
}))

vi.mock('@/store/main', () => ({
  useMainStore: () => ({
    isCommentsEnabled: true,
    isStreamerMode: false,
    isMobile: false,
    isHistoryAllowed: false,
    addToHistory: vi.fn()
  })
}))

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    token: ''
  })
}))

vi.mock('@/store/navbar', () => ({
  useNavbarStore: () => ({
    setHeaderContent: vi.fn()
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
  beforeEach(() => {
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
  })
})
