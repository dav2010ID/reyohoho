import { shallowMount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MovieSearch from './MovieSearch.vue'
import RandomMovieModal from './RandomMovieModal.vue'
import { MovieList } from './MovieList'
import { useMainStore } from '@/store/main'
import { useApiStore } from '@/store/api'

const mocks = vi.hoisted(() => ({ random: vi.fn(), info: vi.fn(), top: vi.fn(), search: vi.fn() }))
vi.mock('@/api/movies', () => ({
  getRandomMovie: mocks.random,
  getKpInfo: mocks.info,
  getMovies: mocks.top,
  apiSearch: mocks.search,
  getKpIDfromIMDB: vi.fn(),
  getKpIDfromSHIKI: vi.fn()
}))
vi.mock('@unhead/vue', () => ({ useHead: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/user', () => ({ getMyLists: vi.fn(), delAllFromList: vi.fn() }))

describe('random film interaction', () => {
  let wrapper
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_APP_API_URL', '')
    localStorage.clear()
    mocks.top.mockResolvedValue([])
    mocks.random.mockResolvedValue({
      kp_id: 301,
      title: 'Матрица',
      film_length: 136,
      source: 'kinopoisk'
    })
    mocks.info.mockResolvedValue({ description: 'Описание', film_length: '02:16:00' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    wrapper = shallowMount(MovieSearch, {
      attachTo: document.body,
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          MovieList: {
            props: ['moviesList', 'loading'],
            template:
              '<div><button v-for="movie in moviesList" :key="movie.kp_id" class="movie-card">{{ movie.title }}</button></div>'
          }
        }
      }
    })
  })
  afterEach(() => {
    wrapper.unmount()
    window.location.hash = ''
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })
  const modal = () => wrapper.findComponent(RandomMovieModal)
  it('shows only ID searches served by the selected configuration', async () => {
    const tabs = () => wrapper.get('.search-type-buttons').text()
    expect(tabs()).toContain('ID Кинопоиск')
    expect(tabs()).not.toContain('ID IMDB')
    expect(tabs()).not.toContain('ID Shikimori')
    useMainStore().contentApiProvider = 'local'
    await flushPromises()
    expect(tabs()).toContain('ID Shikimori')
    expect(tabs()).not.toContain('ID IMDB')
    useApiStore().$patch({ backendMode: 'local', backendModeUserSelected: true })
    await flushPromises()
    expect(tabs()).toContain('ID IMDB')
    await wrapper.findAll('.search-type-buttons button').find(b => b.text() === 'ID IMDB').trigger('click')
    useApiStore().backendMode = 'auto'
    await flushPromises()
    expect(wrapper.get('.search-type-buttons .active').text()).toBe('Название')
  })
  const open = async () => {
    await wrapper.find('.random-button').trigger('click')
    await flushPromises()
  }
  it('creates history on the first reset of a search link and then retains it', async () => {
    wrapper.unmount()
    window.location.hash = '#search=Result'
    mocks.search.mockResolvedValue([])
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: { main: { history: [{ kp_id: '1', title: 'History' }] } }
    })
    wrapper = shallowMount(MovieSearch, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(
      wrapper.findAllComponents(MovieList).filter((list) => list.props('isHistory'))
    ).toHaveLength(0)
    await wrapper.find('.reset-button').trigger('click')
    const historyList = wrapper.findAllComponents(MovieList).find((list) => list.props('isHistory'))
    expect(historyList.props('moviesList')).toEqual([{ kp_id: '1', title: 'History' }])
    const instance = historyList.vm
    await wrapper.find('.search-input').setValue('again')
    await wrapper.find('.reset-button').trigger('click')
    expect(wrapper.findAllComponents(MovieList).find((list) => list.props('isHistory')).vm).toBe(
      instance
    )
  })
  it('moves focus to search results instead of the retained hidden history', async () => {
    useMainStore().history = [{ kp_id: '1', title: 'History' }]
    mocks.search.mockResolvedValue([{ id: 2, title: 'Result' }])
    await flushPromises()
    await wrapper.find('.search-input').setValue('Result')
    await wrapper.find('.search-button').trigger('click')
    await flushPromises()
    await wrapper.find('.search-input').trigger('keydown.down')
    expect(document.activeElement.textContent).toBe('Result')
  })
  it('preserves the history list while typing and restores current data on reset', async () => {
    const store = useMainStore()
    store.history = [
      { kp_id: '1', title: 'First' },
      { kp_id: '2', title: 'Second' }
    ]
    await flushPromises()
    const list = wrapper.findComponent(MovieList)
    const instance = list.vm
    await wrapper.find('.search-input').setValue('a')
    expect(wrapper.findComponent(MovieList).exists()).toBe(true)
    expect(wrapper.findComponent(MovieList).isVisible()).toBe(false)
    store.history = [store.history[1]]
    await wrapper.find('.reset-button').trigger('click')
    expect(wrapper.findComponent(MovieList).vm).toBe(instance)
    expect(wrapper.findComponent(MovieList).isVisible()).toBe(true)
    expect(wrapper.findComponent(MovieList).props('moviesList')).toEqual(store.history)
  })
  it('loads and enriches a complete movie without legacy error text', async () => {
    await open()
    expect(modal().props('movie')).toMatchObject({
      kp_id: 301,
      title: 'Матрица',
      description: 'Описание',
      duration: 136
    })
    expect(modal().props('loading')).toBe(false)
    expect(modal().props('error')).toBe('')
    expect(mocks.random.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
  })
  it('retains a usable card if optional description loading fails', async () => {
    mocks.info.mockRejectedValue(new Error('Unavailable'))
    await open()
    expect(modal().props('movie')).toMatchObject({ title: 'Матрица', duration: 136 })
    expect(modal().props('error')).toBe('')
  })
  it('clears the previous card on retry and displays a friendly error', async () => {
    await open()
    mocks.random.mockRejectedValue(new Error('Backend API is not configured (VITE_APP_API_URL)'))
    modal().vm.$emit('get-new-movie')
    await flushPromises()
    expect(modal().props('movie')).toBeNull()
    expect(modal().props('error')).toBe(
      'Не удалось подобрать фильм. Попробуйте ещё раз чуть позже.'
    )
    expect(modal().props('loading')).toBe(false)
  })
  it('aborts a closed dialog and ignores its late response after reopening', async () => {
    let resolveOld
    mocks.random.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    await open()
    const oldSignal = mocks.random.mock.calls[0][0].signal
    modal().vm.$emit('close')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    await open()
    resolveOld({ kp_id: 42, title: 'Old request' })
    await flushPromises()
    expect(modal().props('movie')).toMatchObject({ kp_id: 301, title: 'Матрица' })
    expect(mocks.info).toHaveBeenCalledTimes(1)
  })
})
