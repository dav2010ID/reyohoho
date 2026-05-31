import { useMainStore } from '@/store/main'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { trackAnalyticsEvent } from '@/utils/analytics'

const CONTENT_PROVIDERS = {
  RHSERV: 'rhserv',
  KINOBD: 'kinobd',
  KINOBOX: 'kinobox',
  DDBB: 'ddbb'
}

const KINOBD_SUPPORTED_METHODS = new Set([
  'apiSearch',
  'getKpInfo',
  'getMovies',
  'getDiscussedMovies',
  'getKpIDfromIMDB',
  'getRandomMovie'
])
const KINOBOX_SUPPORTED_METHODS = new Set(['getPlayers'])
const DDBB_SUPPORTED_METHODS = new Set(['getPlayers'])
const PLAYER_PROVIDER_TIMEOUT_MS = 15000

const providers = {
  rhserv: null,
  kinobd: null,
  kinobox: null,
  ddbb: null
}

const providerImporters = {
  rhserv: () => import('@/api/movies.rhserv'),
  kinobd: () => import('@/api/movies.kinobd'),
  kinobox: () => import('@/api/movies.kinobox'),
  ddbb: () => import('@/api/movies.ddbb')
}

const loadProvider = async (provider) => {
  if (!providers[provider]) {
    providers[provider] = providerImporters[provider]()
  }

  return providers[provider]
}

const getCurrentProvider = () => {
  try {
    const mainStore = useMainStore()
    return mainStore.contentApiProvider || CONTENT_PROVIDERS.KINOBOX
  } catch {
    return CONTENT_PROVIDERS.KINOBOX
  }
}

const getCurrentSearchProvider = () => {
  try {
    const mainStore = useMainStore()
    return mainStore.searchApiProvider || CONTENT_PROVIDERS.RHSERV
  } catch {
    return CONTENT_PROVIDERS.RHSERV
  }
}

const searchKinoBDPlayerCandidates = async (...args) =>
  (await loadProvider('kinobd')).searchPlayerCandidates(...args)
const getKinoBDPlayerDataByInid = async (...args) =>
  (await loadProvider('kinobd')).getPlayerDataByInid(...args)

const hasPlayers = (players) => {
  if (Array.isArray(players)) return players.length > 0
  if (!players || typeof players !== 'object') return false
  return Object.keys(players).length > 0
}

const createProviderTimeoutError = (provider) => {
  const error = new Error(`getPlayers timed out on ${provider}`)
  error.name = 'PlayerProviderTimeoutError'
  return error
}

