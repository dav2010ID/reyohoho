// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  resolveMovieExtras,
  toMovieExtras,
  requestMovieExtras,
  serveMovieExtras
} from './kinoapi.mjs'

const KEY = 'test-key-value'
const title = (overrides = {}) => ({
  id: { tmdb: 550, kinopoisk: 361, imdb: 'tt0137523', shikimori: null, myAnimeList: null },
  type: 'movie',
  title: { ru: 'Бойцовский клуб', en: 'Fight Club', original: 'Fight Club' },
  tagline: { ru: '«Интриги. Хаос. Мыло»', en: 'Mischief. Mayhem. Soap.' },
  release: { year: 1999 },
  ratings: {
    tmdb: { value: 8.438, votes: 32360 },
    kinopoisk: { value: 8.7, votes: 1260679 },
    omdb: [
      { Source: 'Rotten Tomatoes', Value: '81%' },
      { Source: 'Metacritic', Value: '67/100' }
    ]
  },
  images: {
    poster: 'https://image.tmdb.org/t/p/original/poster.jpg',
    logo: 'https://avatars.mds.yandex.net/get-ott/374297/logo/orig'
  },
  trailers: { ru: 'wPiyAoTY8Ys', en: null },
  economics: { budget: '63000000' },
  ...overrides
})
const similarItem = (kinopoisk, overrides = {}) =>
  title({
    id: { tmdb: kinopoisk + 1000, kinopoisk },
    title: { ru: 'Фильм ' + kinopoisk, original: 'Movie ' + kinopoisk },
    ...overrides
  })
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
const upstream = (similar = [similarItem(301)]) =>
  vi.fn(async (url) =>
    String(url).includes('/similar') ? json({ data: similar }) : json({ data: title() })
  )
const memoryCache = () => {
  const entries = new Map()
  return {
    entries,
    match: vi.fn(async (key) => entries.get(key)?.clone() || null),
    put: vi.fn(async (key, response) => {
      entries.set(key, response.clone())
    })
  }
}
const resource = (id = 361) =>
  resolveMovieExtras(new URL(`/api/movies/${id}/extras`, 'https://proxy.test'))
const serve = (cache, fetchImpl, { id = 361, key = KEY, budget } = {}) =>
  serveMovieExtras(
    resource(id),
    new URL(`https://proxy.test/api/movies/${id}/extras`),
    { 'X-Worker-Version': 'test', 'X-Kinobox-Transport': 'h2' },
    cache,
    key,
    budget,
    fetchImpl
  )

describe('movie extras route', () => {
  it('accepts only a numeric Kinopoisk ID and ignores other paths', () => {
    expect(resource(361)).toEqual({ kind: 'extras', params: { id: '361' }, cacheTtl: 86400 })
    expect(resource('abc').status).toBe(400)
    expect(resource(0).status).toBe(400)
    expect(resolveMovieExtras(new URL('https://proxy.test/api/movies/361'))).toBe(null)
    expect(resolveMovieExtras(new URL('https://proxy.test/api/movies/361/extras/x'))).toBe(null)
  })
})

describe('movie extras normalization', () => {
  it('forwards only validated public fields', () => {
    expect(toMovieExtras(title(), [similarItem(301)])).toEqual({
      ids: { kinopoisk: 361, tmdb: 550, imdb: 'tt0137523' },
      type: 'movie',
      tagline: '«Интриги. Хаос. Мыло»',
      logoUrl: 'https://avatars.mds.yandex.net/get-ott/374297/logo/orig',
      ratings: { tmdb: { value: 8.438, votes: 32360 }, rottenTomatoes: 81, metacritic: 67 },
      trailers: ['wPiyAoTY8Ys'],
      similar: [
        {
          kinopoiskId: 301,
          type: 'movie',
          title: { russian: 'Фильм 301', original: 'Movie 301' },
          year: 1999
        }
      ]
    })
  })
  it('drops untrusted logo hosts, malformed trailer IDs and malformed ratings', () => {
    const extras = toMovieExtras(
      title({
        images: { logo: 'https://evil.example/logo.png' },
        trailers: { ru: 'javascript:alert(1)', en: '"><script>' },
        ratings: { tmdb: { value: 'high' }, omdb: [{ Source: 'Metacritic', Value: '<b>' }] }
      }),
      []
    )
    expect(extras.logoUrl).toBeUndefined()
    expect(extras.trailers).toEqual([])
    expect(extras.ratings).toEqual({})
  })
  it('keeps only similar titles that have their own Kinopoisk page', () => {
    const similar = [
      similarItem(301),
      similarItem(361),
      similarItem(301),
      title({ id: { tmdb: 9, kinopoisk: null } }),
      null
    ]
    expect(toMovieExtras(title(), similar).similar.map((item) => item.kinopoiskId)).toEqual([301])
  })
})

