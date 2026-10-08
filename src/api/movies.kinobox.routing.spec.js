import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn()
}))
vi.mock('axios', () => ({
  default: {
    create: mocks.create
  }
}))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_KINOBOX_API_URL', '')
  vi.stubEnv('VITE_KINOBOX_SEARCH_API_URL', '')
  mocks.get.mockReset()
  mocks.create.mockReset().mockReturnValue({ get: mocks.get })
})
afterEach(() => vi.unstubAllEnvs())

describe('Kinobox content proxy routing', () => {
  it('loads top cards through the shared Worker, not a browser GraphQL call', async () => {
    const { getTopMovies } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              position: 1,
              movie: {
                id: 258687,
                type: 'Film',
                title: { russian: 'Интерстеллар', original: 'Interstellar' },
                gallery: { posterUrl: '//poster.test/card' },
                year: 2014,
                rating: { kinopoisk: { value: 8.685, count: 42 } }
              }
            }
          ]
        }
      }
    })
    const movies = await getTopMovies({ typeFilter: 'series', page: 2, limit: 36 })
    expect(mocks.get).toHaveBeenCalledWith('/api/kinopoisk/top', {
      params: { type: 'series', page: 2, limit: 36 },
      timeout: 20000
    })
    expect(movies[0]).toMatchObject({
      kp_id: 258687,
      title: 'Интерстеллар',
      source: 'kinopoisk',
      poster_url: 'https://poster.test/card/300x450',
      position: 1
    })
  })
  it('routes search to the permanent Worker and keeps request cancellation', async () => {
    const { apiSearch } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({
      data: { data: { items: [{ id: 301, title: { russian: 'Матрица' } }] } }
    })
    const signal = new AbortController().signal
    const results = await apiSearch('Матрица', { signal, timeout: 20000 })
    expect(mocks.get).toHaveBeenCalledWith(
      '/api/movies/search/',
      expect.objectContaining({
        baseURL: 'https://api.reyhoho.fun',
        signal,
        timeout: 20000,
        params: { query: 'Матрица', ts: expect.any(Number) }
      })
    )
    expect(results[0]).toMatchObject({ id: 301, title: 'Матрица' })
  })

  it('supports a separate search endpoint override', async () => {
    vi.stubEnv('VITE_KINOBOX_SEARCH_API_URL', 'https://search.example')
    const { apiSearch } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({ data: { data: { items: [] } } })
    await apiSearch('Matrix')
    expect(mocks.get.mock.calls[0][1].baseURL).toBe('https://search.example')
  })

  it('uses the same Worker for movie details and players', async () => {
    const { getKpInfo, getPlayersRaw } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({ data: { data: { movie: { id: 301 } } } })
    await getKpInfo(301)
    mocks.get.mockResolvedValue({ data: { data: [] } })
    await getPlayersRaw(301)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.reyhoho.fun'
      })
    )
    expect(mocks.get.mock.calls[0][1]).not.toHaveProperty('baseURL')
    expect(mocks.get.mock.calls[1][1]).not.toHaveProperty('baseURL')
  })

  it('uses the general API override for search when no separate override is set', async () => {
    vi.stubEnv('VITE_KINOBOX_API_URL', 'https://kinobox-proxy.example')
    const { apiSearch } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({ data: { data: { items: [] } } })
    await apiSearch('Matrix')
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://kinobox-proxy.example'
      })
    )
    expect(mocks.get.mock.calls[0][1].baseURL).toBe('https://kinobox-proxy.example')
  })
})
