import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import TopMovies from './TopMovies.vue'

const mocks = vi.hoisted(() => ({
  getMovies: vi.fn(),
  getDiscussedMovies: vi.fn(),
  push: vi.fn(),
  route: { query: {} },
  store: { contentApiProvider: 'kinobox' }
}))
vi.mock('@/api/movies', () => ({
  getMovies: mocks.getMovies,
  getDiscussedMovies: mocks.getDiscussedMovies
}))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.store }))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push })
}))
vi.mock('@unhead/vue', () => ({ useHead: vi.fn() }))

let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  mocks.route = reactive({ query: {} })
  mocks.store = reactive({ contentApiProvider: 'kinobox' })
  mocks.getMovies.mockResolvedValue([{ kp_id: 258687, title: 'Интерстеллар' }])
})
afterEach(() => wrapper?.unmount())
const render = () =>
  mount(TopMovies, {
    global: { stubs: { MovieList: true, ErrorMessage: true } }
  })

describe('top page source semantics', () => {
  it('shows the Kinopoisk top, not fabricated daily/popular/discussed filters', async () => {
    mocks.route.query = { time: '24h', type: 'all' }
    wrapper = render()
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('Топ-250 Кинопоиска')
    expect(wrapper.find('.time-card').exists()).toBe(false)
    expect(wrapper.findAll('.type-btn').map((button) => button.text())).toEqual([
      'Фильмы',
      'Сериалы'
    ])
    expect(mocks.getMovies).toHaveBeenCalledWith({
      activeTime: 'top250',
      typeFilter: 'movie',
      page: 1,
      limit: 36
    })
    expect(mocks.getDiscussedMovies).not.toHaveBeenCalled()
  })
  it('loads the series list for a series route', async () => {
    mocks.route.query = { type: 'series' }
    wrapper = render()
    await flushPromises()
    expect(mocks.getMovies).toHaveBeenCalledWith(
      expect.objectContaining({ typeFilter: 'series', activeTime: 'top250' })
    )
  })
  it('preserves the local backend time filters', async () => {
    mocks.store.contentApiProvider = 'local'
    mocks.route.query = { time: '7d', type: 'all' }
    wrapper = render()
    await flushPromises()
    expect(wrapper.find('.time-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Обсуждаемое')
    expect(mocks.getMovies).toHaveBeenCalledWith(expect.objectContaining({ activeTime: '7d' }))
  })
})
