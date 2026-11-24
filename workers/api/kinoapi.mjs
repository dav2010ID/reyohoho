import { cacheMatch, cachePut, logPublicCache } from './public-cache.mjs'

// Optional card extras from the Kino API catalogue. The API key is one shared
// budget for the whole site, so answers are cached hard and failures back off.
const BASE = 'https://kinoapi.lampac.dev/api/v1'
const MAX_BYTES = 1024 * 1024
// Bump to drop cached extras after changing their shape.
const FORMAT = '3'
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

// Latest releases for the home shelf. One shared list, so one cache entry per limit.
export function resolveLatestReleases(url) {
  if (url.pathname !== '/api/kinoapi/latest') return null
  const limit = url.searchParams.get('limit') || '24'
  if (!/^(?:[1-9]|[1-4]\d|50)$/.test(limit))
    return { error: 'Invalid latest parameters', status: 400 }
  // "list" is part of the cache key: answers built from /titles/latest are not reused.
  return { kind: 'latest', params: { limit, list: 'popular-recent' }, cacheTtl: 3600 }
}

const TMDB_POSTER = /^https:\/\/image\.tmdb\.org\/t\/p\/original(\/[\w-]+\.(?:jpe?g|png|webp))$/
const tenPoint = (rating) =>
  typeof rating?.value === 'number' && rating.value > 0 && rating.value <= 10
    ? rating.value
    : undefined
const names = (list) =>
  Array.isArray(list)
    ? list
        .map((name) => text(name, 100))
        .filter(Boolean)
        .slice(0, 5)
    : []

// Only titles with their own Kinopoisk page: the site opens everything by Kinopoisk ID.
export function toLatestReleases(items) {
  const seen = new Set()
  const releases = []
  for (const item of Array.isArray(items) ? items : []) {
    const kinopoiskId = positive(item?.id?.kinopoisk)
    const title = {
      russian: text(item?.title?.ru, 300),
      original: text(item?.title?.original, 300)
    }
    if (!kinopoiskId || seen.has(kinopoiskId) || !(title.russian || title.original)) continue
    seen.add(kinopoiskId)
    const poster = TMDB_POSTER.exec(item?.images?.poster)?.[1]
    releases.push({
      kinopoiskId,
      type: contentType(item.type),
      title,
      year: positive(item.release?.year),
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(item?.release?.date) ? item.release.date : undefined,
      // TMDB's 342px rendition: "original" posters are several megabytes.
      posterUrl: poster ? `https://image.tmdb.org/t/p/w342${poster}` : undefined,
      rating: {
        kinopoisk: tenPoint(item?.ratings?.kinopoisk),
        imdb: tenPoint(item?.ratings?.imdb)
      },
      genres: names(item?.genres),
      countries: names(item?.countries)
    })
  }
  return releases
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

const kinoGet = async (path, key, fetchImpl, signal) => {
  const response = await fetchImpl(BASE + path, {
    // Never follow an upstream redirect: it would carry the key to another host.
    redirect: 'manual',
    signal,
    headers: { Accept: 'application/json', 'X-API-Key': key }
  })
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {})
    throw upstreamError('Kino API upstream HTTP ' + response.status, 'http', response.status)
  }
  return (await readBoundedJson(response))?.data
}

// The catalogue's own /titles/latest starts with far-future placeholders (2099-12-31) that
// have no Kinopoisk ID yet. So the shelf takes this and last year's most popular titles and
// keeps the ones already out, newest release first.
export const latestCatalogPath = (now = new Date()) => {
  const year = now.getUTCFullYear()
  return `/titles?yearFrom=${year - 1}&yearTo=${year}&sort=popularity&order=desc&limit=100`
}

export async function requestLatestReleases(
  limit,
  key,
  fetchImpl = fetch,
  timeoutMs = 10000,
  now = new Date()
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const items = await kinoGet(latestCatalogPath(now), key, fetchImpl, controller.signal)
    if (!Array.isArray(items)) throw upstreamError('Invalid Kino API response', 'schema')
    const today = now.toISOString().slice(0, 10)
    const releases = toLatestReleases(items)
      .filter((item) => item.releaseDate && item.releaseDate <= today)
      .sort((a, b) => (a.releaseDate < b.releaseDate ? 1 : a.releaseDate > b.releaseDate ? -1 : 0))
      .slice(0, Number(limit))
    return { data: releases.length ? { items: releases } : null, partial: false }
  } catch (error) {
    if (controller.signal.aborted) throw upstreamError('Kino API upstream timeout', 'timeout')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestMovieExtras(id, key, fetchImpl = fetch, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const get = (path) => kinoGet(path, key, fetchImpl, controller.signal)
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
    // The live similar endpoint rejects IMDb IDs with HTTP 400 despite its docs.
    const similarId = positive(title.id.tmdb) || (IMDB_ID.test(title.id.imdb) && title.id.imdb)
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

// One cached Kino API answer: fresh copy, stale fallback, per-entry retry backoff and a
// key-wide pause on rate limiting or a rejected key.
async function serveKinoapiCached(
  { kind, cachePath, cacheHeader, label, load, resource },
  url,
  headers,
  cache,
  key,
  budget
) {
  const started = Date.now()
  headers['X-Data-Source'] = 'kinoapi'
  const respond = (body, status, state, retryAfter) => {
    logPublicCache(kind, state, started, status)
    return new Response(body, {
      status,
      headers: {
        ...headers,
        [cacheHeader]: state,
        ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {})
      }
    })
  }
  const unavailable = (state) =>
    respond(JSON.stringify({ error: `${label} temporarily unavailable` }), 503, state, RETRY_TTL)
  if (!key) return unavailable('DISABLED')

  const cacheUrl = new URL(cachePath, url.origin)
  cacheUrl.searchParams.set('format', FORMAT)
  for (const [name, value] of Object.entries(resource.params))
    cacheUrl.searchParams.set(name, value)
  const cacheKey = cacheUrl.toString()
  const staleKey = cacheKey.replace(`${cachePath}?`, `${cachePath}-stale?`)
  const retryKey = cacheKey.replace(`${cachePath}?`, `${cachePath}-retry?`)
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
    const result = await load()
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
        kind,
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
        JSON.stringify({ error: timeout ? 'Upstream timeout' : `${label} unavailable` }),
        timeout ? 504 : 502,
        'MISS',
        RETRY_TTL
      )
    )
  } finally {
    if (leases.get(cacheKey) === lease) leases.delete(cacheKey)
  }
}

export function serveMovieExtras(
  resource,
  url,
  headers,
  cache,
  key,
  budget = async () => null,
  fetchImpl = fetch
) {
  return serveKinoapiCached(
    {
      kind: 'extras',
      cachePath: '/__kinoapi-extras',
      cacheHeader: 'X-Extras-Cache',
      label: 'Extras',
      resource,
      load: () => requestMovieExtras(resource.params.id, key, fetchImpl)
    },
    url,
    headers,
    cache,
    key,
    budget
  )
}

export function serveLatestReleases(
  resource,
  url,
  headers,
  cache,
  key,
  budget = async () => null,
  fetchImpl = fetch
) {
  return serveKinoapiCached(
    {
      kind: 'latest',
      cachePath: '/__kinoapi-latest',
      cacheHeader: 'X-Latest-Cache',
      label: 'Latest releases',
      resource,
      load: () => requestLatestReleases(resource.params.limit, key, fetchImpl)
    },
    url,
    headers,
    cache,
    key,
    budget
  )
}
