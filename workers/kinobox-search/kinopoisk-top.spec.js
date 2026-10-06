import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveKinopoiskTop, requestKinopoiskTop, serveKinopoiskTop } from './kinopoisk-top.mjs'

const resolve = (query = '') =>
  resolveKinopoiskTop(new URL('/api/kinopoisk/top' + query, 'https://proxy.test'))
const payload = (overrides = {}) => ({
  data: {
    movieListBySlug: {
      name: '250 лучших фильмов',
      movies: {
        total: 250,
        items: [
          {
            position: 1,
            movie: {
              id: 258687,
              __typename: 'Film',
              productionYear: 2014,
              title: { russian: 'Интерстеллар', original: 'Interstellar' },
              rating: { kinopoisk: { value: 8.685, count: 42 } },
              gallery: { posters: { vertical: { avatarsUrl: '//poster.test/movie' } } },
              userData: { private: true }
            }
          }
        ],
        ...overrides
      }
    }
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fixed Kinopoisk top proxy', () => {
  it('validates list type, bounded pagination and cache lifetime', () => {
    expect(resolve()).toMatchObject({
      params: { type: 'movie', page: '1', limit: '36' },
      cacheTtl: 3600
    })
    expect(resolve('?type=series&page=7&limit=36').params.type).toBe('series')
    for (const query of [
      '?type=all',
      '?page=0',
      '?page=8',
      '?limit=51',
      '?limit=-1',
      '?page=1.5',
      '?type=__proto__'
    ]) {
      expect(resolve(query).status).toBe(400)
    }
  })
  it('does not handle unrelated routes', () => {
    expect(resolveKinopoiskTop(new URL('https://proxy.test/api/movies/search/'))).toBe(null)
  })
  it('sends the fixed public operation without authentication or user fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload())))
    const data = await requestKinopoiskTop(resolve('?type=series&page=2'), fetcher)
    const [url, request] = fetcher.mock.calls[0]
    expect(url).toBe('https://graphql.kinopoisk.ru/graphql/?operationName=MovieDesktopListPage')
    expect(JSON.parse(request.body).variables).toMatchObject({
      slug: 'series-top250',
      moviesOffset: 36,
      moviesLimit: 36,
      withUserData: false
    })
    expect(request.headers).not.toHaveProperty('Cookie')
    expect(data.data.items[0].movie).not.toHaveProperty('userData')
    expect(data.data.items[0].movie).toMatchObject({ id: 258687, year: 2014 })
  })
  it('rejects HTTP errors and GraphQL errors even with status 200', async () => {
    await expect(
      requestKinopoiskTop(resolve(), async () => new Response('', { status: 403 }))
    ).rejects.toThrow('HTTP 403')
    await expect(
      requestKinopoiskTop(
        resolve(),
        async () =>
          new Response(
            JSON.stringify({
              ...payload(),
              errors: [{ message: 'Not allowed' }]
            })
          )
      )
    ).rejects.toThrow('Invalid Kinopoisk')
  })
  it('rejects malformed or excessive data', async () => {
    for (const body of [
      payload({ total: 251 }),
      payload({ items: [{ movie: { id: -1 } }] }),
      { data: {} }
    ]) {
      await expect(
        requestKinopoiskTop(resolve(), async () => new Response(JSON.stringify(body)))
      ).rejects.toThrow('Invalid Kinopoisk')
    }
    await expect(
      requestKinopoiskTop(resolve(), async () => new Response('x'.repeat(1024 * 1024 + 1)))
    ).rejects.toThrow('too large')
  })
  it('aborts timed out fetches', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')))
        })
    )
    const promise = requestKinopoiskTop(resolve(), fetcher, 100)
    const check = expect(promise).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(100)
    await check
  })
  it('returns cache hits without contacting Kinopoisk or claiming Kinobox HTTP/2', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const cache = { match: vi.fn().mockResolvedValue(new Response('{}')) }
    const response = await serveKinopoiskTop(
      resolve(),
      new URL('https://proxy.test/api/kinopoisk/top'),
      { 'X-Search-Transport': 'h2', 'X-Kinobox-Transport': 'h2', 'X-Worker-Version': 'test' },
      {},
      cache
    )
    expect(response.headers.get('X-Top-Cache')).toBe('HIT')
    expect(response.headers.has('X-Kinobox-Transport')).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not cache upstream failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
    const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() }
    const waitUntil = vi.fn()
    const response = await serveKinopoiskTop(
      resolve(),
      new URL('https://proxy.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'test' },
      { waitUntil },
      cache
    )
    expect(response.status).toBe(502)
    expect(cache.put).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
