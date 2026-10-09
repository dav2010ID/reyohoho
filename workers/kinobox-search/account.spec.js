// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serveAccount } from './account.mjs'
import { sha256 } from './private-api.mjs'
import { testDatabase } from './test-db.mjs'

const origin = 'https://reyhoho.fun'
const token = `rh1_${'a'.repeat(43)}`
let db, env
beforeEach(async () => {
  db = testDatabase()
  db.sqlite.prepare('INSERT INTO tg_users(telegram_id,name) VALUES (?,?)').run('123', 'Test')
  db.sqlite
    .prepare(
      'INSERT INTO tg_sessions(token_hash,telegram_id,expires_at,created_at) VALUES (?,?,?,?)'
    )
    .run(await sha256(token), '123', Math.floor(Date.now() / 1000) + 3600, 0)
  env = {
    HISTORY_DB: db,
    TELEGRAM_AUTH_ENABLED: 'true',
    ACCOUNT_RATE_LIMITER: { limit: async () => ({ success: true }) }
  }
})
afterEach(() => db.sqlite.close())
function request(body, type = 'favorite') {
  return new Request(`https://api.reyhoho.fun/api/list/${type}/843831`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body
  })
}

describe('account list metadata writes', () => {
  it('reads only authenticated movie membership and excludes deleted history', async () => {
    const insert = db.sqlite.prepare('INSERT INTO account_lists VALUES (?,?,?,?,?)')
    for (const type of ['favorite', 'later', 'watching', 'completed', 'abandoned'])
      insert.run('worker-tg:123', type, '301', '{}', '')
    insert.run('worker-tg:999', 'favorite', '42', '{}', '')
    db.sqlite
      .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
      .run('worker-tg:123', '301', '{}', '', 0)
    db.sqlite
      .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
      .run('worker-tg:123', '42', '{}', '', 1)
    const read = (id, authorized = true) =>
      serveAccount(
        new Request(`https://api.reyhoho.fun/api/list-status/${id}`, {
          headers: authorized ? { Authorization: 'Bearer ' + token } : {}
        }),
        env,
        origin
      )
    const response = await read('301')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(await response.json()).toEqual({
      favorite: true,
      later: true,
      watching: true,
      completed: true,
      abandoned: true,
      history: true
    })
    expect(await (await read('42')).json()).toEqual({
      favorite: false,
      later: false,
      watching: false,
      completed: false,
      abandoned: false,
      history: false
    })
    expect((await read('301', false)).status).toBe(401)
  })
  it.each(['favorite', 'later', 'watching', 'completed', 'abandoned'])(
    'accepts older full-movie payloads for %s and stores only card fields',
    async (type) => {
      const metadata = {
        kp_id: '999',
        title: 'Сноуден',
        slug: 'snowden',
        year: 2016,
        type: 'FILM',
        poster: 'https://example.com/poster.jpg',
        addedAt: '2000-01-01',
        description: 'Я'.repeat(5000),
        raw_data: { private: 'omit' },
        user_id: 'other'
      }
      const body = JSON.stringify({ metadata })
      expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(8192)
      const response = await serveAccount(request(body, type), env, origin)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      const row = db.sqlite.prepare('SELECT * FROM account_lists').get()
      expect(row.user_id).toBe('worker-tg:123')
      expect(row.list_type).toBe(type)
      expect(JSON.parse(row.metadata)).toEqual({
        kp_id: '843831',
        title: 'Сноуден',
        slug: 'snowden',
        year: '2016',
        type: 'FILM',
        poster: metadata.poster,
        addedAt: row.added_at
      })
      expect(row.added_at).not.toBe(metadata.addedAt)
      expect(row.metadata.length).toBeLessThan(8192)
      // Re-adding updates the same record, not a duplicate.
      expect((await serveAccount(request(body, type), env, origin)).status).toBe(200)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account_lists').get().n).toBe(1)
    }
  )
  it('enforces the 64 KiB bound in UTF-8 bytes with an explicit 413', async () => {
    const prefix = JSON.stringify({ metadata: { title: 'Сноуден', raw_data: '' } })
    const overhead = new TextEncoder().encode(prefix).byteLength
    const body = JSON.stringify({
      metadata: { title: 'Сноуден', raw_data: 'x'.repeat(65536 - overhead) }
    })
    expect(new TextEncoder().encode(body).byteLength).toBe(65536)
    expect((await serveAccount(request(body), env, origin)).status).toBe(200)
    const oversized = await serveAccount(request(body + ' '), env, origin)
    expect(oversized.status).toBe(413)
    expect(await oversized.json()).toEqual({ error: 'Metadata payload too large' })
    const unicode = JSON.stringify({ metadata: { title: 'Я'.repeat(33000) } })
    expect(unicode.length).toBeLessThan(65536)
    expect((await serveAccount(request(unicode), env, origin)).status).toBe(413)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account_lists').get().n).toBe(1)
  })
  it('rejects malformed JSON without inserting', async () => {
    const response = await serveAccount(request('{invalid'), env, origin)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid metadata' })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account_lists').get().n).toBe(0)
  })
})
