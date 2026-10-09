// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serveKinoboxContent } from './kinobox-content.mjs'
import { resolveKinoboxResource } from './routes.mjs'

let time, entries, cache
const headers = {
  'X-Worker-Version': 'test',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://reyhoho.fun'
}
const upstream = (status = 200, data = { data: { movie: { id: 301 } } }) => ({
  status,
  headers: {},
  body: Buffer.from(JSON.stringify(data)),
  tls: { selectedAlpn: 'h2', version: 'TLS1.3' }
})
const serve = (load, path = '/api/movies/301', h = headers) => {
  const url = new URL(path, 'https://api.reyhoho.fun')
  return serveKinoboxContent(resolveKinoboxResource(url), url, h, cache, load)
}
beforeEach(() => {
  time = 0
  vi.spyOn(Date, 'now').mockImplementation(() => time)
  entries = new Map()
  cache = {
    match: vi.fn(async (key) => {
      const e = entries.get(key)
      return e && e.expires > time ? e.response.clone() : undefined
    }),
    put: vi.fn(async (key, response) =>
      entries.set(key, {
        response,
        expires: time + Number(response.headers.get('Cache-Control').split('=')[1]) * 1000
      })
    )
  }
})
describe('Kinobox public caching', () => {
  it('serves MISS then HIT with request-specific CORS and no public client cache', async () => {
    const load = vi.fn(async () => upstream())
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('MISS')
    const hit = await serve(load, '/api/movies/301', {
      ...headers,
      'Access-Control-Allow-Origin': 'https://www.reyhoho.fun'
    })
    expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(hit.headers.get('Cache-Control')).toBe('no-store')
    expect(hit.headers.get('Access-Control-Allow-Origin')).toBe('https://www.reyhoho.fun')
    expect(load).toHaveBeenCalledTimes(1)
  })
  it.each([429, 500, 503])(
    'serves last good card on %s with a short retry backoff',
    async (status) => {
      const load = vi.fn().mockResolvedValueOnce(upstream()).mockResolvedValue(upstream(status))
      await serve(load)
      time = 21600 * 1000 + 1
      const stale = await serve(load)
      expect(stale.headers.get('X-Kinobox-Cache')).toBe('STALE')
      expect(await stale.json()).toEqual({ data: { movie: { id: 301 } } })
      expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('STALE')
      expect(load).toHaveBeenCalledTimes(2)
      time += 31000
      await serve(load)
      expect(load).toHaveBeenCalledTimes(3)
    }
  )
  it('bounds stale age and never caches an error as movie data', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(upstream())
      .mockRejectedValue(new Error('TCP timeout'))
    await serve(load)
    time = 48 * 3600 * 1000 + 1
    expect((await serve(load)).status).toBe(504)
    expect((await serve(load)).status).toBe(503)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('does not mask a definitive 404 or invalid JSON using stale data', async () => {
    const load = vi.fn().mockResolvedValueOnce(upstream()).mockResolvedValue(upstream(404))
    await serve(load)
    time = 21600 * 1000 + 1
    expect((await serve(load)).status).toBe(404)
    load.mockResolvedValue(upstream(200, {}))
    expect((await serve(load)).status).toBe(502)
  })
  it('collapses simultaneous cold requests in one isolate without sharing I/O promises', async () => {
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return upstream()
    })
    const replies = await Promise.all([serve(load), serve(load), serve(load)])
    expect(replies.map((r) => r.headers.get('X-Kinobox-Cache')).sort()).toEqual([
      'HIT',
      'HIT',
      'MISS'
    ])
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('continues to use the provider when the cache is unavailable', async () => {
    cache.match.mockRejectedValue(new Error('cache unavailable'))
    cache.put.mockRejectedValue(new Error('cache unavailable'))
    expect((await serve(async () => upstream())).status).toBe(200)
  })
})
