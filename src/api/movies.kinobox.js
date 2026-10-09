import axios from 'axios'
import { createPublicDataCache } from './publicDataCache'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const KINOBOX_BASE_URL = import.meta.env.VITE_KINOBOX_API_URL || 'https://api.reyhoho.fun'
// All Kinobox content uses the same Worker; a separate search override remains supported.
const KINOBOX_SEARCH_BASE_URL = import.meta.env.VITE_KINOBOX_SEARCH_API_URL || KINOBOX_BASE_URL

const api = axios.create({
  baseURL: KINOBOX_BASE_URL
})

const simulateErrorIfNeeded = async () => {
  if (isErrorSimulationEnabled && simulatedErrorCode) {
    const status = parseInt(simulatedErrorCode, 10)
    const error = new Error(`Simulated error ${status}`)
    error.response = { status }
    throw error
  }
}

const publicData = createPublicDataCache()
const publicGet = async (path, config, ttl, validate) => {
  await simulateErrorIfNeeded()
  const key = JSON.stringify([config.baseURL || KINOBOX_BASE_URL, path, config.params || {}])
  const data = await publicData(key, async () => (await api.get(path, config)).data, ttl, {
    signal: config.signal,
    validate,
    // No shared module cache during SSR or for customized/authenticated requests.
    bypass:
      import.meta.env.SSR ||
      Boolean(
        config.headers ||
        config.auth ||
        config.adapter ||
        config.transformResponse ||
        config.cancelToken ||
        config.withCredentials
      )
  })
  return { data }
}

const ensureUniqueKey = (obj, baseKey) => {
  if (!obj[baseKey]) return baseKey
  let idx = 2
  while (obj[`${baseKey} #${idx}`]) idx++
  return `${baseKey} #${idx}`
}

const normalizePlayerType = (value) => String(value || 'Player').trim()

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

const toLegacyType = (value) => {
  const type = String(value || '').toLowerCase()
  if (type.includes('series') || type.includes('serial') || type.includes('show')) {
    return 'TV_SERIES'
  }
  return 'FILM'
}

const normalizeCountries = (countries = []) => {
  if (!Array.isArray(countries)) return []
  return countries
    .map((country) => country?.name || country?.country || '')
    .filter(Boolean)
    .map((country) => ({ country }))
}

const normalizeGenres = (genres = []) => {
  if (!Array.isArray(genres)) return []
  return genres
    .map((genre) => genre?.name || genre?.genre || '')
    .filter(Boolean)
    .map((genre) => ({ genre }))
}

const normalizeStaff = (crew = []) => {
  if (!Array.isArray(crew)) return []
  return crew.map((item) => ({
    staff_id: item?.person?.id || null,
    name_ru: item?.person?.name || '',
    name_en: item?.person?.originalName || '',
    description: item?.role || '',
    poster_url: item?.person?.photoUrl || '',
    profession_text: item?.role || '',
    profession_key: String(item?.role || '').toUpperCase()
  }))
}

const normalizeKinoboxMovie = (movie, kpId) => {
  if (!movie || typeof movie !== 'object') return null

  const resolvedKpId =
    Number(kpId) ||
    Number(movie?.kinopoiskId) ||
    Number(movie?.kinopoisk_id) ||
    Number(movie?.id) ||
    null
  const ratingKinopoisk = movie?.rating?.kinopoisk || {}
  const ratingImdb = movie?.rating?.imdb || {}
  const trailer = movie?.trailer
  const trailerVideoUrl = trailer?.videoUrl || ''

  return {
    id: resolvedKpId,
    kp_id: resolvedKpId,
    kinopoisk_id: resolvedKpId,
    imdb_id: null,
    title: String(movie?.title?.russian || movie?.title?.original || '').trim(),
    name_ru: movie?.title?.russian || '',
    name_en: '',
    name_original: movie?.title?.original || '',
    poster: movie?.gallery?.posterUrl || '',
    poster_url: movie?.gallery?.posterUrl || '',
    poster_url_preview: movie?.gallery?.posterUrl || '',
    reviews_count: 0,
    rating_good_review: null,
    rating_good_review_vote_count: 0,
    rating_kinopoisk: toNumberOrNull(ratingKinopoisk.value),
    rating_kinopoisk_vote_count: Number(ratingKinopoisk.count) || 0,
    rating_imdb: toNumberOrNull(ratingImdb.value),
    ratings_checked: 1,
    rating_imdb_vote_count: Number(ratingImdb.count) || 0,
    rating_film_critics: null,
    rating_film_critics_vote_count: 0,
    rating_await: null,
    rating_await_count: 0,
    rating_rf_critics: null,
    rating_rf_critics_vote_count: 0,
    year: movie?.year || null,
    film_length: movie?.duration || null,
    is_tickets_available: false,
    production_status: movie?.status || '',
    type: toLegacyType(movie?.type),
    has_imax: false,
    has_3_d: false,
    countries: normalizeCountries(movie?.countries),
    genres: normalizeGenres(movie?.genres),
    start_year: movie?.year || null,
    end_year: null,
    cover_url: movie?.gallery?.coverUrl || null,
    logo_url: null,
    web_url: movie?.id ? `https://www.kinopoisk.ru/film/${movie.id}/` : '',
    slogan: null,
    description: movie?.description || movie?.synopsis || '',
    short_description: movie?.synopsis || movie?.description || '',
    editor_annotation: null,
    rating_mpaa: movie?.restriction?.mpaa || null,
    rating_age_limits: movie?.restriction?.age || null,
    last_sync: movie?.updatedAt || '',
    serial: toLegacyType(movie?.type) === 'TV_SERIES',
    short_film: false,
    completed: false,
    sequels_and_prequels: [],
    similars: [],
    videos: trailerVideoUrl
      ? [
          {
            name: trailer?.title || 'Trailer',
            url: trailerVideoUrl,
            image_url: trailer?.coverUrl || ''
          }
        ]
      : [],
    staff: normalizeStaff(movie?.crew),
    nudity_timings: [],
    lists: {
      isFavorite: false,
      isHistory: false,
      isLater: false,
      isCompleted: false,
      isAbandoned: false,
      isWatching: false,
      isRated: false
    },
    rating_kp: toNumberOrNull(ratingKinopoisk.value),
    raw_data: {
      ...movie,
      name_ru: movie?.title?.russian || movie?.title?.original || '',
      name_en: movie?.title?.original || '',
      rating: toNumberOrNull(ratingKinopoisk.value),
      type: toLegacyType(movie?.type)
    },
    source: 'kinobox'
  }
}

