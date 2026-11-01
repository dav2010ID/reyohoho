// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { KINOPOISK_CONTENT_QUERIES } from './kinopoisk-content-queries.mjs'
import {
  requestContent,
  requestKinopoiskContent,
  toKinoboxMovie,
  toKinoboxSearch
} from './kinopoisk-content.mjs'
import { serveKinoboxContent } from './kinobox-content.mjs'
import { isKinoboxResponseValid, resolveKinoboxResource } from './routes.mjs'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const operationOf = (init) => JSON.parse(init.body).operationName
const film = {
  __typename: 'Film',
  id: 301,
  title: { localized: 'Матрица', original: 'The Matrix' },
  productionYear: 1999,
  kpDuration: 136,
  shortDescription: 'Хакер Нео узнает, что его мир — виртуальный.',
  synopsis: 'Жизнь Томаса Андерсона разделена на две части.',
  gallery: {
    posters: {
      vertical: { avatarsUrl: '//cdnabc.svc.cdn.yandex.net/get-ott/1/vertical' },
      kpVertical: { avatarsUrl: '//cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/2/kp' }
    },
    covers: { horizontal: { avatarsUrl: '//cdnabc.svc.cdn.yandex.net/get-ott/3/cover' } }
  },
  genres: [{ __typename: 'Genre', id: 2, name: 'фантастика' }],
  countries: [{ __typename: 'Country', id: 1, name: 'США' }],
  restriction: { age: 'age18', mpaa: 'r' },
  contentId: 'private-ott-id'
}
const responses = {
  MovieDetailsMobileGeneralMeta: { data: { movie: film } },
  MovieDetailsMobileRatingBase: {
    data: { movie: { rating: { kinopoisk: { value: 8.5, count: 817981, isActive: true } } } }
  },
  MovieDetailsMobileRatingExtended: {
    data: { movie: { rating: { imdb: { value: 8.7, count: 2200000 } } } }
  },
  MovieDetailsMobileMainCrewMembers: {
    data: {
      movie: {
        actors: {
          items: [
            {
              person: {
                id: 7836,
                name: 'Киану Ривз',
                originalName: 'Keanu Reeves',
                poster: {
                  avatarsUrl: 'https://cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/4/keanu'
                },
                dateOfBirth: { date: '1964-09-02' }
              },
              roleInfo: { slug: 'ACTOR' }
            }
          ]
        },
        directors: {
          items: [{ person: { id: 1, name: 'Лана Вачовски' }, roleInfo: { slug: 'DIRECTOR' } }]
        },
        writers: { items: [{ person: { id: 2, name: 'Writer' }, roleInfo: { slug: 'WRITER' } }] }
      }
    }
  },
  SuggestSearch: {
    data: {
      suggest: {
        top: {
          topResult: {
            global: {
              __typename: 'Film',
              id: 301,
              title: { russian: 'Матрица', original: 'The Matrix' },
              productionYear: 1999,
              rating: { kinopoisk: { value: 8.5 } },
              gallery: {
                posters: {
                  kpVertical: { avatarsUrl: '//cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/5/a' }
                }
              },
              viewOption: { buttonText: 'private' }
            }
          },
          movies: [
            { movie: { __typename: 'Film', id: 301, title: { russian: 'Дубль' } } },
            {
              movie: {
                __typename: 'TvSeries',
                id: 1294123,
                title: { russian: 'Матрица: Сериал' },
                releaseYears: { start: 2021, end: 2022 }
              }
            },
            { movie: { __typename: 'Person', id: 7 } },
            { movie: { __typename: 'Film', id: '9' } }
          ]
        }
      }
    }
  }
}
const kinopoiskFetch = (overrides = {}) =>
  vi.fn(async (_url, init) => {
    const name = operationOf(init)
    const override = overrides[name]
    if (override) return override()
    return json(responses[name])
  })

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Kinopoisk GraphQL content', () => {
  it('embeds the backend documents byte for byte', () => {
    for (const [name, query] of Object.entries(KINOPOISK_CONTENT_QUERIES)) {
      const file = readFileSync(
        new URL(`../../backend/graphql/${name}.graphql`, import.meta.url),
        'utf8'
      )
      expect(query, name).toBe(file)
    }
  })

  it('maps search suggestions to deduplicated public Kinobox items', () => {
    const data = toKinoboxSearch(responses.SuggestSearch.data)
    expect(isKinoboxResponseValid('search', data)).toBe(true)
    expect(data.data.items).toEqual([
      {
        id: 301,
        kinopoiskId: 301,
        type: 'Film',
        title: { russian: 'Матрица', original: 'The Matrix' },
        year: 1999,
        gallery: {
          posterUrl: 'https://cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/5/a/300x450'
        },
        rating: { kinopoisk: { value: 8.5 } }
      },
      expect.objectContaining({ id: 1294123, type: 'TvSeries', year: 2021 })
    ])
    expect(JSON.stringify(data)).not.toContain('private')
  })

  it('returns an empty search list for an empty suggestion', () => {
    expect(toKinoboxSearch({ suggest: { top: null } }).data.items).toEqual([])
  })

  it('maps card metadata, ratings and main crew without private fields', () => {
    const data = toKinoboxMovie(
      responses.MovieDetailsMobileGeneralMeta.data,
      responses.MovieDetailsMobileRatingBase.data,
      responses.MovieDetailsMobileRatingExtended.data,
      responses.MovieDetailsMobileMainCrewMembers.data
    )
    expect(isKinoboxResponseValid('movie', data)).toBe(true)
    const movie = data.data.movie
    expect(movie).toMatchObject({
      id: 301,
      type: 'Film',
      title: { russian: 'Матрица', original: 'The Matrix' },
      year: 1999,
      duration: 136,
      description: film.synopsis,
      synopsis: film.shortDescription,
      gallery: {
        posterUrl: 'https://cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/2/kp/600x900',
        coverUrl: 'https://cdnabc.svc.cdn.yandex.net/get-ott/3/cover/orig'
      },
      rating: { kinopoisk: { value: 8.5, count: 817981 }, imdb: { value: 8.7, count: 2200000 } },
      countries: [{ name: 'США' }],
      genres: [{ name: 'фантастика' }],
      restriction: { age: 'age18', mpaa: 'r' }
    })
    expect(movie.crew.map((item) => item.role)).toEqual(['ACTOR', 'DIRECTOR'])
    expect(movie.crew[0].person.photoUrl).toBe(
      'https://cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/4/keanu/136x204'
    )
    expect(JSON.stringify(data)).not.toMatch(/private-ott-id|1964-09-02/)
  })

  it('uses series years and reports an unknown ID as unsuccessful', () => {
    const series = toKinoboxMovie({
      movie: { __typename: 'TvSeries', id: 464963, title: {}, fallbackYear: 2011 }
    })
    expect(series.data.movie).toMatchObject({ type: 'TvSeries', year: 2011, crew: [] })
    expect(toKinoboxMovie({ movie: null }).data).toEqual({ isSuccess: false, movie: null })
  })

  it('sends fixed documents without following redirects', async () => {
    const fetchImpl = kinopoiskFetch()
    const response = await requestKinopoiskContent(
      { path: '/api/movies/search/', params: { query: 'матрица', ts: 1 } },
      { timeoutMs: 1000 },
      fetchImpl
    )
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body.toString()).data.items).toHaveLength(2)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://graphql.kinopoisk.ru/graphql/?operationName=SuggestSearch')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(init.body)).toEqual({
      operationName: 'SuggestSearch',
      query: KINOPOISK_CONTENT_QUERIES.SuggestSearch,
      variables: { keyword: 'матрица', yandexCityId: 0, limit: 10 }
    })
  })

  it('loads a card when optional ratings and crew fail', async () => {
    const fetchImpl = kinopoiskFetch({
      MovieDetailsMobileRatingExtended: () => json({}, 500),
      MovieDetailsMobileMainCrewMembers: () => {
        throw new Error('network')
      }
    })
    const response = await requestKinopoiskContent(
      { path: '/api/movies/301', params: { ts: 1 } },
      { timeoutMs: 1000 },
      fetchImpl
    )
    const movie = JSON.parse(response.body.toString()).data.movie
    expect(movie.rating).toEqual({ kinopoisk: { value: 8.5, count: 817981 } })
    expect(movie.crew).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('classifies required upstream failures', async () => {
    const cases = [
      [
        () => new Response(null, { status: 302, headers: { Location: 'https://sso.test' } }),
        'http'
      ],
      [() => json({ errors: [{ message: 'the query is not allowed' }] }, 400), 'http'],
      [() => new Response('not json'), 'json'],
      [() => new Response('x'.repeat(1024 * 1024 + 1)), 'size'],
      [() => json({ errors: [] }), 'schema']
    ]
    for (const [response, reason] of cases) {
      const error = await requestKinopoiskContent(
        { path: '/api/movies/301', params: {} },
        { timeoutMs: 1000 },
        kinopoiskFetch({ MovieDetailsMobileGeneralMeta: response })
      ).catch((e) => e)
      expect(error.reason, reason).toBe(reason)
    }
  })

  it('aborts at the shared deadline', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted')))
        )
    )
    const pending = requestKinopoiskContent(
      { path: '/api/movies/search/', params: { query: 'x' } },
      { timeoutMs: 50 },
      fetchImpl
    ).catch((e) => e)
    await vi.advanceTimersByTimeAsync(50)
    expect((await pending).reason).toBe('timeout')
  })

  it('rejects unsupported paths without a network request', async () => {
    const fetchImpl = vi.fn()
    const error = await requestKinopoiskContent(
      { path: '/api/players', params: {} },
      {},
      fetchImpl
    ).catch((e) => e)
    expect(error.reason).toBe('path')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('content source selection', () => {
  const kinoboxResponse = { status: 200, headers: {}, body: Buffer.from('{}') }

  it('serves search and movies from Kinopoisk without touching Kinobox', async () => {
    const headers = { 'X-Search-Transport': 'h2', 'X-Kinobox-Transport': 'h2' }
    const kinobox = vi.fn()
    const kinopoisk = vi.fn(async () => ({ status: 200, source: 'kinopoisk' }))
    const response = await requestContent(
      { path: '/api/movies/301' },
      {},
      headers,
      kinobox,
      kinopoisk
    )
    expect(response.source).toBe('kinopoisk')
    expect(kinobox).not.toHaveBeenCalled()
    expect(headers).toEqual({ 'X-Data-Source': 'kinopoisk' })
  })

  it('falls back to Kinobox with the remaining deadline', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let now = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const headers = {}
    const kinobox = vi.fn(async () => kinoboxResponse)
    const kinopoisk = vi.fn(async () => {
      now += 4000
      throw Object.assign(new Error('Kinopoisk upstream HTTP 403'), {
        reason: 'http',
        upstreamStatus: 403
      })
    })
    const options = { path: '/api/movies/search/', params: { query: 'x' } }
    expect(await requestContent(options, { timeoutMs: 15000 }, headers, kinobox, kinopoisk)).toBe(
      kinoboxResponse
    )
    expect(kinobox).toHaveBeenCalledWith(options, { timeoutMs: 11000 })
    expect(headers['X-Data-Source']).toBe('kinobox')
    expect(JSON.parse(console.error.mock.calls[0][0])).toMatchObject({
      event: 'kinopoisk_content_error',
      reason: 'http',
      upstreamStatus: 403
    })
  })

  it('keeps player lists on Kinobox', async () => {
    const kinobox = vi.fn(async () => kinoboxResponse)
    const kinopoisk = vi.fn()
    await requestContent({ path: '/api/players', params: {} }, {}, {}, kinobox, kinopoisk)
    expect(kinopoisk).not.toHaveBeenCalled()
    expect(kinobox).toHaveBeenCalledTimes(1)
  })

  it('caches a Kinopoisk card through the existing content handler', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const entries = new Map()
    const cache = {
      match: vi.fn(async (key) => entries.get(key)?.clone()),
      put: vi.fn(async (key, response) => entries.set(key, response)),
      delete: vi.fn(async (key) => entries.delete(key))
    }
    const url = new URL('/api/movies/301', 'https://api.reyhoho.fun')
    const headers = { 'X-Worker-Version': 'test', 'X-Kinobox-Transport': 'h2' }
    const fetchImpl = kinopoiskFetch()
    const load = (options, transportOptions) =>
      requestContent(options, transportOptions, headers, vi.fn(), (o, t) =>
        requestKinopoiskContent(o, t, fetchImpl)
      )
    const first = await serveKinoboxContent(resolveKinoboxResource(url), url, headers, cache, load)
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Kinobox-Cache')).toBe('MISS')
    expect(first.headers.get('X-Data-Source')).toBe('kinopoisk')
    expect((await first.json()).data.movie.title.russian).toBe('Матрица')
    const second = await serveKinoboxContent(resolveKinoboxResource(url), url, headers, cache, load)
    expect(second.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(JSON.parse(console.log.mock.calls[0][0])).toMatchObject({
      event: 'kinobox_response',
      source: 'kinopoisk'
    })
  })
})
