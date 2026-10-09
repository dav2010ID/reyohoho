import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CardMovie from './CardMovie.vue'
import { repairCardRatings } from '@/api/user'
import { useMainStore } from '@/store/main'

vi.mock('@/api/user', () => ({ repairCardRatings: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: {}, query: {} }) }))
const movie = {
  kp_id: '301',
  title: 'Матрица',
  poster: 'https://example.com/poster.jpg',
  year: 1999,
  type: 'FILM',
  addedAt: '2000-01-01'
}
let intersect, wrapper
const mountCard = (card = movie) => {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  useMainStore(pinia).setHistory([card])
  wrapper = mount(CardMovie, {
    props: { movie: card, isHistory: true },
    global: {
      plugins: [pinia],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
      directives: {
        lazy: {
          mounted: (element, binding) => {
            element.src = binding.value
          }
        }
      }
    }
  })
  return useMainStore(pinia)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        intersect = callback
      }
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

describe('lazy history card ratings', () => {
  it('does not trigger a request loop after a failed metadata lookup', async () => {
    repairCardRatings.mockResolvedValue(movie)
    const store = mountCard()
    const original = store.history[0]
    intersect([{ isIntersecting: true }])
    await flushPromises()
    expect(store.history[0]).toBe(original)
    expect(repairCardRatings).toHaveBeenCalledTimes(1)
  })
  it('loads only visible old cards and renders ratings without changing viewing dates', async () => {
    repairCardRatings.mockResolvedValue({
      ...movie,
      rating_kp: 8.5,
      rating_imdb: 8.7,
      ratings_checked: 1
    })
    const store = mountCard()
    expect(repairCardRatings).not.toHaveBeenCalled()
    intersect([{ isIntersecting: true }])
    await flushPromises()
    expect(wrapper.get('.rating-kp').text()).toBe('8.5')
    expect(wrapper.get('.rating-imdb').text()).toBe('8.7')
    expect(store.history[0]).toMatchObject({
      rating_kp: 8.5,
      rating_imdb: 8.7,
      addedAt: '2000-01-01'
    })
  })
  it('does not request existing ratings', async () => {
    mountCard({ ...movie, rating_kp: 8.5 })
    intersect([{ isIntersecting: true }])
    await flushPromises()
    expect(repairCardRatings).not.toHaveBeenCalled()
    expect(wrapper.get('.rating-kp').text()).toBe('8.5')
  })
  it('never re-adds a history entry deleted during metadata loading', async () => {
    let resolve
    repairCardRatings.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const store = mountCard()
    intersect([{ isIntersecting: true }])
    store.removeFromHistory('301')
    resolve({ ...movie, rating_kp: 8.5, ratings_checked: 1 })
    await flushPromises()
    expect(store.history).toEqual([])
  })
})
