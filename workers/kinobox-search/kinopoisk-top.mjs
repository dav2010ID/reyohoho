import { logPublicCache, cacheMatch, cachePut } from './public-cache.mjs'
import { KINOPOISK_TOP_QUERY } from './kinopoisk-top-query.mjs'

const ENDPOINT = 'https://graphql.kinopoisk.ru/graphql/?operationName=MovieDesktopListPage'
const MAX_BYTES = 1024 * 1024
const LISTS = { movie: 'top250', series: 'series-top250' }
const inFlight = new Map()
const LEASE_MS = 20_000
// At most 40 polling reads per 20-second lease, leaving room for the
// initial cache read, upstream fetch and write on Workers Free (50 calls).
const WAIT_MS = 1000
const MAX_IN_FLIGHT = 256
const upstreamError = (message, reason, upstreamStatus) =>
  Object.assign(new Error(message), { reason, upstreamStatus })

export function resolveKinopoiskTop(url) {
  if (url.pathname !== '/api/kinopoisk/top') return null
  const type = url.searchParams.get('type') || 'movie'
  const page = url.searchParams.get('page') || '1'
  const limit = url.searchParams.get('limit') || '36'
  if (
    !Object.hasOwn(LISTS, type) ||
    !/^[1-9]\d{0,2}$/.test(page) ||
    !/^[1-9]\d?$/.test(limit) ||
    Number(limit) > 50 ||
    (Number(page) - 1) * Number(limit) >= 250
  ) {
    return { error: 'Invalid top parameters', status: 400 }
  }
  return {
    kind: 'top',
    path: url.pathname,
    params: { type, page, limit },
    cacheTtl: 3600
  }
}

export async function requestKinopoiskTop(resource, fetchImpl = fetch, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let reader
  try {
    const { type, page, limit } = resource.params
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      // Never follow an upstream redirect to login, CAPTCHA or a different host.
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'service-id': '25',
        Origin: 'https://www.kinopoisk.ru',
        Referer: 'https://www.kinopoisk.ru/',
        'x-preferred-language': 'ru'
      },
      body: JSON.stringify({
        operationName: 'MovieDesktopListPage',
        query: KINOPOISK_TOP_QUERY,
        variables: {
          slug: LISTS[type],
          platform: 'DESKTOP',
          withUserData: false,
          supportedFilterTypes: [],
          filters: null,
          singleSelectFiltersLimit: 50,
          singleSelectFiltersOffset: 0,
          moviesLimit: Number(limit),
          moviesOffset: (Number(page) - 1) * Number(limit)
        }
      })
    })
    if (!response.ok)
      throw upstreamError('Kinopoisk upstream HTTP ' + response.status, 'http', response.status)
    if (!response.body) throw upstreamError('Empty Kinopoisk response', 'empty')
    reader = response.body.getReader()
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
    const data = JSON.parse(new TextDecoder().decode(bytes))
    const list = data?.data?.movieListBySlug
    const items = list?.movies?.items
    if (data?.errors?.length) throw upstreamError('Invalid Kinopoisk top response', 'graphql')
    if (
      !Array.isArray(items) ||
      !Number.isInteger(list?.movies?.total) ||
      list.movies.total < 1 ||
      list.movies.total > 250 ||
      items.length > Number(limit) ||
      items.some((item) => !Number.isInteger(item?.movie?.id) || item.movie.id < 1)
    ) {
      throw upstreamError('Invalid Kinopoisk top response', 'schema')
    }
    // Forward only public card data, not the origin's user/advertising fields.
    return {
      data: {
        total: list.movies.total,
        name: list.name,
        items: items.map(({ movie, position }) => ({
          position,
          movie: {
            id: movie.id,
            type: movie.__typename,
            title: movie.title,
            gallery: { posterUrl: movie.gallery?.posters?.vertical?.avatarsUrl },
            rating: { kinopoisk: movie.rating?.kinopoisk },
            year: movie.productionYear || movie.releaseYears?.start,
            duration: movie.duration,
            countries: movie.countries,
            genres: movie.genres
          }
        }))
      },
      source: 'kinopoisk'
    }
  } catch (error) {
    if (controller.signal.aborted) throw upstreamError('Kinopoisk upstream timeout', 'timeout')
    throw error
  } finally {
    clearTimeout(timeout)
    if (reader) await reader.cancel().catch(() => {})
  }
}

