// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { serveHistory } from './history.mjs'
import { privateReply } from './private-api.mjs'
import { resolveKinopoiskTop } from './kinopoisk-top.mjs'
import { resolveKinoboxResource } from './routes.mjs'
import { resolveMovieExtras, serveMovieExtras } from './kinoapi.mjs'
import { publicUpstreamBudget } from './public-budget.mjs'

// Exercise the real entrypoint's CORS gate without opening Cloudflare sockets.
const source = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace('export default {', 'globalThis.worker = {')
const cachedExtras = '{"data":null,"source":"kinoapi"}'
const context = vm.createContext({
  Request,
  Response,
  URL,
  Set,
  serveHistory,
  resolveKinopoiskTop,
  resolveKinoboxResource,
  resolveMovieExtras,
  serveMovieExtras,
  publicUpstreamBudget,
  caches: {
    default: {
      match: async (key) => (key.includes('/__kinoapi-extras?') ? new Response(cachedExtras) : null)
    }
  }
})
vm.runInContext(source, context)
const worker = context.worker

describe('Worker movie extras route', () => {
  const get = (path, env = {}) =>
    worker.fetch(new Request('https://api.reyhoho.fun' + path), env, {})
  it('stays disabled until the Kino API secret is configured', async () => {
    const response = await get('/api/movies/301/extras')
    expect(response.status).toBe(503)
    expect(response.headers.get('X-Extras-Cache')).toBe('DISABLED')
  })
  it('serves extras once the KinoapiLampac secret is present', async () => {
    const response = await get('/api/movies/301/extras', { KinoapiLampac: 'test-key-value' })
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Extras-Cache')).toBe('HIT')
    expect(await response.text()).toBe(cachedExtras)
  })
  it('validates the Kinopoisk ID before any lookup', async () => {
    expect((await get('/api/movies/abc/extras', { KinoapiLampac: 'k' })).status).toBe(400)
  })
})

describe('Worker custom domain origins', () => {
  it('routes authenticated history separately without opening the Kinobox transport', async () => {
    const request = new Request('https://api.reyhoho.fun/api/history', {
      method: 'OPTIONS',
      headers: { Origin: 'https://reyhoho.fun' }
    })
    const preflight = await worker.fetch(request, {}, {})
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('DELETE')
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect(preflight.headers.get('X-Kinobox-Transport')).toBeNull()
    expect(preflight.headers.get('Access-Control-Max-Age')).toBe('600')
    const response = await worker.fetch(new Request(request.url), {}, {})
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it.each([
    'https://reyhoho.fun',
    'https://www.reyhoho.fun',
    'http://reyhoho.fun',
    'http://www.reyhoho.fun',
    'https://dav2010id.github.io',
    'http://127.0.0.1:5173',
    'http://localhost:5173'
  ])('accepts preflight from %s with the exact origin', async (origin) => {
    const response = await worker.fetch(
      new Request('https://proxy.example/api/movies/301', {
        method: 'OPTIONS',
        headers: { Origin: origin }
      }),
      {},
      {}
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(response.headers.get('Vary')).toBe('Origin')
    expect(response.headers.get('Access-Control-Max-Age')).toBe('600')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each(['https://reyhoho.fun.evil.example', 'https://evil.example'])(
    'rejects unrelated origin %s',
    async (origin) => {
      const response = await worker.fetch(
        new Request('https://proxy.example/api/movies/301', {
          headers: { Origin: origin }
        }),
        {},
        {}
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Origin not allowed' })
    }
  )
  it('caches only preflight permission, not private account or auth responses', () => {
    const response = privateReply('https://reyhoho.fun')(null, 204)
    expect(response.headers.get('Access-Control-Max-Age')).toBe('600')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })
})
