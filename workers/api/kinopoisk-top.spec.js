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
  it('classifies null JSON, absent bodies and oversized responses safely', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cases = [
      [() => new Response('null'), 'schema'],
      [() => new Response(null), 'empty'],
      [() => new Response('x'.repeat(1024 * 1024 + 1)), 'size']
    ]
    try {
      for (const [response, reason] of cases) {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => response())
        )
        const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() }
        const result = await serveKinopoiskTop(
          resolve(),
          new URL('https://invalid.test/api/kinopoisk/top'),
          { 'X-Worker-Version': 'invalid' },
          {},
          cache
        )
        expect(result.status).toBe(502)
        expect(JSON.parse(logger.mock.calls.at(-1)[0]).reason).toBe(reason)
        expect(cache.put.mock.calls[0][0]).toContain('/__kinopoisk-top-retry?')
        expect(await cache.put.mock.calls[0][1].clone().text()).toBe('{}')
      }
    } finally {
      logger.mockRestore()
    }
  })
  it('goes through the shared upstream guard on a cache miss', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const upstream = vi.fn()
      vi.stubGlobal('fetch', upstream)
      const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() }
      const guard = vi.fn(() => Promise.reject(new Error('kinopoisk unavailable: circuit_open')))
      const result = await serveKinopoiskTop(
        resolve(),
        new URL('https://guard.test/api/kinopoisk/top'),
        { 'X-Worker-Version': 'guard' },
        {},
        cache,
        async () => null,
        guard
      )
      expect(guard).toHaveBeenCalledOnce()
      expect(upstream).not.toHaveBeenCalled()
      expect(result.status).toBe(502)
    } finally {
      logger.mockRestore()
    }
  })
  it('keeps waiting cache reads within the Workers Free subrequest budget', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(
      (_, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')))
        })
    )
    vi.stubGlobal('fetch', fetcher)
    const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() }
    const args = [
      resolve(),
      new URL('https://budget.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'budget' },
      {},
      cache
    ]
    const first = serveKinopoiskTop(...args)
    await vi.advanceTimersByTimeAsync(0)
    const waiter = serveKinopoiskTop(...args)
    await vi.advanceTimersByTimeAsync(14000)
    // One initial read by each request; at most 48 more for the waiter.
    expect(cache.match.mock.calls.length).toBeLessThanOrEqual(50)
    await vi.advanceTimersByTimeAsync(20000)
    await Promise.all([first, waiter])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
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
  it('distinguishes GraphQL failures without logging provider messages or transport secrets', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cache = { match: vi.fn().mockResolvedValue(null), put: vi.fn() }
    const args = [
      resolve(),
      new URL('https://diagnostics.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'diagnostics' },
      {},
      cache
    ]
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              ...payload(),
              errors: [{ message: 'secret-provider-message' }]
            })
          )
        )
      )
      expect((await serveKinopoiskTop(...args)).status).toBe(502)
      expect(JSON.parse(logger.mock.calls.at(-1)[0])).toMatchObject({
        event: 'kinopoisk_top_error',
        reason: 'graphql'
      })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('token=secret-transport-token')))
      expect((await serveKinopoiskTop(...args)).status).toBe(502)
      expect(JSON.stringify(logger.mock.calls)).not.toContain('secret')
      expect(cache.put.mock.calls.every(([key]) => key.includes('/__kinopoisk-top-retry?'))).toBe(true)
    } finally {
      logger.mockRestore()
    }
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
  it('returns cache hits without contacting Kinopoisk', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const cache = { match: vi.fn().mockResolvedValue(new Response('{}')) }
    const response = await serveKinopoiskTop(
      resolve(),
      new URL('https://proxy.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'test' },
      {},
      cache
    )
    expect(response.headers.get('X-Top-Cache')).toBe('HIT')
    expect(response.headers.get('X-Data-Source')).toBe('kinopoisk')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('caches only a short retry marker for upstream failures', async () => {
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
    expect(cache.put.mock.calls[0][0]).toContain('/__kinopoisk-top-retry?')
    expect(cache.put.mock.calls[0][1].headers.get('Cache-Control')).toBe('public, max-age=30')
    expect(await cache.put.mock.calls[0][1].text()).toBe('{}')
    expect(waitUntil).not.toHaveBeenCalled()
  })
  it('deduplicates concurrent cold-key misses without sharing Response objects', async () => {
    let releaseFetch
    const fetcher = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseFetch = () => resolve(new Response(JSON.stringify(payload())))
        })
    )
    vi.stubGlobal('fetch', fetcher)
    const entries = new Map()
    const cache = {
      match: vi.fn(async (key) => entries.get(key)?.clone() || null),
      put: vi.fn(async (key, response) => {
        entries.set(key, response.clone())
      })
    }
    const context = { waitUntil: (promise) => promise }
    const args = [
      resolve(),
      new URL('https://proxy.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'test' },
      context,
      cache
    ]

    const first = serveKinopoiskTop(...args)
    const second = serveKinopoiskTop(...args)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    releaseFetch()

    const responses = await Promise.all([first, second])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(responses[1].headers.get('X-Top-Cache')).toBe('HIT')
  })
  it('releases the cold-key lease after upstream errors so a later request can retry', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload())))
    vi.stubGlobal('fetch', fetcher)
    const entries = new Map()
    const cache = {
      match: vi.fn(async (key) => entries.get(key)?.clone() || null),
      put: vi.fn(async (key, response) => {
        entries.set(key, response.clone())
      })
    }
    const args = [
      resolve(),
      new URL('https://proxy.test/api/kinopoisk/top'),
      { 'X-Worker-Version': 'test' },
      { waitUntil: (promise) => promise },
      cache
    ]

    expect((await serveKinopoiskTop(...args)).status).toBe(502)
    expect((await serveKinopoiskTop(...args)).status).toBe(503)
    expect(fetcher).toHaveBeenCalledTimes(1)
    for (const key of entries.keys()) if (key.includes('/__kinopoisk-top-retry?')) entries.delete(key)
    expect((await serveKinopoiskTop(...args)).status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
