import { cacheMatch, cachePut, logPublicCache } from './public-cache.mjs'

// Optional card extras from the Kino API catalogue. The API key is one shared
// budget for the whole site, so answers are cached hard and failures back off.
const BASE = 'https://kinoapi.lampac.dev/api/v1'
const MAX_BYTES = 1024 * 1024
// Bump to drop cached extras after changing their shape.
const FORMAT = '2'
const VALID_ID = /^[1-9]\d{0,11}$/
const IMDB_ID = /^tt\d{5,10}$/
const YOUTUBE_ID = /^[\w-]{11}$/
const YANDEX_IMAGE = /^https:\/\/avatars\.mds\.yandex\.net\/[\w./-]+$/
const STALE_TTL = 7 * 86400
const PARTIAL_TTL = 600
const MISSING_TTL = 3600
const RETRY_TTL = 30
const RATE_LIMIT_TTL = 60
const AUTH_TTL = 300
const LEASE_MS = 20_000
const WAIT_MS = 500
const MAX_WAITS = 16
const MAX_LEASES = 256
// Primitive leases only, never cross-request promises.
const leases = new Map()

const upstreamError = (message, reason, upstreamStatus) =>
  Object.assign(new Error(message), { reason, upstreamStatus })
const positive = (value) => (Number.isInteger(value) && value > 0 ? value : undefined)
const text = (value, max) =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined
const contentType = (value) => (value === 'movie' || value === 'tv' ? value : undefined)

export function resolveMovieExtras(url) {
  const match = /^\/api\/movies\/([^/]+)\/extras\/?$/.exec(url.pathname)
  if (!match) return null
  if (!VALID_ID.test(match[1])) return { error: 'Invalid Kinopoisk ID', status: 400 }
  return { kind: 'extras', params: { id: match[1] }, cacheTtl: 86400 }
}

const percent = (omdb, source, pattern) => {
  const entry = Array.isArray(omdb) ? omdb.find((item) => item?.Source === source) : null
  const value = Number(pattern.exec(typeof entry?.Value === 'string' ? entry.Value : '')?.[1])
  return value >= 0 && value <= 100 ? value : undefined
}

// Forward only validated public fields in our own shape, never the upstream object.
export function toMovieExtras(title, similar) {
  const ownId = positive(title?.id?.kinopoisk)
  const tmdb = title?.ratings?.tmdb
  const seen = new Set([ownId])
  const related = []
  for (const item of Array.isArray(similar) ? similar : []) {
    const kinopoiskId = positive(item?.id?.kinopoisk)
    const names = {
      russian: text(item?.title?.ru, 300),
      original: text(item?.title?.original, 300)
    }
    if (!kinopoiskId || seen.has(kinopoiskId) || !(names.russian || names.original)) continue
    seen.add(kinopoiskId)
    related.push({
      kinopoiskId,
      type: contentType(item.type),
      title: names,
      year: positive(item.release?.year)
    })
  }
  return {
    ids: {
      kinopoisk: ownId,
      tmdb: positive(title?.id?.tmdb),
      imdb: IMDB_ID.test(title?.id?.imdb) ? title.id.imdb : undefined,
      shikimori: positive(title?.id?.shikimori)
    },
    type: contentType(title?.type),
    tagline: text(title?.tagline?.ru, 300),
    logoUrl: YANDEX_IMAGE.test(title?.images?.logo) ? title.images.logo : undefined,
    ratings: {
      tmdb:
        typeof tmdb?.value === 'number' && tmdb.value > 0 && tmdb.value <= 10
          ? { value: tmdb.value, votes: positive(tmdb.votes) }
          : undefined,
      rottenTomatoes: percent(title?.ratings?.omdb, 'Rotten Tomatoes', /^(\d{1,3})%$/),
      metacritic: percent(title?.ratings?.omdb, 'Metacritic', /^(\d{1,3})\/100$/)
    },
    trailers: [
      ...new Set([title?.trailers?.ru, title?.trailers?.en].filter((id) => YOUTUBE_ID.test(id)))
    ],
    similar: related.slice(0, 12)
  }
}

