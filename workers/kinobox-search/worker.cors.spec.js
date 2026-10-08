// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { serveHistory } from './history.mjs'

// Exercise the real entrypoint's CORS gate without opening Cloudflare sockets.
const source = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace('export default {', 'globalThis.worker = {')
const context = vm.createContext({ Request, Response, URL, Set, serveHistory })
vm.runInContext(source, context)
const worker = context.worker

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
})
