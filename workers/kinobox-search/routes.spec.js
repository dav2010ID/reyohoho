import { describe, expect, it } from 'vitest'
import { resolveContentResource, getContentCacheUrl, isContentResponseValid } from './routes.mjs'

const origin = 'https://api.reyhoho.fun'
const resolve = (path) => resolveContentResource(new URL(path, origin))

describe('Worker content routes', () => {
  it('preserves the existing root search endpoint', () => {
    expect(resolve('/?query=Матрица&ts=1')).toMatchObject({
      kind: 'search',
      path: '/api/movies/search/',
      params: { query: 'Матрица' },
      cacheTtl: 600
    })
  })
  it('accepts movie cards with a numeric Kinopoisk ID', () => {
    expect(resolve('/api/movies/301?ts=1')).toEqual({
      kind: 'movie',
      path: '/api/movies/301',
      params: {},
      cacheTtl: 21600
    })
    expect(resolve('/api/movies/301/')).toEqual(resolve('/api/movies/301'))
  })
  it('answers the retired player list route with 410 Gone', () => {
    for (const path of ['/api/players?kinopoisk=301', '/api/players/', '/api/players'])
      expect(resolve(path)).toEqual({ error: 'Players are not served by this API', status: 410 })
  })
  it('rejects unsupported paths and invalid or excessive identifiers', () => {
    for (const path of ['/api/movies/0', '/api/movies/-1', '/api/movies/abc', '/api/movies/1234567890123']) {
      expect(resolve(path).status).toBe(400)
    }
    expect(resolve('/api/movies/301/extra').status).toBe(404)
    expect(resolve('/api/unrestricted?url=https://evil.example').status).toBe(404)
  })
  it('limits search length', () => {
    expect(resolve('/?query=').status).toBe(400)
    expect(resolve('/?query=' + 'x'.repeat(151)).status).toBe(400)
  })
  it('isolates cache entries by route and ID but ignores timestamps', () => {
    const key = (path) => getContentCacheUrl(origin, resolve(path), 'test-version')
    expect(key('/api/movies/301?ts=1')).toBe(key('/api/movies/301?ts=2'))
    expect(key('/api/movies/301')).not.toBe(key('/api/movies/302'))
    expect(key('/?query=301')).not.toBe(key('/api/movies/301'))
  })
  it('validates each upstream envelope independently', () => {
    expect(isContentResponseValid('search', { data: { items: [] } })).toBe(true)
    expect(isContentResponseValid('movie', { data: { movie: { id: 301 } } })).toBe(true)
    expect(isContentResponseValid('movie', { data: { movie: null } })).toBe(false)
    expect(isContentResponseValid('movie', { data: { items: [] } })).toBe(false)
    expect(isContentResponseValid('players', { data: [] })).toBe(false)
  })
})
