import { Buffer } from 'node:buffer'
import { KINOPOISK_CONTENT_QUERIES } from './kinopoisk-content-queries.mjs'

const ENDPOINT = 'https://graphql.kinopoisk.ru/graphql/'
const MAX_BYTES = 1024 * 1024
const MOVIE_TYPES = new Set(['Film', 'TvSeries', 'MiniSeries', 'TvShow', 'Video'])
const STAFF_GROUPS = ['actors', 'directors', 'producers']
const HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  origin: 'https://www.kinopoisk.ru',
  referer: 'https://www.kinopoisk.ru/',
  'service-id': '25',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'x-preferred-language': 'ru'
}
const upstreamError = (message, reason, upstreamStatus) =>
  Object.assign(new Error(message), { reason, upstreamStatus })

async function readBoundedJson(response) {
  if (!response.body) throw upstreamError('Empty Kinopoisk response', 'empty')
  const reader = response.body.getReader()
  try {
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) throw upstreamError('Kinopoisk response too large', 'size')
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      throw upstreamError('Invalid Kinopoisk JSON', 'json')
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

async function graphql(operationName, variables, signal, fetchImpl) {
  const response = await fetchImpl(ENDPOINT + '?operationName=' + operationName, {
    method: 'POST',
    // Never follow an upstream redirect to login, CAPTCHA or a different host.
    redirect: 'manual',
    signal,
    headers: HEADERS,
    body: JSON.stringify({
      operationName,
      query: KINOPOISK_CONTENT_QUERIES[operationName],
      variables
    })
  })
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {})
    throw upstreamError('Kinopoisk upstream HTTP ' + response.status, 'http', response.status)
  }
  const data = await readBoundedJson(response)
  if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object')
    throw upstreamError('Invalid Kinopoisk response', 'schema')
  return data.data
}

const YANDEX_IMAGE =
  /^https:\/\/(?:avatars\.mds\.yandex\.net|cdn[a-z0-9]+\.svc\.cdn\.yandex\.net)\//
const SIZED = /\/(?:orig|\d+x\d*|x\d+)$/

// Kinopoisk image URLs are often protocol-relative and need an explicit size suffix.
const image = (value, size) => {
  if (typeof value !== 'string') return undefined
  const url = value.startsWith('//') ? 'https:' + value : value
  if (!url.startsWith('https://')) return undefined
  return YANDEX_IMAGE.test(url) && !SIZED.test(url) ? url + '/' + size : url
}

const yearOf = (movie) =>
  movie.productionYear ||
  movie.fallbackYear ||
  (Array.isArray(movie.releaseYears) ? movie.releaseYears[0]?.start : movie.releaseYears?.start)

const posterOf = (gallery, size) => {
  const posters = gallery?.posters || {}
  return image((posters.kpVertical || posters.hdVertical || posters.vertical)?.avatarsUrl, size)
}

const named = (items) =>
  Array.isArray(items)
    ? items.filter((item) => typeof item?.name === 'string').map(({ name }) => ({ name }))
    : []

const isMovie = (movie) => MOVIE_TYPES.has(movie?.__typename) && Number.isInteger(movie?.id)

// Forward only public card data in the Kinobox response shape the frontend already reads.
function searchItem(movie) {
  return {
    id: movie.id,
    kinopoiskId: movie.id,
    type: movie.__typename,
    title: { russian: movie.title?.russian, original: movie.title?.original },
    year: yearOf(movie),
    gallery: { posterUrl: posterOf(movie.gallery, '300x450') },
    rating: { kinopoisk: { value: movie.rating?.kinopoisk?.value } }
  }
}

export function toKinoboxSearch(data) {
  const top = data?.suggest?.top
  const candidates = [top?.topResult?.global, ...(top?.movies || []).map((item) => item?.movie)]
  const seen = new Set()
  const items = []
  for (const movie of candidates) {
    if (!isMovie(movie) || seen.has(movie.id)) continue
    seen.add(movie.id)
    items.push(searchItem(movie))
  }
  return { data: { items }, source: 'kinopoisk' }
}

