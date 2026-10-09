import { connect } from 'cloudflare:sockets'
import { requestKinoboxHttp2 } from './kinobox-http2-vendored.mjs'
import { resolveKinoboxResource, getKinoboxCacheUrl, isKinoboxResponseValid } from './routes.mjs'
import { resolveKinopoiskTop, serveKinopoiskTop } from './kinopoisk-top.mjs'
import { serveHistory } from './history.mjs'
import { serveTelegramAuth, cleanupAuth } from './telegram-auth.mjs'
import { serveAccount } from './account.mjs'

const VERSION = 'kinobox-content-tg-d1-2026-10-08'
const ALLOWED = new Set([
  'https://reyhoho.fun',
  'https://www.reyhoho.fun',
  'http://reyhoho.fun',
  'http://www.reyhoho.fun',
  'https://dav2010id.github.io',
  'http://127.0.0.1:5173',
  'http://localhost:5173'
])

async function openTransport(hostname, port) {
  const socket = connect({ hostname, port }, { secureTransport: 'off' })
  // TLS is applied by the verified TLS 1.3 client, not disabled.
  let timeout
  try {
    await Promise.race([
      socket.opened,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('TCP connect timeout')), 5000)
      })
    ])
  } catch (error) {
    await socket.close().catch(() => {})
    throw error
  } finally {
    clearTimeout(timeout)
  }
  return { readable: socket.readable, writable: socket.writable, close: () => socket.close() }
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanupAuth(env).catch(() => console.error('auth_cleanup_failed')))
  },
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin')
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://reyhoho.fun',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers':
        'X-Search-Transport, X-Worker-Version, X-Search-Cache, X-Kinobox-Transport, X-Kinobox-Cache, X-Top-Cache, X-Data-Source',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      'X-Search-Transport': 'h2',
      'X-Kinobox-Transport': 'h2',
      'X-Worker-Version': VERSION
    }
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })
    if (origin && !ALLOWED.has(origin)) return reply({ error: 'Origin not allowed' }, 403)
    const privatePath = new URL(request.url).pathname
    if (privatePath.startsWith('/api/auth/')) return serveTelegramAuth(request, env, origin)
    if (/^\/api\/(?:user(?:\/|$)|list(?:-status)?\/|user-list(?:-counters)?\/|notifications(?:\/|$))/.test(privatePath))
      return serveAccount(request, env, origin)
    if (/^\/api\/history(?:\/|$)/.test(new URL(request.url).pathname))
      return serveHistory(request, env, origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405)
    const url = new URL(request.url)
    const resource = resolveKinopoiskTop(url) || resolveKinoboxResource(url)
    if (resource.error) return reply({ error: resource.error }, resource.status)
    if (resource.kind === 'top')
      return serveKinopoiskTop(resource, url, headers, ctx, caches.default)
    const cacheUrl = getKinoboxCacheUrl(url.origin, resource, VERSION)
    const cache = caches.default
    const cached = await cache.match(cacheUrl)
    if (cached) {
      headers['X-Search-Cache'] = 'HIT'
      headers['X-Kinobox-Cache'] = 'HIT'
      return new Response(cached.body, { status: 200, headers })
    }
    const started = Date.now()
    try {
      const response = await requestKinoboxHttp2(
        {
          path: resource.path,
          params: {
            ...resource.params,
            ...(resource.kind !== 'players' ? { ts: Math.floor(Date.now() / 1000) } : {})
          }
        },
        openTransport
      )
      console.log(
        JSON.stringify({
          event: 'kinobox_response',
          kind: resource.kind,
          status: response.status,
          protocol: response.tls.selectedAlpn,
          tls: response.tls.version,
          durationMs: Date.now() - started
        })
      )
      if (response.status !== 200)
        return reply(
          { error: 'Upstream HTTP error', upstreamStatus: response.status },
          response.status === 404 ? 404 : 502
        )
      const encoding = response.headers['content-encoding']
      if (encoding && encoding !== 'identity')
        return reply({ error: 'Unexpected upstream encoding' }, 502)
      let data
      try {
        data = JSON.parse(response.body.toString('utf8'))
      } catch {
        return reply({ error: 'Invalid upstream JSON' }, 502)
      }
      if (resource.kind === 'movie' && data?.data?.isSuccess === false) return reply(data, 404)
      if (!isKinoboxResponseValid(resource.kind, data))
        return reply({ error: 'Unexpected upstream schema' }, 502)
      const body = JSON.stringify(data)
      ctx.waitUntil(
        cache
          .put(
            cacheUrl,
            new Response(body, {
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=' + resource.cacheTtl
              }
            })
          )
          .catch((error) =>
            console.error(JSON.stringify({ event: 'cache_error', message: error.message }))
          )
      )
      headers['X-Search-Cache'] = 'MISS'
      headers['X-Kinobox-Cache'] = 'MISS'
      return new Response(body, { status: 200, headers })
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'kinobox_error',
          message: error.message,
          durationMs: Date.now() - started
        })
      )
      return reply(
        {
          error: /timeout/i.test(error.message) ? 'Upstream timeout' : 'Upstream connection failed'
        },
        /timeout/i.test(error.message) ? 504 : 502
      )
    }
  }
}
