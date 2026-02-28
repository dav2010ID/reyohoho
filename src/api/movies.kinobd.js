import axios from 'axios'
import * as rhserv from '@/api/movies.rhserv'
import { resolvePosterSetByMovie } from '@/utils/mediaUtils'

let apiInstance = null
let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const KINOBD_BASE_URL =
  import.meta.env.VITE_KINOBD_API_URL || import.meta.env.VITE_APP_API2_URL || 'https://kinobd.net'
const KINOBD_TOKEN = import.meta.env.VITE_KINOBD_TOKEN || ''
const DEFAULT_PLAYER_PROVIDERS = [
  'collaps',
  'vibix',
  'alloha',
  'kodik',
  'kinotochka',
  'flixcdn',
  'ashdi',
  'turbo',
  'videocdn',
  'bazon',
  'ustore',
  'pleer',
  'videospider',
  'iframe',
  'moonwalk',
  'hdvb',
  'cdnmovies',
  'lookbase',
  'kholobok',
  'videoapi',
  'voidboost',
  'trailer_local',
  'videoseed',
  'ia',
  'youtube',
  'ext',
  'trailer',
  'netflix',
  'torrent',
  'vk',
  'nf'
].join(',')

const getApi = () => {
  if (apiInstance) return apiInstance

  apiInstance = axios.create({
    baseURL: KINOBD_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
  })

  apiInstance.interceptors.request.use(
    (config) => {
      if (KINOBD_TOKEN) {
        config.params = config.params || {}
        if (!config.params.token) {
          config.params.token = KINOBD_TOKEN
        }
      }
      return config
    },
    (err) => Promise.reject(err)
  )

  return apiInstance
}

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
  const api = getApi()
  return await callFn(api)
}

const toAbsoluteUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  try {
    return new URL(value, KINOBD_BASE_URL).toString()
  } catch {
    return value
  }
}

const extractIframeUrl = (value) => {
  if (!value || typeof value !== 'string') return ''

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
    return toAbsoluteUrl(value)
  }

  const dataSrcMatch = value.match(/data-src="([^"]+)"/i)
  if (dataSrcMatch?.[1]) return toAbsoluteUrl(dataSrcMatch[1])

  const srcMatch = value.match(/src="([^"]+)"/i)
  if (srcMatch?.[1]) return toAbsoluteUrl(srcMatch[1])

  return ''
}

const parseCountries = (film) => {
  if (Array.isArray(film?.countries)) {
    return film.countries
      .map((c) => c?.name_ru || c?.country || c?.name || '')
      .filter(Boolean)
      .map((country) => ({ country }))
  }

  if (typeof film?.country_ru === 'string' && film.country_ru.trim()) {
    return film.country_ru
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((country) => ({ country }))
  }

  return []
}

const parseGenres = (film) => {
  if (Array.isArray(film?.genres)) {
    return film.genres
      .map((g) => g?.name_ru || g?.genre || g?.name || '')
      .filter(Boolean)
      .map((genre) => ({ genre }))
  }

  if (typeof film?.genre_ru === 'string' && film.genre_ru.trim()) {
    return film.genre_ru
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
      .map((genre) => ({ genre }))
  }

  return []
}

const toLegacyType = (typeValue) => {
  const type = String(typeValue || '').toLowerCase()
  if (type.includes('series')) return 'TV_SERIES'
  if (type.includes('show')) return 'TV_SERIES'
  if (type.includes('movie')) return 'FILM'
  return 'FILM'
}