export async function serveKinopoiskTop(
  resource,
  url,
  headers,
  ctx,
  cache,
  budget = async () => null,
  // Shared per-upstream protection (upstream-guard.mjs), as for the cards.
  guard = (run) => run()
) {
  const started = Date.now()
  delete headers['X-Search-Transport']
  delete headers['X-Kinobox-Transport']
  headers['X-Data-Source'] = 'kinopoisk'
  const cacheUrl = new URL('/__kinopoisk-top-cache', url.origin)
  cacheUrl.searchParams.set('version', headers['X-Worker-Version'])
  for (const [key, value] of Object.entries(resource.params)) {
    cacheUrl.searchParams.set(key, value)
  }
  const cached = await cacheMatch(cache, cacheUrl.toString())
  if (cached) {
    headers['X-Top-Cache'] = 'HIT'
    logPublicCache('top', 'HIT', started)
    return new Response(cached.body, { headers })
  }
  const key = cacheUrl.toString()
  const retryKey = key.replace('/__kinopoisk-top-cache', '/__kinopoisk-top-retry')
  const backoff = () =>
    new Response(JSON.stringify({ error: 'Kinopoisk top temporarily unavailable' }), {
      status: 503,
      headers: { ...headers, 'X-Top-Cache': 'BACKOFF', 'Retry-After': '30' }
    })
  if (await cacheMatch(cache, retryKey)) return backoff()
  const deadline = Date.now() + LEASE_MS
  let activeLease
  while (true) {
    for (const [leaseKey, lease] of inFlight) {
      if (lease.expires <= Date.now()) inFlight.delete(leaseKey)
    }
    const current = inFlight.get(key)
    if (!current) {
      if (inFlight.size >= MAX_IN_FLIGHT) {
        headers['X-Top-Cache'] = 'CAPACITY'
        logPublicCache('top', 'CAPACITY', started, 503)
        return new Response(JSON.stringify({ error: 'Kinopoisk top temporarily busy' }), {
          status: 503,
          headers
        })
      }
      const lease = { expires: Date.now() + LEASE_MS }
      inFlight.set(key, lease)
      activeLease = lease
      break
    }
    if (Date.now() >= deadline) {
      headers['X-Top-Cache'] = 'WAIT_TIMEOUT'
      logPublicCache('top', 'WAIT_TIMEOUT', started, 503)
      return new Response(JSON.stringify({ error: 'Kinopoisk top temporarily busy' }), {
        status: 503,
        headers
      })
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS))
    if (await cacheMatch(cache, retryKey)) return backoff()
    const filled = await cacheMatch(cache, key)
    if (filled) {
      headers['X-Top-Cache'] = 'HIT'
      logPublicCache('top', 'HIT', started)
      return new Response(filled.body, { headers })
    }
  }
  try {
    const rejected = await budget()
    if (rejected) return rejected
    const data = await guard(() => requestKinopoiskTop(resource))
    const body = JSON.stringify(data)
    await cachePut(cache, key, body, resource.cacheTtl)
    headers['X-Top-Cache'] = 'MISS'
    logPublicCache('top', 'MISS', started)
    console.log(
      JSON.stringify({
        event: 'kinopoisk_top',
        type: resource.params.type,
        count: data.data.items.length
      })
    )
    return new Response(body, { headers })
  } catch (error) {
    await cachePut(cache, retryKey, '{}', 30)
    headers['Retry-After'] = '30'
    const timeout = /timeout/i.test(error.message)
    logPublicCache('top', 'MISS', started, timeout ? 504 : 502)
    console.error(
      JSON.stringify({
        event: 'kinopoisk_top_error',
        reason: error.reason || (error instanceof SyntaxError ? 'json' : 'connection'),
        upstreamStatus: error.upstreamStatus,
        durationMs: Date.now() - started
      })
    )
    return new Response(
      JSON.stringify({ error: timeout ? 'Upstream timeout' : 'Kinopoisk top unavailable' }),
      { status: timeout ? 504 : 502, headers }
    )
  } finally {
    if (inFlight.get(key) === activeLease) inFlight.delete(key)
  }
}
