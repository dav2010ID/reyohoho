import { useMainStore } from '@/store/main'
import { normalizeMovieListResponse } from '@/api/movieSeoNormalizer'
import { trackAnalyticsEvent } from '@/utils/analytics'
import { rethrowRequestCancellation } from '@/utils/requestCancellation'
import { getSearchProviderOrder } from '@/api/searchProviderOrder'
import { getMovieInfoProviderOrder, getPlayerProviderOrder } from '@/api/contentProviderOrder'
import {
  CONTENT_PROVIDERS,
  KINOBD_SUPPORTED_METHODS,
  LOCAL_SUPPORTED_METHODS,
  loadProvider
} from '@/api/providerRegistry'

import { KINOBD_ENABLED } from '@/api/providerAvailability'
import { getSafePlayerUrl } from '@/utils/playerSecurity'

const PLAYER_PROVIDER_TIMEOUT_MS = 8000
const PLAYER_HEDGE_MS = 2000
const getCurrentProvider = () => {
  try {
    const mainStore = useMainStore()
    const provider = mainStore.contentApiProvider || CONTENT_PROVIDERS.KINOBOX
    return provider === CONTENT_PROVIDERS.KINOBD && !KINOBD_ENABLED
      ? CONTENT_PROVIDERS.KINOBOX
      : provider
  } catch {
    return CONTENT_PROVIDERS.KINOBOX
  }
}

