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
  it('imports bounded batches, preserves existing entries and fills up to the capacity', async () => {
    const bulk = (items, partial = true) => serveAccount(new Request('https://api.reyhoho.fun/api/list/favorite/import', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, partial })
    }), env, origin)
    expect(await (await bulk([{ kp_id: '301', title: 'Original' }, { kp_id: '42' }])).json()).toEqual({ added: 2, rejected: 0 })
    expect(await (await bulk([{ kp_id: '301', title: 'Changed' }])).json()).toEqual({ added: 0, rejected: 0 })
    expect(db.sqlite.prepare('SELECT metadata FROM account_lists WHERE kp_id=?').get('301').metadata).toContain('Original')
    expect((await bulk([{ kp_id: 'invalid' }])).status).toBe(400)
    expect((await bulk(Array.from({ length: 41 }, (_, i) => ({ kp_id: String(i + 1) })))).status).toBe(400)
    // Duplicate IDs in one batch collapse instead of failing the import.
    expect(await (await bulk([{ kp_id: '7' }, { kp_id: '7' }])).json()).toEqual({ added: 1, rejected: 0 })
    const insert = db.sqlite.prepare('INSERT INTO account_lists VALUES (?,?,?,?,?)')
    for (let i = 0; i < 996; i++) insert.run('worker-tg:123', 'favorite', String(10000 + i), '{}', '')
    // Clients that do not ask for partial imports keep all-or-nothing.
    const legacy = await bulk([{ kp_id: '500' }, { kp_id: '501' }], false)
    expect(legacy.status).toBe(409)
    expect(await legacy.json()).toEqual({ error: 'list_capacity', limit: 1000, remaining: 0, added: 0, rejected: 1 })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account_lists').get().n).toBe(999)
    const partial = await bulk([{ kp_id: '500' }, { kp_id: '501' }])
    expect(partial.status).toBe(200)
    expect(await partial.json()).toEqual({ added: 1, rejected: 1 })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account_lists').get().n).toBe(1000)
    const full = await bulk([{ kp_id: '502' }])
    expect(full.status).toBe(409)
    expect(await full.json()).toEqual({ error: 'list_capacity', limit: 1000, remaining: 0, added: 0, rejected: 1 })
    // An already-present title still succeeds at capacity.
    expect(await (await bulk([{ kp_id: '500' }])).json()).toEqual({ added: 0, rejected: 0 })
  })
  it('keeps one viewing status per title and leaves other lists alone', async () => {
    const put = (type) => serveAccount(request(JSON.stringify({ metadata: { title: 'T' } }), type), env, origin)
    const types = () => db.sqlite.prepare('SELECT list_type FROM account_lists WHERE kp_id=? ORDER BY list_type').all('843831').map(row => row.list_type)
    expect(await (await put('favorite')).json()).toEqual({ ok: true })
    expect(await (await put('watching')).json()).toEqual({ ok: true, replaced: false })
    expect(await (await put('completed')).json()).toEqual({ ok: true, replaced: true })
    expect(types()).toEqual(['completed', 'favorite'])
    await put('abandoned')
    expect(types()).toEqual(['abandoned', 'favorite'])
    // Import does not add a second status for a title that already has one.
    const imported = await serveAccount(new Request('https://api.reyhoho.fun/api/list/watching/import', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ kp_id: '843831' }, { kp_id: '42' }] })
    }), env, origin)
    expect(await imported.json()).toEqual({ added: 1, rejected: 0 })
    expect(types()).toEqual(['abandoned', 'favorite'])
  })
  it('keeps one status when a status is set while an import is in flight', async () => {
    const batch = db.batch.bind(db)
    db.batch = async (statements) => {
      db.sqlite
        .prepare('INSERT INTO account_lists VALUES (?,?,?,?,?)')
        .run('worker-tg:123', 'watching', '42', '{}', '2026-11-01')
      return batch(statements)
    }
    const imported = await serveAccount(new Request('https://api.reyhoho.fun/api/list/completed/import', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ kp_id: '42' }], partial: true })
    }), env, origin)
    expect(await imported.json()).toEqual({ added: 0, rejected: 0 })
    expect(db.sqlite.prepare("SELECT list_type FROM account_lists WHERE kp_id='42'").all().map(row => row.list_type)).toEqual(['watching'])
  })
  it('returns a typed capacity error when a single add hits the list limit', async () => {
    const insert = db.sqlite.prepare('INSERT INTO account_lists VALUES (?,?,?,?,?)')
    for (let i = 0; i < 1000; i++) insert.run('worker-tg:123', 'later', String(10000 + i), '{}', '')
    const response = await serveAccount(request(JSON.stringify({ metadata: {} }), 'later'), env, origin)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'list_capacity', limit: 1000, remaining: 0 })
  })
  it('keeps existing sessions working while new logins are switched off', async () => {
    env.TELEGRAM_AUTH_ENABLED = 'false'
    const response = await serveAccount(request(JSON.stringify({ metadata: {} })), env, origin)
    expect(response.status).toBe(200)
  })
  it('charges the history alias once and exposes the next cursor', async () => {
    let calls = 0
    env.ACCOUNT_RATE_LIMITER = { limit: async () => (calls++, { success: true }) }
    const insert = db.sqlite.prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
    db.sqlite.exec('BEGIN')
    for (let i = 1; i <= 1001; i++)
      insert.run('worker-tg:123', String(i), JSON.stringify({ kp_id: String(i) }), '2026-01-01T00:00:00.000Z', 0)
    db.sqlite.exec('COMMIT')
    const response = await serveAccount(new Request('https://api.reyhoho.fun/api/list/history', {
      headers: { Authorization: 'Bearer ' + token }
    }), env, origin)
    expect(response.status).toBe(200)
    expect(calls).toBe(1)
    const items = await response.json()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(1000)
    expect(response.headers.get('X-Next-Cursor')).toBeTruthy()
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Next-Cursor')
  })
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
      expect(await response.json()).toMatchObject({ ok: true })
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