const buildLegacyMovie = (film) => {
  const kpId = film?.kinopoisk_id || film?.kp_id || film?.id || null
  const year = film?.year || film?.year_start || ''
  const nameRu = film?.name_russian || ''
  const nameEn = film?.name_original || ''
  const titleBase = nameRu || nameEn || 'Без названия'
  const title = year ? `${titleBase} (${year})` : titleBase
  const ratingKp = film?.rating_kp
  const normalizedRating =
    ratingKp === null || ratingKp === undefined || ratingKp === '' ? 'null' : String(ratingKp)
  const posters = resolvePosterSetByMovie({
    ...film,
    kp_id: kpId
  })

  return {
    id: kpId,
    kp_id: kpId ? String(kpId) : '',
    title,
    year: year ? String(year) : '',
    poster: posters.preview,
    average_rating:
      ratingKp === null || ratingKp === undefined || Number.isNaN(Number(ratingKp))
        ? null
        : Number(ratingKp),
    raw_data: {
      film_id: kpId,
      name_ru: nameRu,
      name_en: nameEn,
      type: toLegacyType(film?.type),
      year: year ? String(year) : null,
      description: film?.description || null,
      film_length: film?.time || null,
      countries: parseCountries(film),
      genres: parseGenres(film),
      rating: normalizedRating,
      rating_vote_count: film?.rating_kp_count || 0,
      poster_url: posters.full,
      poster_url_preview: posters.preview
    },
    source: 'kinobd'
  }
}

const mapKpInfo = (film) => {
  const legacy = buildLegacyMovie(film)
  const countries = parseCountries(film)
  const genres = parseGenres(film)

  return {
    ...film,
    ...legacy,
    id_kp: film?.kinopoisk_id || film?.kp_id || null,
    imdb_id: film?.imdb_id || null,
    kinopoisk_id: film?.kinopoisk_id || film?.kp_id || null,
    name_ru: film?.name_russian || '',
    name_en: film?.name_original || '',
    name_original: film?.name_original || '',
    short_description: film?.description || '',
    description: film?.description || '',
    year: String(film?.year || film?.year_start || ''),
    countries,
    genres,
    film_length: film?.time_minutes || null,
    poster_url: legacy.raw_data.poster_url,
    poster_url_preview: legacy.raw_data.poster_url_preview,
    logo_url: '',
    screenshots: [legacy.raw_data.poster_url].filter(Boolean),
    nudity_timings: [],
    videos: film?.yt_video_id
      ? [
          {
            name: 'YouTube Trailer',
            iframeUrl: `https://www.youtube.com/embed/${film.yt_video_id}`
          }
        ]
      : [],
    sequels_and_prequels: [],
    similars: [],
    staff: [],
    rating: legacy.raw_data.rating,
    rating_vote_count: legacy.raw_data.rating_vote_count
  }
}

const ensureUniqueKey = (obj, baseKey) => {
  if (!obj[baseKey]) return baseKey
  let idx = 2
  while (obj[`${baseKey} #${idx}`]) idx++
  return `${baseKey} #${idx}`
}

const buildPlayersMap = (items = []) => {
  const players = {}

  for (const item of items) {
    const iframe = extractIframeUrl(item?.iframe)
    if (!iframe) continue

    const baseKey = `KINOBD>${item?.name_russian || item?.name_original || item?.id || 'Player'}`
    const key = ensureUniqueKey(players, baseKey)

    players[key] = {
      name: key,
      translate: item?.name_russian || item?.name_original || 'KinoBD',
      iframe,
      quality: item?.time || '',
      warning: false,
      source: 'kinobd',
      raw_data: item
    }

    if (item?.yt_video_id) {
      const trailerKey = ensureUniqueKey(players, 'TRAILER>YouTube')
      players[trailerKey] = {
        name: trailerKey,
        translate: 'YouTube Trailer',
        iframe: `https://www.youtube.com/embed/${item.yt_video_id}`,
        quality: '',
        warning: false,
        source: 'kinobd'
      }
    }
  }

  return players
}

const toProviderPlayersMap = (providerMap = {}) => {
  const players = {}
  const providers = Object.entries(providerMap || {})

  for (const [provider, value] of providers) {
    const iframe = extractIframeUrl(value?.iframe)
    if (!iframe) continue

    const baseLabel = String(provider || 'player').toUpperCase()
    const translate =
      value?.translate && String(value.translate).trim()
        ? String(value.translate).trim()
        : baseLabel
    const key = ensureUniqueKey(players, baseLabel)

    players[key] = {
      name: key,
      translate,
      iframe,
      quality: value?.quality || '',
      warning: false,
      source: 'kinobd',
      raw_data: value
    }
  }

  return players
}

