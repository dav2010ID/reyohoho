import { shallowMount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MovieSearch from './MovieSearch.vue'
import RandomMovieModal from './RandomMovieModal.vue'

const mocks = vi.hoisted(() => ({ random: vi.fn(), info: vi.fn(), top: vi.fn() }))
vi.mock('@/api/movies', () => ({
  getRandomMovie: mocks.random,
  getKpInfo: mocks.info,
  getMovies: mocks.top,
  apiSearch: vi.fn(),
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
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
    })
  })
  afterEach(() => {
    wrapper.unmount()
    vi.restoreAllMocks()
  })
  const modal = () => wrapper.findComponent(RandomMovieModal)
  const open = async () => {
    await wrapper.find('.random-button').trigger('click')
    await flushPromises()
  }
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
