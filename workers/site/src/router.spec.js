// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { routeSite } from './router.mjs'

const meta = {
  headers: { 'X-Frame-Options': 'DENY', 'Content-Security-Policy-Report-Only': "default-src 'self'" },
  movies: { 301: '/movie/301/the-matrix/' }
}
const env = {
  ASSETS: {
    fetch: vi.fn(async (request) =>
      new URL(request.url).pathname === '/'
        ? new Response(request.method === 'HEAD' ? null : '<!doctype html><div id="app"></div>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"home"' }
          })
        : new Response('missing', { status: 404 })
    )
  }
}
const get = (path, init) => routeSite(new Request('https://reyhoho.fun' + path, init), env, meta)

describe('site routing after an asset miss', () => {
  it.each(['/movie/301', '/movie/301/', '/movie/301/old-slug/', '/movie/301/old-slug'])(
    'sends catalogued %s to its canonical page with one 301',
    async (path) => {
      const response = await get(path + '?from=share')
      expect(response.status).toBe(301)
      expect(response.headers.get('Location')).toBe(
        'https://reyhoho.fun/movie/301/the-matrix/?from=share'
      )
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    }
  )
  it.each(['/movie/123456789', '/movie/123456789/some-title/', '/lists', '/lists/42'])(
    'serves the app shell for %s with 200 and noindex',
    async (path) => {
      const response = await get(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
      expect(response.headers.get('Content-Type')).toContain('text/html')
      expect(response.headers.get('Content-Security-Policy-Report-Only')).toBe("default-src 'self'")
      expect(await response.text()).toContain('id="app"')
    }
  )
  it.each(['/shiki/123', '/movie/shiki123/title', '/movie/0', '/movie/bad', '/no-such-page'])(
    'answers %s with a real 404 that still renders the app',
    async (path) => {
      const response = await get(path)
      expect(response.status).toBe(404)
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
      expect(await response.text()).toContain('id="app"')
    }
  )
  it('does not answer a missing script with HTML', async () => {
    const response = await get('/assets/immutable/old-chunk.js')
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })
  it('supports HEAD and rejects other methods', async () => {
    expect((await get('/lists', { method: 'HEAD' })).status).toBe(200)
    const post = await get('/lists', { method: 'POST' })
    expect(post.status).toBe(405)
    expect(post.headers.get('Allow')).toBe('GET, HEAD')
  })
})