export function toKinoboxMovie(meta, ratingBase, ratingExtended, crew) {
  const movie = meta?.movie
  if (!isMovie(movie)) return { data: { isSuccess: false, movie: null }, source: 'kinopoisk' }
  const kinopoisk = ratingBase?.movie?.rating?.kinopoisk
  const imdb = ratingExtended?.movie?.rating?.imdb
  return {
    data: {
      isSuccess: true,
      movie: {
        id: movie.id,
        kinopoiskId: movie.id,
        type: movie.__typename,
        title: {
          russian: movie.title?.localized || movie.title?.russian,
          original: movie.title?.original
        },
        year: yearOf(movie),
        duration: movie.kpDuration || movie.ott?.preview?.duration || undefined,
        description: movie.kpSynopsis || movie.synopsis || movie.shortDescription,
        synopsis: movie.shortDescription || movie.synopsis,
        gallery: {
          posterUrl: posterOf(movie.gallery, '600x900'),
          coverUrl: image(movie.gallery?.covers?.horizontal?.avatarsUrl, 'orig')
        },
        rating: {
          kinopoisk: kinopoisk && { value: kinopoisk.value, count: kinopoisk.count },
          imdb: imdb && { value: imdb.value, count: imdb.count }
        },
        countries: named(movie.countries),
        genres: named(movie.genres),
        restriction: { age: movie.restriction?.age, mpaa: movie.restriction?.mpaa },
        crew: STAFF_GROUPS.flatMap((group) =>
          (crew?.movie?.[group]?.items || [])
            .filter((item) => Number.isInteger(item?.person?.id))
            .map((item) => ({
              role: item.roleInfo?.slug,
              person: {
                id: item.person.id,
                name: item.person.name,
                originalName: item.person.originalName,
                photoUrl: image(item.person.poster?.avatarsUrl, '136x204')
              }
            }))
        )
      }
    },
    source: 'kinopoisk'
  }
}

// Same contract as requestKinoboxHttp2 for the search and movie paths.
export async function requestKinopoiskContent(options, transportOptions = {}, fetchImpl = fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), transportOptions.timeoutMs || 15000)
  const call = (name, variables) => graphql(name, variables, controller.signal, fetchImpl)
  try {
    let data
    if (options.path === '/api/movies/search/') {
      data = toKinoboxSearch(
        await call('SuggestSearch', {
          keyword: options.params.query,
          yandexCityId: 0,
          limit: 10
        })
      )
    } else {
      const match = /^\/api\/movies\/([1-9]\d{0,11})$/.exec(options.path)
      if (!match) throw upstreamError('Unsupported Kinopoisk path', 'path')
      const movieId = Number(match[1])
      // Ratings and crew are optional; the card is still useful without them.
      const optional = (promise) => promise.catch(() => null)
      const [meta, ratingBase, ratingExtended, crew] = await Promise.all([
        call('MovieDetailsMobileGeneralMeta', {
          movieId,
          includeKpValues: true,
          isOnlyOnlineSeasonsCount: false,
          includeMovieTop250: false
        }),
        optional(call('MovieDetailsMobileRatingBase', { movieId, includePlannedToWatch: false })),
        optional(call('MovieDetailsMobileRatingExtended', { movieId })),
        optional(
          call('MovieDetailsMobileMainCrewMembers', {
            movieId,
            actorsRoles: ['ACTOR'],
            actorsLimit: 20,
            includeCreators: true,
            creatorsEachRoleLimit: 10,
            creatorsOtherRoles: []
          })
        )
      ])
      data = toKinoboxMovie(meta, ratingBase, ratingExtended, crew)
    }
    return {
      status: 200,
      headers: {},
      body: Buffer.from(JSON.stringify(data)),
      source: 'kinopoisk'
    }
  } catch (error) {
    if (controller.signal.aborted) throw upstreamError('Kinopoisk upstream timeout', 'timeout')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// Search and movie cards come from Kinopoisk GraphQL; Kinobox remains their fallback
// and the only source of player lists.
export async function requestContent(
  options,
  transportOptions,
  headers,
  requestKinobox,
  requestKinopoisk = requestKinopoiskContent
) {
  const started = Date.now()
  if (options.path !== '/api/players') {
    try {
      const response = await requestKinopoisk(options, transportOptions)
      headers['X-Data-Source'] = 'kinopoisk'
      delete headers['X-Search-Transport']
      delete headers['X-Kinobox-Transport']
      return response
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'kinopoisk_content_error',
          reason: error.reason || 'connection',
          upstreamStatus: error.upstreamStatus,
          durationMs: Date.now() - started
        })
      )
    }
  }
  headers['X-Data-Source'] = 'kinobox'
  const timeoutMs = Math.max(1, (transportOptions?.timeoutMs || 15000) - (Date.now() - started))
  return requestKinobox(options, { ...transportOptions, timeoutMs })
}
