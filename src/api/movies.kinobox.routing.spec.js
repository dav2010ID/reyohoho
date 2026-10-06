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

describe('Kinobox search proxy routing', () => {
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
        baseURL: 'https://lively-cloud-4e31.reyohoho-search.workers.dev',
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

  it('does not send movie details or players to the search-only Worker', async () => {
    const { getKpInfo, getPlayersRaw } = await import('./movies.kinobox')
    mocks.get.mockResolvedValue({ data: { data: { movie: { id: 301 } } } })
    await getKpInfo(301)
    mocks.get.mockResolvedValue({ data: { data: [] } })
    await getPlayersRaw(301)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.kinobox.tv'
      })
    )
    expect(mocks.get.mock.calls[0][1]).not.toHaveProperty('baseURL')
    expect(mocks.get.mock.calls[1][1]).not.toHaveProperty('baseURL')
  })
})
