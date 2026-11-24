import { connect } from 'cloudflare:sockets'
import { resolveKinoboxResource } from './routes.mjs'
import { serveKinoboxContent } from './kinobox-content.mjs'
import { requestContent, requestKinopoiskContent } from './kinopoisk-content.mjs'
import { guardUpstream } from './upstream-guard.mjs'
import { resolveKinopoiskTop, serveKinopoiskTop } from './kinopoisk-top.mjs'
import { serveHistory } from './history.mjs'
import { serveTelegramAuth, cleanupAuth } from './telegram-auth.mjs'
import { serveAccount } from './account.mjs'
import { publicUpstreamBudget } from './public-budget.mjs'
import { serveCspReport } from './csp-report.mjs'
import { serveHealth } from './health.mjs'
import {
  resolveLatestReleases,
  resolveMovieExtras,
  serveLatestReleases,
  serveMovieExtras
} from './kinoapi.mjs'

const VERSION = 'kinopoisk-content-2026-11-01'
const ALLOWED = new Set([
  'https://reyhoho.fun',
  'https://www.reyhoho.fun',
  'http://reyhoho.fun',
  'http://www.reyhoho.fun',
  'https://dav2010id.github.io'
])
// A local Vite dev server is trusted only by Workers that opt in (staging/local).
const DEV_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173'])
const allowedOrigin = (origin, env) =>
  ALLOWED.has(origin) || (env?.ALLOW_DEV_ORIGINS === 'true' && DEV_ORIGINS.has(origin))

// The vendored TLS 1.3/HTTP2 stack (~0.5 MB) is evaluated only when a request
// actually goes to Kinobox, never for account, history or cached routes.
let kinoboxHttp2
const loadKinoboxHttp2 = () => (kinoboxHttp2 ||= import('./kinobox-http2-vendored.mjs'))

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
      'Access-Control-Allow-Origin': allowedOrigin(origin, env) ? origin : 'https://reyhoho.fun',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Access-Control-Expose-Headers':
        'X-Search-Transport, X-Worker-Version, X-Search-Cache, X-Kinobox-Transport, X-Kinobox-Cache, X-Top-Cache, X-Extras-Cache, X-Latest-Cache, X-Data-Source',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      // Transport/source headers are set only by the code path that actually served
      // the body (see requestContent and the cache entries), never as a default.
      'X-Worker-Version': VERSION
    }
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })
    // Browsers post CSP reports cross-origin with their own preflight.
    if (new URL(request.url).pathname === '/api/csp-report')
      return serveCspReport(request, allowedOrigin(origin, env), env)
    if (origin && !allowedOrigin(origin, env)) return reply({ error: 'Origin not allowed' }, 403)
    const privatePath = new URL(request.url).pathname
    if (privatePath.startsWith('/api/auth/')) return serveTelegramAuth(request, env, origin, ctx)
    if (
      /^\/api\/(?:user(?:\/|$)|list(?:-status)?\/|user-list(?:-counters)?\/|notifications(?:\/|$))/.test(
        privatePath
      )
    )
      return serveAccount(request, env, origin)
    if (/^\/api\/history(?:\/|$)/.test(new URL(request.url).pathname))
      return serveHistory(request, env, origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405)
    const url = new URL(request.url)
    if (url.pathname === '/api/health') return serveHealth(env, headers, VERSION)
    const resource =
      resolveKinopoiskTop(url) ||
      resolveMovieExtras(url) ||
      resolveLatestReleases(url) ||
      resolveKinoboxResource(url)
    if (resource.error) return reply({ error: resource.error }, resource.status)
    const budget = publicUpstreamBudget(request, env, headers)
    if (resource.kind === 'extras')
      return serveMovieExtras(resource, url, headers, caches.default, env.KinoapiLampac, budget)
    if (resource.kind === 'latest')
      return serveLatestReleases(resource, url, headers, caches.default, env.KinoapiLampac, budget)
    if (resource.kind === 'top')
      return serveKinopoiskTop(resource, url, headers, ctx, caches.default, budget)
    return serveKinoboxContent(
      resource,
      url,
      headers,
      caches.default,
      (options, transportOptions) =>
        requestContent(
          options,
          transportOptions,
          headers,
          (o, t) =>
            guardUpstream('kinobox', env, async () =>
              (await loadKinoboxHttp2()).requestKinoboxHttp2(o, openTransport, t)
            ),
          (o, t) => guardUpstream('kinopoisk', env, () => requestKinopoiskContent(o, t))
        ),
      budget
    )
  }
}