const getCurrentSearchProvider = () => {
  try {
    const mainStore = useMainStore()
    return mainStore.searchApiProvider || CONTENT_PROVIDERS.KINOBOX
  } catch {
    return CONTENT_PROVIDERS.KINOBOX
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

export const mergePlayerMaps = (playerMaps) => {
  const merged = {}
  const seenIframes = new Set()

  for (const players of playerMaps) {
    for (const [rawKey, player] of Object.entries(players || {})) {
      const iframe = getSafePlayerUrl(player?.iframe)
      if (!iframe) continue
      if (iframe && seenIframes.has(iframe)) continue

      let key = rawKey
      let suffix = 2
      while (merged[key]) {
        key = `${rawKey} #${suffix}`
        suffix += 1
      }
      merged[key] = { ...player, iframe }
      if (iframe) seenIframes.add(iframe)
    }
  }

  const entries = Object.entries(merged)
  const hasCollaps = entries.some(([key, player]) =>
    `${key} ${player?.provider || ''} ${player?.translate || ''}`.toUpperCase().includes('COLLAPS')
  )
  const hasTurbo = entries.some(([key, player]) =>
    `${key} ${player?.provider || ''} ${player?.translate || ''}`.toUpperCase().includes('TURBO')
  )

  for (const [key, player] of entries) {
    const identity = `${key} ${player?.source || ''} ${player?.translate || ''}`.toUpperCase()
    if (hasCollaps && (identity.includes('KPMIRROR') || identity.includes('KP_EMBED'))) {
      delete merged[key]
    }
    if (hasTurbo && identity.includes('OBRUT')) {
      delete merged[key]
    }
  }

  return merged
}

const createProviderTimeoutError = (provider) => {
  const error = new Error(`getPlayers timed out on ${provider}`)
  error.name = 'PlayerProviderTimeoutError'
  return error
}

const withProviderTimeout = async (load, provider, parentSignal) => {
  const controller = new AbortController()
  let timeoutId = null
  let abortListener
  let rejectAbort
  const abortPromise = new Promise((_, reject) => {
    rejectAbort = reject
    abortListener = () =>
      reject(
        controller.signal.reason || Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })
      )
    controller.signal.addEventListener('abort', abortListener, { once: true })
  })
  const parentAbort = () =>
    controller.abort(
      parentSignal.reason || Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })
    )
  if (parentSignal?.aborted) parentAbort()
  else parentSignal?.addEventListener('abort', parentAbort, { once: true })

  try {
    if (controller.signal.aborted) {
      rejectAbort(controller.signal.reason)
      return await abortPromise
    }
    timeoutId = setTimeout(
      () => controller.abort(createProviderTimeoutError(provider)),
      PLAYER_PROVIDER_TIMEOUT_MS
    )
    return await Promise.race([load(controller.signal), abortPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    controller.signal.removeEventListener('abort', abortListener)
    parentSignal?.removeEventListener('abort', parentAbort)
  }
}

const trackPlayerProviderAttempt = (eventName, params) => {
  trackAnalyticsEvent('player_provider_attempt', params)
  if (eventName) {
    trackAnalyticsEvent(eventName, params)
  }
}

const providerBackoff = new Map()
const getPlayersWithFallback = async (contentId, options = {}, ...rest) => {
  const { signal, onAttempt, retryProviders, ...playerOptions } = options
  const provider = getCurrentProvider()
  const startedAt = Date.now()
  const order = getPlayerProviderOrder(provider)
  const healthy = order.filter((source) => !(providerBackoff.get(source) > startedAt))
  const candidates = !retryProviders && healthy.length ? healthy : order
  const group = new AbortController()

  const attempt = async (source) => {
    const start = Date.now()
    onAttempt?.(source)
    let players = {}
    let error
    try {
      players = mergePlayerMaps([await withProviderTimeout(async (attemptSignal) => {
        const api = await loadProvider(source)
        if (attemptSignal.aborted) throw attemptSignal.reason
        return api.getPlayers(contentId, { ...playerOptions, signal: attemptSignal }, ...rest)
      }, source, group.signal)])
    } catch (err) {
      if (group.signal.aborted) throw err
      rethrowRequestCancellation(err)
      error = err
    }
    if (group.signal.aborted) throw group.signal.reason
    const timeout = error?.name === 'PlayerProviderTimeoutError'
    if (error) {
      const status = error.response?.status
      if (!status || status >= 500 || status === 429)
        providerBackoff.set(source, Date.now() + 5 * 60_000)
      console.warn(`[movies] getPlayers failed on ${source}`, error)
    } else {
      providerBackoff.delete(source)
    }
    trackPlayerProviderAttempt(timeout ? 'player_provider_timeout' : error ? 'player_provider_error' : null, {
      status: timeout ? 'timeout' : error ? 'error' : hasPlayers(players) ? 'success' : 'empty',
      kp_id: contentId, configured_source: provider, source, fallback_used: source !== order[0],
      duration_ms: Date.now() - startedAt, attempt_duration_ms: Date.now() - start,
      ...(timeout ? { timeout_ms: PLAYER_PROVIDER_TIMEOUT_MS } : {})
    })
    return players
  }

  let timer
  const cancel = () => group.abort(signal.reason)
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  try {
    if (group.signal.aborted) throw group.signal.reason
    return await new Promise((resolve, reject) => {
      group.signal.addEventListener('abort', () => reject(group.signal.reason), { once: true })
      let next = 0
      let pending = 0
      const launch = () => {
        clearTimeout(timer)
        if (group.signal.aborted) return
        if (next === candidates.length) {
          if (!pending) resolve({})
          return
        }
        const source = candidates[next++]
        pending++
        attempt(source).then((players) => {
          pending--
          if (group.signal.aborted) return
          if (hasPlayers(players)) {
            resolve(players)
            group.abort()
          } else {
            launch()
          }
        }, reject)
        if (next < candidates.length) timer = setTimeout(launch, PLAYER_HEDGE_MS)
      }
      launch()
    })
  } finally {
    clearTimeout(timer)
    group.abort()
    signal?.removeEventListener('abort', cancel)
  }
}

const callWithProvider = async (methodName, ...args) => {
  const provider = getCurrentProvider()

  if (provider === CONTENT_PROVIDERS.LOCAL && LOCAL_SUPPORTED_METHODS.has(methodName)) {
    try {
      const local = await loadProvider(CONTENT_PROVIDERS.LOCAL)
      return await local[methodName](...args)
    } catch (error) {
      rethrowRequestCancellation(error)
      throw error
    }
  }

  if (
    KINOBD_ENABLED &&
    provider === CONTENT_PROVIDERS.KINOBD &&
    KINOBD_SUPPORTED_METHODS.has(methodName)
  ) {
    try {
      const kinobd = await loadProvider('kinobd')
      return await kinobd[methodName](...args)
    } catch (error) {
      rethrowRequestCancellation(error)
      throw error
    }
  }

  const backend = await loadProvider(CONTENT_PROVIDERS.BACKEND)
  return await backend[methodName](...args)
}

const apiSearch = async (...args) => {
  const configuredProvider = getCurrentSearchProvider()
  const order = getSearchProviderOrder(configuredProvider)
  let lastError = null
  let successfulSearch = false

  for (const provider of order) {
    try {
      const providerApi = await loadProvider(provider)
      if (typeof providerApi.apiSearch !== 'function') continue

      const results = await normalizeMovieListResponse(await providerApi.apiSearch(...args))
      successfulSearch = true
      if (Array.isArray(results) && results.length > 0) {
        if (provider !== configuredProvider) {
          console.warn(`[movies] apiSearch fallback used: ${provider}`)
        }
        return results
      }

      console.warn(`[movies] apiSearch returned no results on ${provider}`)
    } catch (error) {
      rethrowRequestCancellation(error)
      lastError = error
      console.warn(`[movies] apiSearch failed on ${provider}`, error)
    }
  }

  if (lastError && !successfulSearch) throw lastError
  return []
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
  const configuredProvider = getCurrentProvider()
  const order = getMovieInfoProviderOrder(configuredProvider)
  let lastError = null

  for (const provider of order) {
    try {
      const providerApi = await loadProvider(provider)
      if (typeof providerApi.getKpInfo !== 'function') continue

      const movieInfo = await providerApi.getKpInfo(...args)
      if (hasKpInfo(movieInfo)) {
        if (provider !== configuredProvider) {
          console.warn(`[movies] getKpInfo fallback used: ${provider}`, { kp_id: kpId })
        }
        return movieInfo
      }

      console.warn(`[movies] getKpInfo returned empty result on ${provider}`, { kp_id: kpId })
    } catch (error) {
      rethrowRequestCancellation(error)
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
// KinoBD code is preserved; remote top lists now use the Worker's fixed Kinopoisk query.
const getMovies = async (...args) => {
  if (getCurrentProvider() === CONTENT_PROVIDERS.LOCAL) {
    try {
      return await normalizeMovieListResponse(
        await (await loadProvider('local')).getMovies(...args),
        { enrichMissingSeo: shouldEnrichListSeo }
      )
    } catch (error) {
      rethrowRequestCancellation(error)
      console.warn('[movies] getMovies failed on local backend', error)
      // Do not silently present a rating top as local day/week popularity.
      if (!KINOBD_ENABLED) throw error
    }
  }
  if (!KINOBD_ENABLED) {
    return normalizeMovieListResponse(
      await (await loadProvider(CONTENT_PROVIDERS.KINOBOX)).getTopMovies(...args),
      { enrichMissingSeo: shouldEnrichListSeo }
    )
  }
  try {
    return await normalizeMovieListResponse(
      await (await loadProvider('kinobd')).getMovies(...args),
      {
        enrichMissingSeo: shouldEnrichListSeo
      }
    )
  } catch (error) {
    rethrowRequestCancellation(error)
    console.warn('[movies] getMovies failed on KinoBD', error)
    return []
  }
}
const getDiscussedMovies = async (...args) => {
  if (getCurrentProvider() === CONTENT_PROVIDERS.LOCAL) {
    try {
      return await normalizeMovieListResponse(
        await (await loadProvider(CONTENT_PROVIDERS.LOCAL)).getDiscussedMovies(...args),
        { enrichMissingSeo: shouldEnrichListSeo }
      )
    } catch (error) {
      rethrowRequestCancellation(error)
      console.warn('[movies] getDiscussedMovies failed on local backend', error)
    }
  }
  if (!KINOBD_ENABLED) return []
  try {
    return await normalizeMovieListResponse(
      await (await loadProvider(CONTENT_PROVIDERS.KINOBD)).getDiscussedMovies(...args),
      { enrichMissingSeo: shouldEnrichListSeo }
    )
  } catch (error) {
    rethrowRequestCancellation(error)
    console.warn('[movies] getDiscussedMovies failed on KinoBD', error)
    return []
  }
}
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
const getRandomMovie = async (...args) => {
  const provider = getCurrentProvider()
  if (provider === CONTENT_PROVIDERS.LOCAL || provider === CONTENT_PROVIDERS.BACKEND) {
    return callWithProvider('getRandomMovie', ...args)
  }
  return (await loadProvider(CONTENT_PROVIDERS.KINOBOX)).getRandomMovie(...args)
}
const approveTiming = async (...args) => callWithProvider('approveTiming', ...args)
const rejectTiming = async (...args) => callWithProvider('rejectTiming', ...args)
const markAsCleanText = async (...args) => callWithProvider('markAsCleanText', ...args)
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
  voteOnTiming,
  getTimingVote,
  getMovieNote,
  saveMovieNote,
  deleteMovieNote
}
