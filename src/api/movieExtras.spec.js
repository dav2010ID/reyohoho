import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getMovieExtras: vi.fn(), loadProvider: vi.fn() }))
vi.mock('./providerRegistry', () => ({
  CONTENT_PROVIDERS: { KINOBOX: 'kinobox' },
  loadProvider: mocks.loadProvider
}))

const card = { kp_id: 361, source: 'kinobox' }
const load = () => import('./movieExtras')

beforeEach(() => {
  vi.resetModules()
  mocks.getMovieExtras.mockReset()
  mocks.loadProvider.mockReset().mockResolvedValue({ getMovieExtras: mocks.getMovieExtras })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('movie extras loading', () => {
  it('asks the Worker adapter for a Worker-sourced card', async () => {
    const { getMovieExtras } = await load()
    const signal = new AbortController().signal
    mocks.getMovieExtras.mockResolvedValue({ slogan: 'Тест' })
    expect(await getMovieExtras(card, { signal })).toEqual({ slogan: 'Тест' })
    expect(mocks.loadProvider).toHaveBeenCalledWith('kinobox')
    expect(mocks.getMovieExtras).toHaveBeenCalledWith(361, { signal })
  })
  it('skips cards from sources that already carry their own related data', async () => {
    const { getMovieExtras } = await load()
    expect(await getMovieExtras({ kp_id: 361, source: 'backend' })).toBe(null)
    expect(await getMovieExtras(null)).toBe(null)
    expect(mocks.loadProvider).not.toHaveBeenCalled()
  })
  it('returns nothing instead of failing the card, then pauses further attempts', async () => {
    vi.useFakeTimers()
    const { getMovieExtras } = await load()
    mocks.getMovieExtras.mockRejectedValue(new Error('Request failed with status code 503'))
    expect(await getMovieExtras(card)).toBe(null)
    expect(await getMovieExtras({ ...card, kp_id: 301 })).toBe(null)
    expect(mocks.getMovieExtras).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5 * 60000 + 1)
    mocks.getMovieExtras.mockResolvedValue({ slogan: 'Тест' })
    expect(await getMovieExtras(card)).toEqual({ slogan: 'Тест' })
  })
  it('does not pause after the caller cancels a request', async () => {
    const { getMovieExtras } = await load()
    const controller = new AbortController()
    mocks.getMovieExtras.mockImplementation(async () => {
      controller.abort()
      throw Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' })
    })
    expect(await getMovieExtras(card, { signal: controller.signal })).toBe(null)
    mocks.getMovieExtras.mockReset().mockResolvedValue({ slogan: 'Тест' })
    expect(await getMovieExtras(card)).toEqual({ slogan: 'Тест' })
  })
})

describe('movie extras merge', () => {
  it('fills only the fields the card lacks', async () => {
    const { missingMovieExtras } = await load()
    const movie = { slogan: null, imdb_id: 'tt0000001', similars: [], videos: [{ videoId: 'own' }] }
    const extras = {
      slogan: 'Тест',
      imdb_id: 'tt0137523',
      logo_url: 'https://avatars.mds.yandex.net/logo',
      similars: [{ film_id: 301 }],
      videos: [{ videoId: 'other' }],
      rating_metacritic: null
    }
    expect(missingMovieExtras(movie, extras)).toEqual({
      slogan: 'Тест',
      logo_url: 'https://avatars.mds.yandex.net/logo',
      similars: [{ film_id: 301 }]
    })
    expect(missingMovieExtras(movie, null)).toEqual({})
  })
})
