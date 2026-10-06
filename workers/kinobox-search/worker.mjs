import { connect } from 'cloudflare:sockets'
import { requestKinoboxHttp2 } from './kinobox-http2-vendored.mjs'

const VERSION = 'kinobox-h2-2026-10-05'
const ALLOWED = new Set(['https://dav2010id.github.io', 'http://127.0.0.1:5173'])

async function openTransport(hostname, port) {
  const socket = connect({ hostname, port }, { secureTransport: 'off' })
  // TLS is applied by the verified TLS 1.3 client, not disabled.
  let timeout
  try {
    await Promise.race([
      socket.opened,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('TCP connect timeout')), 5000) })
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
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin')
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://dav2010id.github.io',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-Search-Transport, X-Worker-Version, X-Search-Cache',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
      'X-Search-Transport': 'h2',
      'X-Worker-Version': VERSION
    }
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers })
    if (origin && !ALLOWED.has(origin)) return reply({ error: 'Origin not allowed' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405)
    const url = new URL(request.url)
    if (!['/', '/api/movies/search/'].includes(url.pathname)) return reply({ error: 'Not found' }, 404)
    const query = (url.searchParams.get('query') || '').trim()
    if (!query || query.length > 150) return reply({ error: 'Invalid query' }, 400)
    const cacheUrl = new URL('/__search-cache', url.origin)
    cacheUrl.searchParams.set('query', query.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('ru'))
    cacheUrl.searchParams.set('version', VERSION)
    const cache = caches.default
    const cached = await cache.match(cacheUrl.toString())
    if (cached) {
      headers['X-Search-Cache'] = 'HIT'
      return new Response(cached.body, { status: 200, headers })
    }
    const started = Date.now()
    try {
      const response = await requestKinoboxHttp2(query, openTransport)
      console.log(JSON.stringify({
        event: 'kinobox_search', status: response.status, protocol: response.tls.selectedAlpn,
        tls: response.tls.version, durationMs: Date.now() - started
      }))
      if (response.status !== 200) return reply({ error: 'Upstream HTTP error', upstreamStatus: response.status }, 502)
      const encoding = response.headers['content-encoding']
      if (encoding && encoding !== 'identity') return reply({ error: 'Unexpected upstream encoding' }, 502)
      let data
      try { data = JSON.parse(response.body.toString('utf8')) }
      catch { return reply({ error: 'Invalid upstream JSON' }, 502) }
      if (!Array.isArray(data?.data?.items)) return reply({ error: 'Unexpected upstream schema' }, 502)
      const body = JSON.stringify(data)
      ctx.waitUntil(cache.put(cacheUrl.toString(), new Response(body, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
      })).catch(error => console.error(JSON.stringify({ event: 'cache_error', message: error.message }))))
      headers['X-Search-Cache'] = 'MISS'
      return new Response(body, { status: 200, headers })
    } catch (error) {
      console.error(JSON.stringify({ event: 'kinobox_error', message: error.message, durationMs: Date.now() - started }))
      return reply({ error: /timeout/i.test(error.message) ? 'Upstream timeout' : 'Upstream connection failed' },
        /timeout/i.test(error.message) ? 504 : 502)
    }
  }
}
