// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkSite } from './check-site.mjs'

const meta = { movies: { 301: '/movie/301/the-matrix/' } }
const secure = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy-Report-Only': "default-src 'self'"
}
const html = (status, extra = {}) =>
  new Response('<script src="/assets/immutable/app-1.js"></script>', {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...secure, ...extra }
  })
const redirect = (status, location) =>
  new Response(null, { status, headers: { Location: location } })

// A healthy deployment, close enough to Workers Static Assets plus workers/site.
function site(overrides = {}) {
  return async (url, init = {}) => {
    const { pathname, search, host } = new URL(url)
    const navigate = init.headers?.['Sec-Fetch-Mode'] === 'navigate'
    const custom = overrides[pathname]?.({ navigate, host })
    if (custom) return custom
    if (host.startsWith('www.')) return redirect(301, `https://reyhoho.fun${pathname}`)
    switch (pathname) {
      case '/':
      case '/movie/301/the-matrix/':
        return html(200)
      case '/movie/301/the-matrix':
        return redirect(307, '/movie/301/the-matrix/')
      case '/movie/301':
      case '/movie/301/old-slug/':
        return redirect(301, `https://reyhoho.fun/movie/301/the-matrix/${search}`)
      case '/movie/123456789':
        return html(200, { 'X-Robots-Tag': 'noindex' })
      case '/assets/immutable/app-1.js':
        return new Response('', { headers: { 'Cache-Control': 'public, immutable' } })
      case '/sw.js':
        return new Response('', { headers: { 'Cache-Control': 'no-cache' } })
      case '/robots.txt':
      case '/sitemap.xml':
      case '/manifest.webmanifest':
        return new Response('')
      default:
        return pathname.endsWith('.js')
          ? new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
          : html(404, { 'X-Robots-Tag': 'noindex' })
    }
  }
}

describe('check-site', () => {
  it('accepts a deployment that keeps the site Worker contract', async () => {
    expect(await checkSite('https://reyhoho.fun', { fetch: site(), meta, www: true })).toEqual([])
  })

  it('reports a browser navigation that never reaches the Worker', async () => {
    const errors = await checkSite('https://reyhoho.fun', {
      fetch: site({ '/movie/123456789': ({ navigate }) => navigate && html(404) }),
      meta
    })
    expect(errors).toContain('/movie/123456789 (navigate): expected 200 HTML, got 404')
  })

  it('reports a lost redirect query, a noindexed canonical page and missing headers', async () => {
    const errors = await checkSite('https://reyhoho.fun', {
      fetch: site({
        '/movie/301': () => redirect(301, 'https://reyhoho.fun/movie/301/the-matrix/'),
        '/movie/301/the-matrix/': () =>
          new Response('', {
            headers: { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex' }
          })
      }),
      meta
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        '/movie/301: the redirect dropped the query',
        '/movie/301/the-matrix/: must be indexable',
        '/movie/301/the-matrix/: no X-Frame-Options'
      ])
    )
  })

  it('allows noindex on the workers.dev address', async () => {
    const fetch = site({
      '/movie/301/the-matrix/': () => html(200, { 'X-Robots-Tag': 'noindex' })
    })
    expect(await checkSite('https://reyohoho-site.example.workers.dev', { fetch, meta })).toEqual(
      []
    )
  })
})