const withProviderTimeout = async (promise, provider) => {
  let timeoutId = null

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(createProviderTimeoutError(provider)),
          PLAYER_PROVIDER_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

const trackPlayerProviderAttempt = (eventName, params) => {
  trackAnalyticsEvent('player_provider_attempt', params)
  if (eventName) {
    trackAnalyticsEvent(eventName, params)
  }
}

const getPlayersWithFallback = async (...args) => {
  const provider = getCurrentProvider()
  const startedAt = Date.now()
  const [contentId] = args
  const supportedPlayersProviders = [
    CONTENT_PROVIDERS.KINOBOX,
    CONTENT_PROVIDERS.DDBB,
    CONTENT_PROVIDERS.KINOBD
  ]
  const order = [
    provider,
    ...supportedPlayersProviders.filter((currentProvider) => currentProvider !== provider)
  ].filter((currentProvider) => supportedPlayersProviders.includes(currentProvider))

  let lastError = null

  for (const currentProvider of order) {
    const attemptStartedAt = Date.now()

    try {
      const providerApi = await loadProvider(currentProvider)
      const players = await withProviderTimeout(providerApi.getPlayers(...args), currentProvider)

      if (hasPlayers(players)) {
        trackPlayerProviderAttempt(null, {
          status: 'success',
          kp_id: contentId,
          configured_source: provider,
          source: currentProvider,
          fallback_used: currentProvider !== provider,
          duration_ms: Date.now() - startedAt,
          attempt_duration_ms: Date.now() - attemptStartedAt
        })
        return players
      }

      trackPlayerProviderAttempt(null, {
        status: 'empty',
        kp_id: contentId,
        configured_source: provider,
        source: currentProvider,
        fallback_used: currentProvider !== provider,
        duration_ms: Date.now() - startedAt,
        attempt_duration_ms: Date.now() - attemptStartedAt
      })
      console.warn(`[movies] getPlayers returned no players on ${currentProvider}`)
    } catch (error) {
      lastError = error
      const isTimeout = error?.name === 'PlayerProviderTimeoutError'
      const attemptPayload = {
        status: isTimeout ? 'timeout' : 'error',
        kp_id: contentId,
        configured_source: provider,
        source: currentProvider,
        fallback_used: currentProvider !== provider,
        duration_ms: Date.now() - startedAt,
        attempt_duration_ms: Date.now() - attemptStartedAt
      }

      if (isTimeout) {
        attemptPayload.timeout_ms = PLAYER_PROVIDER_TIMEOUT_MS
      }

      trackPlayerProviderAttempt(
        isTimeout ? 'player_provider_timeout' : 'player_provider_error',
        attemptPayload
      )
      console.warn(`[movies] getPlayers failed on ${currentProvider}`, error)
    }
  }

  if (lastError) {
    console.warn('[movies] getPlayers fallback exhausted; returning empty players map', lastError)
  }

  return {}
}

const callWithProvider = async (methodName, ...args) => {
  const provider = getCurrentProvider()

  if (provider === CONTENT_PROVIDERS.KINOBOX && KINOBOX_SUPPORTED_METHODS.has(methodName)) {
    try {
      const kinobox = await loadProvider('kinobox')
      return await kinobox[methodName](...args)
    } catch (error) {
      console.warn(`[movies] ${methodName} failed on Kinobox, fallback to KinoBD/RHServ`, error)
      if (KINOBD_SUPPORTED_METHODS.has(methodName)) {
        try {
          const kinobd = await loadProvider('kinobd')
          return await kinobd[methodName](...args)
        } catch (fallbackError) {
          console.warn(`[movies] ${methodName} failed on KinoBD, fallback to RHServ`, fallbackError)
        }
      }
      const rhserv = await loadProvider('rhserv')
      return await rhserv[methodName](...args)
    }
  }

  if (provider === CONTENT_PROVIDERS.DDBB && DDBB_SUPPORTED_METHODS.has(methodName)) {
    try {
      const ddbb = await loadProvider('ddbb')
      return await ddbb[methodName](...args)
    } catch (error) {
      console.warn(
        `[movies] ${methodName} failed on DDBB, fallback to Kinobox/KinoBD/RHServ`,
        error
      )
      try {
        const kinobox = await loadProvider('kinobox')
        return await kinobox[methodName](...args)
      } catch (fallbackError) {
        console.warn(
          `[movies] ${methodName} failed on Kinobox, fallback to KinoBD/RHServ`,
          fallbackError
        )
        if (KINOBD_SUPPORTED_METHODS.has(methodName)) {
          try {
            const kinobd = await loadProvider('kinobd')
            return await kinobd[methodName](...args)
          } catch (kinobdError) {
            console.warn(`[movies] ${methodName} failed on KinoBD, fallback to RHServ`, kinobdError)
          }
        }
        const rhserv = await loadProvider('rhserv')
        return await rhserv[methodName](...args)
      }
    }
  }

  if (provider === CONTENT_PROVIDERS.KINOBD && KINOBD_SUPPORTED_METHODS.has(methodName)) {
    try {
      const kinobd = await loadProvider('kinobd')
      return await kinobd[methodName](...args)
    } catch (error) {
      console.warn(`[movies] ${methodName} failed on KinoBD, fallback to RHServ`, error)
      const rhserv = await loadProvider('rhserv')
      return await rhserv[methodName](...args)
    }
  }

  const rhserv = await loadProvider('rhserv')
  return await rhserv[methodName](...args)
}

const apiSearch = async (...args) => {
  const provider = getCurrentSearchProvider()

  if (provider === CONTENT_PROVIDERS.KINOBD) {
    try {
      const kinobd = await loadProvider('kinobd')
      return await normalizeMovieListResponse(await kinobd.apiSearch(...args))
    } catch (error) {
      console.warn('[movies] apiSearch failed on KinoBD, fallback to RHServ', error)
      const rhserv = await loadProvider('rhserv')
      return await normalizeMovieListResponse(await rhserv.apiSearch(...args))
    }
  }

  const rhserv = await loadProvider('rhserv')
  return await normalizeMovieListResponse(await rhserv.apiSearch(...args))
}

const hasKpInfo = (movieInfo) => {
  if (!movieInfo || typeof movieInfo !== 'object') return false
  return Boolean(
    movieInfo.kinopoisk_id ||
    movieInfo.id_kp ||
    movieInfo.name_ru ||
    movieInfo.name_original ||
    movieInfo.description
  )
}

const getKpInfoWithFallback = async (...args) => {
  const [kpId] = args
  const order = [CONTENT_PROVIDERS.RHSERV, CONTENT_PROVIDERS.KINOBOX, CONTENT_PROVIDERS.KINOBD]
  let lastError = null

  for (const provider of order) {
    try {
      const providerApi = await loadProvider(provider)
      if (typeof providerApi.getKpInfo !== 'function') continue

      const movieInfo = await providerApi.getKpInfo(...args)
      if (hasKpInfo(movieInfo)) {
        if (provider !== CONTENT_PROVIDERS.RHSERV) {
          console.warn(`[movies] getKpInfo fallback used: ${provider}`, { kp_id: kpId })
        }
        return movieInfo
      }

      console.warn(`[movies] getKpInfo returned empty result on ${provider}`, { kp_id: kpId })
    } catch (error) {
      lastError = error
      console.warn(`[movies] getKpInfo failed on ${provider}`, error)
    }
  }

  if (lastError) throw lastError
  return null
}
const getShikiInfo = async (...args) => callWithProvider('getShikiInfo', ...args)
const getKpInfo = async (...args) => getKpInfoWithFallback(...args)
const getPlayers = async (...args) => getPlayersWithFallback(...args)
const getShikiPlayers = async (...args) => callWithProvider('getShikiPlayers', ...args)
const shouldEnrichListSeo = import.meta.env.SSR
// Top lists now come from KinoBD because it exposes stable page-based pagination.
const getMovies = async (...args) => {
  try {
    return await normalizeMovieListResponse(
      await (await loadProvider('kinobd')).getMovies(...args),
      {
        enrichMissingSeo: shouldEnrichListSeo
      }
    )
  } catch (error) {
    console.warn('[movies] getMovies failed on KinoBD, fallback to RHServ', error)
    return await normalizeMovieListResponse(
      await (await loadProvider('rhserv')).getMovies(...args),
      {
        enrichMissingSeo: shouldEnrichListSeo
      }
    )
  }
}
const getDiscussedMovies = async (...args) =>
  await normalizeMovieListResponse(
    await (await loadProvider('rhserv')).getDiscussedMovies(...args),
    {
      enrichMissingSeo: shouldEnrichListSeo
    }
  )
const getDons = async (...args) => callWithProvider('getDons', ...args)
const getKpIDfromIMDB = async (...args) => callWithProvider('getKpIDfromIMDB', ...args)
const getNudityInfoFromIMDB = async (...args) => callWithProvider('getNudityInfoFromIMDB', ...args)
const getKpIDfromSHIKI = async (...args) => callWithProvider('getKpIDfromSHIKI', ...args)
const getRating = async (...args) => callWithProvider('getRating', ...args)
const setRating = async (...args) => callWithProvider('setRating', ...args)
const getComments = async (...args) => callWithProvider('getComments', ...args)
const createComment = async (...args) => callWithProvider('createComment', ...args)
const updateComment = async (...args) => callWithProvider('updateComment', ...args)
const deleteComment = async (...args) => callWithProvider('deleteComment', ...args)
const rateComment = async (...args) => callWithProvider('rateComment', ...args)
const submitTiming = async (...args) => callWithProvider('submitTiming', ...args)
const updateTiming = async (...args) => callWithProvider('updateTiming', ...args)
const deleteTiming = async (...args) => callWithProvider('deleteTiming', ...args)
const reportTiming = async (...args) => callWithProvider('reportTiming', ...args)
const getTopTimingSubmitters = async (...args) =>
  callWithProvider('getTopTimingSubmitters', ...args)
const getAllTimingSubmissions = async (...args) =>
  callWithProvider('getAllTimingSubmissions', ...args)
const getRandomMovie = async (...args) => callWithProvider('getRandomMovie', ...args)
const approveTiming = async (...args) => callWithProvider('approveTiming', ...args)
const rejectTiming = async (...args) => callWithProvider('rejectTiming', ...args)
const markAsCleanText = async (...args) => callWithProvider('markAsCleanText', ...args)
const getTwitchStream = async (...args) => callWithProvider('getTwitchStream', ...args)
const voteOnTiming = async (...args) => callWithProvider('voteOnTiming', ...args)
const getTimingVote = async (...args) => callWithProvider('getTimingVote', ...args)
const getMovieNote = async (...args) => callWithProvider('getMovieNote', ...args)
const saveMovieNote = async (...args) => callWithProvider('saveMovieNote', ...args)
const deleteMovieNote = async (...args) => callWithProvider('deleteMovieNote', ...args)

export {
  searchKinoBDPlayerCandidates,
  getKinoBDPlayerDataByInid,
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
  return Promise.all([
    loadProvider('rhserv'),
    loadProvider('kinobd'),
    loadProvider('kinobox'),
    loadProvider('ddbb')
  ]).then(([rhserv, kinobd, kinobox, ddbb]) => {
    if (typeof rhserv.toggleErrorSimulation === 'function') {
      rhserv.toggleErrorSimulation(enabled)
    }
    if (typeof kinobd.toggleErrorSimulation === 'function') {
      kinobd.toggleErrorSimulation(enabled)
    }
    if (typeof kinobox.toggleErrorSimulation === 'function') {
      kinobox.toggleErrorSimulation(enabled)
    }
    if (typeof ddbb.toggleErrorSimulation === 'function') {
      ddbb.toggleErrorSimulation(enabled)
    }
  })
}