describe('Kino API requests', () => {
  it('sends the key only in a header to the fixed host', async () => {
    const fetcher = upstream()
    await requestMovieExtras('361', KEY, fetcher)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://kinoapi.lampac.dev/api/v1/titles/by/kinopoisk/361?include=images',
      'https://kinoapi.lampac.dev/api/v1/titles/movie/tt0137523/similar?limit=12'
    ])
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).not.toContain(KEY)
      expect(init.headers['X-API-Key']).toBe(KEY)
      expect(init.redirect).toBe('manual')
    }
  })
  it('looks up similar titles by TMDB ID when the title has no IMDb ID', async () => {
    const fetcher = vi.fn(async (url) =>
      String(url).includes('/similar')
        ? json({ data: [] })
        : json({ data: title({ id: { tmdb: 550, kinopoisk: 361, imdb: null } }) })
    )
    await requestMovieExtras('361', KEY, fetcher)
    expect(fetcher.mock.calls[1][0]).toBe(
      'https://kinoapi.lampac.dev/api/v1/titles/movie/550/similar?limit=12'
    )
  })
  it('returns the card data marked partial when similar titles fail', async () => {
    const fetcher = vi.fn(async (url) =>
      String(url).includes('/similar') ? json({}, 503) : json({ data: title() })
    )
    const result = await requestMovieExtras('361', KEY, fetcher)
    expect(result.partial).toBe(true)
    expect(result.data.ids.imdb).toBe('tt0137523')
    expect(result.data.similar).toEqual([])
  })
  it('marks a missing similar endpoint partial and logs only safe diagnostics', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const fetcher = vi.fn(async (url) =>
        String(url).includes('/similar') ? json({}, 404) : json({ data: title() })
      )
      const result = await requestMovieExtras('361', KEY, fetcher)
      expect(result.partial).toBe(true)
      expect(result.data.similar).toEqual([])
      expect(JSON.parse(logger.mock.calls[0][0])).toEqual({
        event: 'kinoapi_similar_error',
        reason: 'http',
        upstreamStatus: 404
      })
      expect(JSON.stringify(logger.mock.calls)).not.toContain(KEY)
    } finally {
      logger.mockRestore()
    }
  })
  it('reports a title missing from the catalogue as empty, not as a failure', async () => {
    const result = await requestMovieExtras('361', KEY, async () => json({}, 404))
    expect(result).toEqual({ data: null, partial: false })
  })
  it('rejects a card that belongs to another Kinopoisk ID', async () => {
    await expect(
      requestMovieExtras('999', KEY, async () => json({ data: title() }))
    ).rejects.toThrow('Invalid Kino API response')
  })
})

describe('movie extras endpoint', () => {
  it('fails closed without a key and never contacts the upstream', async () => {
    const fetcher = vi.fn()
    const response = await serve(memoryCache(), fetcher, { key: '' })
    expect(response.status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('caches a complete answer for a day and serves it without new upstream calls', async () => {
    const cache = memoryCache()
    const fetcher = upstream()
    const first = await serve(cache, fetcher)
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Extras-Cache')).toBe('MISS')
    expect(first.headers.get('X-Data-Source')).toBe('kinoapi')
    expect(first.headers.has('X-Kinobox-Transport')).toBe(false)
    expect((await first.json()).data.similar).toHaveLength(1)
    const fresh = cache.put.mock.calls.find(([key]) => key.includes('/__kinoapi-extras?'))
    expect(fresh[1].headers.get('Cache-Control')).toBe('public, max-age=86400')
    const second = await serve(cache, fetcher)
    expect(second.headers.get('X-Extras-Cache')).toBe('HIT')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('caches a partial answer only briefly', async () => {
    const cache = memoryCache()
    const fetcher = vi.fn(async (url) =>
      String(url).includes('/similar') ? json({}, 503) : json({ data: title() })
    )
    expect((await serve(cache, fetcher)).status).toBe(200)
    const fresh = cache.put.mock.calls.find(([key]) => key.includes('/__kinoapi-extras?'))
    expect(fresh[1].headers.get('Cache-Control')).toBe('public, max-age=600')
  })
  it('charges the public budget before going upstream and honours its refusal', async () => {
    const fetcher = upstream()
    const refusal = new Response('{}', { status: 429 })
    const response = await serve(memoryCache(), fetcher, { budget: async () => refusal })
    expect(response.status).toBe(429)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('collapses concurrent cold requests for one title into a single upstream load', async () => {
    let release
    const fetcher = vi.fn((url) =>
      String(url).includes('/similar')
        ? Promise.resolve(json({ data: [] }))
        : new Promise((resolve) => {
            release = () => resolve(json({ data: title() }))
          })
    )
    const cache = memoryCache()
    const first = serve(cache, fetcher)
    const second = serve(cache, fetcher)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    release()
    const responses = await Promise.all([first, second])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(responses[1].headers.get('X-Extras-Cache')).toBe('HIT')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it.each([429, 401])('stops all upstream calls for a while after HTTP %i', async (status) => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const cache = memoryCache()
      const fetcher = vi.fn(async () => json({}, status))
      expect((await serve(cache, fetcher)).status).toBe(502)
      const other = await serve(cache, fetcher, { id: 301 })
      expect(other.status).toBe(503)
      expect(other.headers.get('X-Extras-Cache')).toBe('BACKOFF')
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally {
      logger.mockRestore()
    }
  })
  it('serves the last good answer when the upstream fails', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const cache = memoryCache()
      await serve(cache, upstream())
      for (const key of [...cache.entries.keys()])
        if (key.includes('/__kinoapi-extras?')) cache.entries.delete(key)
      const response = await serve(cache, async () => {
        throw new Error('connect failed ' + KEY)
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('X-Extras-Cache')).toBe('STALE')
      expect(JSON.stringify(logger.mock.calls)).not.toContain(KEY)
    } finally {
      logger.mockRestore()
    }
  })
})
