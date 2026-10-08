import { describe, expect, it } from 'vitest'
import { resolveKinoboxResource, getKinoboxCacheUrl, isKinoboxResponseValid } from './routes.mjs'

const origin = 'https://api.reyhoho.fun'
const resolve = (path) => resolveKinoboxResource(new URL(path, origin))

describe('Kinobox Worker routes', () => {
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
      cacheTtl: 3600
    })
    expect(resolve('/api/movies/301/')).toEqual(resolve('/api/movies/301'))
  })
  it('forwards only supported player parameters and uses a short TTL', () => {
    expect(resolve('/api/players?kinopoisk=301&title=Матрица&url=https://evil.example')).toEqual({
      kind: 'players',
      path: '/api/players',
      params: { kinopoisk: '301', title: 'Матрица' },
      cacheTtl: 60
    })
  })
  it('rejects unsupported paths and invalid or excessive identifiers', () => {
    for (const path of [
      '/api/movies/0',
      '/api/movies/-1',
      '/api/movies/abc',
      '/api/movies/1234567890123',
      '/api/players?kinopoisk=0',
      '/api/players'
    ]) {
      expect(resolve(path).status).toBe(400)
    }
    expect(resolve('/api/movies/301/extra').status).toBe(404)
    expect(resolve('/api/unrestricted?url=https://evil.example').status).toBe(404)
  })
  it('limits search and player title lengths', () => {
    expect(resolve('/?query=').status).toBe(400)
    expect(resolve('/?query=' + 'x'.repeat(151)).status).toBe(400)
    expect(resolve('/api/players?kinopoisk=301&title=' + 'x'.repeat(301)).status).toBe(400)
  })
  it('isolates cache entries by route, ID and player title but ignores timestamps', () => {
    const key = (path) => getKinoboxCacheUrl(origin, resolve(path), 'test-version')
    expect(key('/api/movies/301?ts=1')).toBe(key('/api/movies/301?ts=2'))
    expect(key('/api/movies/301')).not.toBe(key('/api/movies/302'))
    expect(key('/api/movies/301')).not.toBe(key('/api/players?kinopoisk=301'))
    expect(key('/api/players?kinopoisk=301')).not.toBe(
      key('/api/players?kinopoisk=301&title=Матрица')
    )
  })
  it('validates each upstream envelope independently', () => {
    expect(isKinoboxResponseValid('search', { data: { items: [] } })).toBe(true)
    expect(isKinoboxResponseValid('players', { data: [] })).toBe(true)
    expect(isKinoboxResponseValid('movie', { data: { movie: { id: 301 } } })).toBe(true)
    expect(isKinoboxResponseValid('movie', { data: { movie: null } })).toBe(false)
    expect(isKinoboxResponseValid('movie', { data: { items: [] } })).toBe(false)
    expect(isKinoboxResponseValid('players', { data: { movie: {} } })).toBe(false)
  })
})
