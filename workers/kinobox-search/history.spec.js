// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveHistory } from './history.mjs'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('./migrations/0001_history.sql', import.meta.url), 'utf8'))
  return {
    sqlite,
    prepare(sql) {
      return { bind(...values) {
        const statement = sqlite.prepare(sql)
        return {
          all: async () => ({ results: statement.all(...values) }),
          run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
        }
      } }
    },
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    }
  }
}
const origin = 'https://reyhoho.fun'
const request = (path = '', method = 'GET', body, token = 'a') => new Request(`https://api.reyhoho.fun/api/history${path}`, {
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
})
const envFor = (db) => ({ HISTORY_DB: db, HISTORY_AUTH_USER_URL: 'https://trusted.example/user' })
afterEach(() => vi.unstubAllGlobals())

describe('private D1 history', () => {
  it('fails closed when unconfigured or anonymous; supports private preflight', async () => {
    expect((await serveHistory(request(), {}, origin)).status).toBe(503)
    expect((await serveHistory(new Request('https://api.reyhoho.fun/api/history'), envFor({}), origin)).status).toBe(401)
    const preflight = await serveHistory(request('', 'OPTIONS'), {}, origin)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect(preflight.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await serveHistory(request(), {}, 'http://reyhoho.fun')).status).toBe(403)
  })
  it('isolates users, ignores supplied identity, preserves deletion on re-import', async () => {
    const db = database()
    vi.stubGlobal('fetch', vi.fn(async (_url, options) =>
      Response.json({ id: options.headers.Authorization === 'Bearer a' ? 11 : 22 })))
    const env = envFor(db)
    expect((await serveHistory(request('/301', 'PUT', { title: 'Матрица', user_id: 22 }), env, origin)).status).toBe(200)
    expect((await (await serveHistory(request('', 'GET', undefined, 'b'), env, origin)).json()).history).toEqual([])
    const own = await (await serveHistory(request(), env, origin)).json()
    expect(own.history[0].title).toBe('Матрица')
    expect(own.history[0]).not.toHaveProperty('user_id')
    await serveHistory(request('/301', 'DELETE'), env, origin)
    const tombstone = db.sqlite.prepare('SELECT * FROM user_history').get()
    expect(tombstone.metadata).toBe('{}')
    expect(tombstone.added_at).toBe('')
    await serveHistory(request('/import', 'POST', { history: [{ kp_id: 301, title: 'old' }] }), env, origin)
    expect((await (await serveHistory(request(), env, origin)).json()).history).toEqual([])
    await serveHistory(request('/301', 'PUT', { title: 'Rewatched' }), env, origin)
    expect((await (await serveHistory(request(), env, origin)).json()).history[0].title).toBe('Rewatched')
    await serveHistory(request('', 'DELETE'), env, origin)
    expect((await (await serveHistory(request(), env, origin)).json()).history).toEqual([])
    db.sqlite.close()
  })
  it('enforces the account capacity atomically and keeps the counter stable on upsert', async () => {
    const db = database()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 11 })))
    const env = envFor(db)
    await serveHistory(request('/301', 'PUT', { title: 'First' }), env, origin)
    await serveHistory(request('/301', 'PUT', { title: 'Second' }), env, origin)
    expect(db.sqlite.prepare('SELECT item_count FROM history_quota').get().item_count).toBe(1)
    db.sqlite.exec('UPDATE history_quota SET item_count = 5000')
    const response = await serveHistory(request('/import', 'POST', {
      history: [{ kp_id: 42 }, { kp_id: 43 }]
    }), env, origin)
    expect(response.status).toBe(409)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM user_history').get().n).toBe(1)
    expect((await serveHistory(request('/301', 'PUT', { title: 'Existing' }), env, origin)).status).toBe(200)
    db.sqlite.close()
  })
  it('rejects invalid authority, unauthorized tokens, oversized bodies and imports', async () => {
    const env = envFor({})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    expect((await serveHistory(request(), env, origin)).status).toBe(401)
    expect((await serveHistory(request(), { ...env, HISTORY_AUTH_USER_URL: 'http://evil/user' }, origin)).status).toBe(503)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 11 })))
    expect((await serveHistory(request('/301', 'PUT', { title: 'x'.repeat(9000) }), env, origin)).status).toBe(400)
    expect((await serveHistory(request('/import', 'POST', { history: Array(101).fill({ kp_id: 1 }) }), env, origin)).status).toBe(400)
    expect((await serveHistory(request('/bad', 'DELETE'), env, origin)).status).toBe(404)
  })
})