const normalizeKinoboxSearchResponse = (data) => {
  const candidates = [
    data,
    data?.data,
    data?.movies,
    data?.results,
    data?.items,
    data?.data?.items,
    data?.data?.movies,
    data?.data?.results
  ]
  const rows = candidates.find(Array.isArray) || []

  return rows
    .map((movie) =>
      normalizeKinoboxMovie(
        movie,
        movie?.kinopoiskId || movie?.kinopoisk_id || movie?.kinopoisk || movie?.id
      )
    )
    .filter((movie) => movie?.id)
}

const toPlayersMap = (providers = [], { type = null } = {}) => {
  const players = {}
  const selectedType = type ? String(type).toLowerCase() : null

  for (const provider of providers) {
    const providerType = normalizePlayerType(provider?.type)

    if (selectedType && providerType.toLowerCase() !== selectedType) {
      continue
    }

    const providerBaseIframe = provider?.iframeUrl || ''
    const providerLabel = `KINOBOX>${providerType}`

    if (providerBaseIframe) {
      const key = ensureUniqueKey(players, providerLabel)
      players[key] = {
        name: key,
        translate: providerType,
        iframe: providerBaseIframe,
        quality: '',
        warning: false,
        source: 'kinobox',
        raw_data: provider
      }
    }
  }

  return players
}

const getPlayersRaw = async (kpId, { title = '' } = {}) => {
  const { data } = await publicGet(
    '/api/players',
    {
      params: {
        kinopoisk: String(kpId),
        ...(title ? { title: String(title) } : {})
      }
    },
    30000,
    (data) => Array.isArray(data?.data)
  )

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, options)
}

const getKpInfo = async (kpId, requestConfig = {}) => {
  const { data } = await publicGet(
    `/api/movies/${kpId}`,
    { ...requestConfig },
    5 * 60000,
    (data) => Boolean(data?.data?.movie) && data?.data?.isSuccess !== false
  )

  const movie = data?.data?.movie || data?.movie || data?.data || null
  return normalizeKinoboxMovie(movie, kpId)
}

const apiSearch = async (searchTerm, requestConfig = {}) => {
  const { data } = await publicGet(
    '/api/movies/search/',
    {
      ...requestConfig,
      baseURL: KINOBOX_SEARCH_BASE_URL,
      params: {
        query: String(searchTerm).trim()
      }
    },
    60000,
    (data) => Array.isArray(data?.data?.items)
  )

  return normalizeKinoboxSearchResponse(data)
}

const getTopMovies = async (
  { typeFilter = 'movie', page = 1, limit = 36 } = {},
  requestConfig = {}
) => {
  const { data } = await publicGet(
    '/api/kinopoisk/top',
    {
      ...requestConfig,
      params: { type: typeFilter === 'series' ? 'series' : 'movie', page, limit },
      timeout: 20000
    },
    5 * 60000,
    (data) => Array.isArray(data?.data?.items) && data.data.items.length > 0
  )
  if (!Array.isArray(data?.data?.items)) throw new Error('Invalid Kinopoisk top response')
  return data.data.items.map(({ movie, position }) => {
    const poster = movie?.gallery?.posterUrl || ''
    const posterUrl = poster.startsWith('//') ? 'https:' + poster + '/300x450' : poster
    return {
      ...normalizeKinoboxMovie({
        ...movie,
        gallery: { ...movie?.gallery, posterUrl }
      }),
      position,
      source: 'kinopoisk'
    }
  })
}

// The proxy exposes a 250-film rating list, not a random/all-cinema endpoint.
// Equal-sized pages keep selection uniform and reuse the proxy's cached top pages.
const getRandomMovie = async (requestConfig = {}) => {
  const page = Math.floor(Math.random() * 5) + 1
  const movies = (
    await getTopMovies({ typeFilter: 'movie', page, limit: 50 }, requestConfig)
  ).filter((movie) => movie?.kp_id && movie?.title)
  if (!movies.length) throw new Error('Random movie selection is empty')
  return movies[Math.floor(Math.random() * movies.length)]
}

export {
  apiSearch,
  getKpInfo,
  getPlayers,
  getPlayersRaw,
  getTopMovies,
  getRandomMovie,
  normalizeKinoboxMovie,
  normalizeKinoboxSearchResponse
}

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