const searchPlayerCandidates = async (query, { type = 'title', page = 1 } = {}) => {
  const normalizedType = type === 'kp_id' ? 'kp_id' : 'title'
  const { data } = await apiCall((api) =>
    api.get('/api/player/search', {
      params: {
        q: String(query),
        type: normalizedType,
        page
      }
    })
  )

  const rows = Array.isArray(data?.data) ? data.data : []
  return rows.map((item) => ({
    id: item?.id ?? null, // inid for /playerdata
    kp_id: item?.kinopoisk_id || item?.kp_id || null,
    imdb_id: item?.imdb_id || null,
    title: item?.name_russian || item?.name_original || '',
    year: item?.year || '',
    iframe: extractIframeUrl(item?.iframe),
    raw_data: item
  }))
}

const getPlayerDataByInid = async (
  inid,
  { playerUrl = '', cacheKey = '', providers = DEFAULT_PLAYER_PROVIDERS, fast = 1 } = {}
) => {
  const resolvedPlayerUrl = toAbsoluteUrl(playerUrl)
  const playerOrigin = (() => {
    try {
      return resolvedPlayerUrl ? new URL(resolvedPlayerUrl).origin : ''
    } catch {
      return ''
    }
  })()

  const params = cacheKey ? `cache${cacheKey}` : `cache${inid}`
  const body = new URLSearchParams({
    fast: String(fast),
    inid: String(inid),
    player: providers
  })

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (resolvedPlayerUrl) headers['X-Re'] = resolvedPlayerUrl
  if (playerOrigin) {
    headers.Origin = playerOrigin
    headers.Referer = `${playerOrigin}/`
  }

  const { data } = await apiCall((api) =>
    api.post(`/playerdata?${params}`, body.toString(), {
      headers
    })
  )

  return toProviderPlayersMap(data)
}

const apiSearch = async (searchTerm, page = 1) => {
  const { data } = await apiCall((api) =>
    api.get('/api/films/search/title', {
      params: {
        q: searchTerm,
        page
      }
    })
  )

  const rows = Array.isArray(data?.data) ? data.data : []
  return rows.map(buildLegacyMovie)
}

const getKpInfo = async (kpId) => {
  const { data } = await apiCall((api) =>
    api.get('/api/films/search/kp_id', {
      params: {
        q: String(kpId),
        page: 1,
        with: 'persons,genres,countries,popularity,images'
      }
    })
  )

  const film = Array.isArray(data?.data) ? data.data[0] : null
  return film ? mapKpInfo(film) : null
}

const getPlayers = async (kpId, options = {}) => {
  const {
    mode = 'kp_id',
    selectIndex = 0,
    usePlayerData = true,
    providers = DEFAULT_PLAYER_PROVIDERS,
    forceInid = null
  } = options
  const searchType = mode === 'title' ? 'title' : 'kp_id'
  const candidates = await searchPlayerCandidates(kpId, { type: searchType, page: 1 })

  if (!candidates.length && !forceInid) return {}

  if (usePlayerData) {
    let selected = null
    if (forceInid) {
      selected = candidates.find((item) => String(item.id) === String(forceInid)) || null
    }
    if (!selected && candidates.length > 0) {
      selected = candidates[Math.max(0, Math.min(selectIndex, candidates.length - 1))]
    }

    if (selected?.id || forceInid) {
      try {
        return await getPlayerDataByInid(selected?.id || forceInid, {
          playerUrl: selected?.iframe || '',
          providers
        })
      } catch (error) {
        console.warn('[movies.kinobd] /playerdata failed, fallback to iframe list', error)
      }
    }
  }

  return buildPlayersMap(candidates.map((c) => c.raw_data))
}

const getShikiInfo = async (...args) => rhserv.getShikiInfo(...args)

const getShikiPlayers = async (...args) => rhserv.getShikiPlayers(...args)

const getMovies = async ({ activeTime = 'all', typeFilter = 'all', limit = null, page = 1 } = {}) => {
  let endpoint = '/api/films/top'
  const params = { page }

  if (limit) params.per_page = limit
  if (activeTime === 'updates') endpoint = '/api/films/updates'

  const { data } = await apiCall((api) => api.get(endpoint, { params }))
  let rows = Array.isArray(data?.data) ? data.data : []

  if (typeFilter === 'movie') {
    rows = rows.filter((f) => String(f?.type || '').toLowerCase().includes('movie'))
  } else if (typeFilter === 'series') {
    rows = rows.filter((f) => {
      const t = String(f?.type || '').toLowerCase()
      return t.includes('series') || t.includes('show')
    })
  }

  return rows.map(buildLegacyMovie)
}