async function readBoundedJson(response) {
  if (!response.body) throw upstreamError('Empty Kino API response', 'empty')
  const reader = response.body.getReader()
  try {
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) throw upstreamError('Kino API response too large', 'size')
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
      throw upstreamError('Invalid Kino API JSON', 'json')
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

export async function requestMovieExtras(id, key, fetchImpl = fetch, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const get = async (path) => {
    const response = await fetchImpl(BASE + path, {
      // Never follow an upstream redirect: it would carry the key to another host.
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-API-Key': key }
    })
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {})
      throw upstreamError('Kino API upstream HTTP ' + response.status, 'http', response.status)
    }
    return (await readBoundedJson(response))?.data
  }
  try {
    let title
    try {
      title = await get(`/titles/by/kinopoisk/${id}?include=images`)
    } catch (error) {
      if (error.upstreamStatus === 404) return { data: null, partial: false }
      throw error
    }
    if (Number(title?.id?.kinopoisk) !== Number(id))
      throw upstreamError('Invalid Kino API response', 'schema')
    const type = contentType(title.type)
    // The docs give an IMDb ID as the example for this method; TMDB is the catalogue's own key.
    const similarId = IMDB_ID.test(title.id.imdb) ? title.id.imdb : positive(title.id.tmdb)
    let similar = []
    let partial = false
    if (type && similarId) {
      try {
        similar = await get(`/titles/${type}/${similarId}/similar?limit=12`)
        if (!Array.isArray(similar)) throw upstreamError('Invalid Kino API response', 'schema')
      } catch (error) {
        // Rate limiting and a rejected key concern the whole key, not this block.
        if ([401, 403, 429].includes(error.upstreamStatus)) throw error
        // Do not log the error itself: transport errors may contain credentials.
        console.error(
          JSON.stringify({
            event: 'kinoapi_similar_error',
            reason: error.reason || 'connection',
            upstreamStatus: error.upstreamStatus
          })
        )
        similar = []
        partial = true
      }
    }
    return { data: toMovieExtras(title, similar), partial }
  } catch (error) {
    if (controller.signal.aborted) throw upstreamError('Kino API upstream timeout', 'timeout')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function serveMovieExtras(
  resource,
  url,
  headers,
  cache,
  key,
  budget = async () => null,
  fetchImpl = fetch
) {
  const started = Date.now()
  delete headers['X-Search-Transport']
  delete headers['X-Kinobox-Transport']
  headers['X-Data-Source'] = 'kinoapi'
  const respond = (body, status, state, retryAfter) => {
    logPublicCache('extras', state, started, status)
    return new Response(body, {
      status,
      headers: {
        ...headers,
        'X-Extras-Cache': state,
        ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {})
      }
    })
  }
  const unavailable = (state) =>
    respond(JSON.stringify({ error: 'Extras temporarily unavailable' }), 503, state, RETRY_TTL)
  if (!key) return unavailable('DISABLED')

  const cacheUrl = new URL('/__kinoapi-extras', url.origin)
  cacheUrl.searchParams.set('format', FORMAT)
  cacheUrl.searchParams.set('id', resource.params.id)
  const cacheKey = cacheUrl.toString()
  const staleKey = cacheKey.replace('/__kinoapi-extras?', '/__kinoapi-extras-stale?')
  const retryKey = cacheKey.replace('/__kinoapi-extras?', '/__kinoapi-extras-retry?')
  const pauseKey = new URL('/__kinoapi-pause', url.origin).toString()
  const staleOr = async (otherwise) => {
    const stale = await cacheMatch(cache, staleKey)
    return stale ? respond(stale.body, 200, 'STALE') : otherwise()
  }

  const cached = await cacheMatch(cache, cacheKey)
  if (cached) return respond(cached.body, 200, 'HIT')
  if ((await cacheMatch(cache, pauseKey)) || (await cacheMatch(cache, retryKey)))
    return staleOr(() => unavailable('BACKOFF'))

  const busy = () => {
    const expires = leases.get(cacheKey)
    if (expires && expires > Date.now()) return true
    leases.delete(cacheKey)
    return false
  }
  // Wait with this request's own cache reads rather than another request's promise.
  for (let attempt = 0; busy() && attempt < MAX_WAITS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS))
    const filled = await cacheMatch(cache, cacheKey)
    if (filled) return respond(filled.body, 200, 'HIT')
  }
  for (const [leaseKey, expires] of leases) if (expires <= Date.now()) leases.delete(leaseKey)
  if (busy() || leases.size >= MAX_LEASES) return staleOr(() => unavailable('BUSY'))
  const lease = Date.now() + LEASE_MS
  leases.set(cacheKey, lease)

  try {
    const rejected = await budget()
    if (rejected) return await staleOr(() => rejected)
    const result = await requestMovieExtras(resource.params.id, key, fetchImpl)
    const body = JSON.stringify({ data: result.data, source: 'kinoapi' })
    const complete = Boolean(result.data) && !result.partial
    await Promise.all([
      cachePut(
        cache,
        cacheKey,
        body,
        complete ? resource.cacheTtl : result.partial ? PARTIAL_TTL : MISSING_TTL
      ),
      ...(complete ? [cachePut(cache, staleKey, body, STALE_TTL)] : [])
    ])
    return respond(body, 200, 'MISS')
  } catch (error) {
    const status = error.upstreamStatus
    const timeout = error.reason === 'timeout'
    // Never log the error text: a transport failure may quote request headers.
    console.error(
      JSON.stringify({
        event: 'kinoapi_error',
        reason: error.reason || 'connection',
        upstreamStatus: status,
        durationMs: Date.now() - started
      })
    )
    if (status === 429) await cachePut(cache, pauseKey, '{}', RATE_LIMIT_TTL)
    else if (status === 401 || status === 403) await cachePut(cache, pauseKey, '{}', AUTH_TTL)
    else await cachePut(cache, retryKey, '{}', RETRY_TTL)
    return await staleOr(() =>
      respond(
        JSON.stringify({ error: timeout ? 'Upstream timeout' : 'Extras unavailable' }),
        timeout ? 504 : 502,
        'MISS',
        RETRY_TTL
      )
    )
  } finally {
    if (leases.get(cacheKey) === lease) leases.delete(cacheKey)
  }
}
