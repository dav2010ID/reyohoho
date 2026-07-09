import axios from 'axios'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const KINOBOX_BASE_URL = import.meta.env.VITE_KINOBOX_API_URL || 'https://api.kinobox.tv'

const api = axios.create({
  baseURL: KINOBOX_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const simulateErrorIfNeeded = async () => {
  if (isErrorSimulationEnabled && simulatedErrorCode) {
    const status = parseInt(simulatedErrorCode, 10)
    const error = new Error(`Simulated error ${status}`)
    error.response = { status }
    throw error
  }
}

const apiCall = async (callFn) => {
  await simulateErrorIfNeeded()
  return await callFn(api)
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
    name_ru: movie?.title?.russian || '',
    name_en: '',
    name_original: movie?.title?.original || '',
    poster_url: movie?.gallery?.posterUrl || '',
    poster_url_preview: movie?.gallery?.posterUrl || '',
    reviews_count: 0,
    rating_good_review: null,
    rating_good_review_vote_count: 0,
    rating_kinopoisk: toNumberOrNull(ratingKinopoisk.value),
    rating_kinopoisk_vote_count: Number(ratingKinopoisk.count) || 0,
    rating_imdb: toNumberOrNull(ratingImdb.value),
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
  const { data } = await apiCall((client) =>
    client.get('/api/players', {
      params: {
        kinopoisk: String(kpId),
        ...(title ? { title: String(title) } : {})
      }
    })
  )

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, options)
}

const getKpInfo = async (kpId) => {
  const { data } = await apiCall((client) =>
    client.get(`/api/movies/${kpId}`, {
      params: {
        ts: Math.floor(Date.now() / 1000)
      }
    })
  )

  const movie = data?.data?.movie || data?.movie || data?.data || null
  return normalizeKinoboxMovie(movie, kpId)
}

const apiSearch = async (searchTerm) => {
  const { data } = await apiCall((client) =>
    client.get('/api/movies/search/', {
      params: {
        query: String(searchTerm),
        ts: Math.floor(Date.now() / 1000)
      }
    })
  )

  return normalizeKinoboxSearchResponse(data)
}

export {
  apiSearch,
  getKpInfo,
  getPlayers,
  getPlayersRaw,
  normalizeKinoboxMovie,
  normalizeKinoboxSearchResponse
}

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