const getDiscussedMovies = async () => {
  const { data } = await apiCall((api) => api.get('/api/films/top-views', { params: { page: 1 } }))
  const rows = Array.isArray(data?.data) ? data.data : []
  return rows.map(buildLegacyMovie)
}

const getKpIDfromIMDB = async (imdbId) => {
  const { data } = await apiCall((api) =>
    api.get('/api/films/search/imdb_id', {
      params: {
        q: String(imdbId),
        page: 1
      }
    })
  )
  const film = Array.isArray(data?.data) ? data.data[0] : null
  return { id_kp: film?.kinopoisk_id || null, film: film ? mapKpInfo(film) : null }
}

const getRandomMovie = async () => {
  const { data } = await apiCall((api) => api.get('/api/films/top', { params: { page: 1, per_page: 50 } }))
  const rows = Array.isArray(data?.data) ? data.data : []
  if (!rows.length) return { kp_id: null }

  const pick = rows[Math.floor(Math.random() * rows.length)]
  return { kp_id: pick?.kinopoisk_id || null, source: 'kinobd', film: buildLegacyMovie(pick) }
}

const getDons = async (...args) => rhserv.getDons(...args)
const getKpIDfromSHIKI = async (...args) => rhserv.getKpIDfromSHIKI(...args)
const getNudityInfoFromIMDB = async (...args) => rhserv.getNudityInfoFromIMDB(...args)
const getRating = async (...args) => rhserv.getRating(...args)
const setRating = async (...args) => rhserv.setRating(...args)
const getComments = async (...args) => rhserv.getComments(...args)
const createComment = async (...args) => rhserv.createComment(...args)
const updateComment = async (...args) => rhserv.updateComment(...args)
const deleteComment = async (...args) => rhserv.deleteComment(...args)
const rateComment = async (...args) => rhserv.rateComment(...args)
const submitTiming = async (...args) => rhserv.submitTiming(...args)
const updateTiming = async (...args) => rhserv.updateTiming(...args)
const deleteTiming = async (...args) => rhserv.deleteTiming(...args)
const reportTiming = async (...args) => rhserv.reportTiming(...args)
const getTopTimingSubmitters = async (...args) => rhserv.getTopTimingSubmitters(...args)
const getAllTimingSubmissions = async (...args) => rhserv.getAllTimingSubmissions(...args)
const approveTiming = async (...args) => rhserv.approveTiming(...args)
const rejectTiming = async (...args) => rhserv.rejectTiming(...args)
const markAsCleanText = async (...args) => rhserv.markAsCleanText(...args)
const getTwitchStream = async (...args) => rhserv.getTwitchStream(...args)
const voteOnTiming = async (...args) => rhserv.voteOnTiming(...args)
const getTimingVote = async (...args) => rhserv.getTimingVote(...args)
const getMovieNote = async (...args) => rhserv.getMovieNote(...args)
const saveMovieNote = async (...args) => rhserv.saveMovieNote(...args)
const deleteMovieNote = async (...args) => rhserv.deleteMovieNote(...args)

export {
  searchPlayerCandidates,
  getPlayerDataByInid,
  apiSearch,
  getShikiInfo,
  getKpInfo,
  getPlayers,
  getShikiPlayers,
  getMovies,
  getDiscussedMovies,
  getDons,
  getKpIDfromIMDB,
  getKpIDfromSHIKI,
  getRating,
  setRating,
  getNudityInfoFromIMDB,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  rateComment,
  submitTiming,
  updateTiming,
  deleteTiming,
  reportTiming,
  getTopTimingSubmitters,
  getAllTimingSubmissions,
  getRandomMovie,
  approveTiming,
  rejectTiming,
  markAsCleanText,
  getTwitchStream,
  voteOnTiming,
  getTimingVote,
  getMovieNote,
  saveMovieNote,
  deleteMovieNote
}

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
