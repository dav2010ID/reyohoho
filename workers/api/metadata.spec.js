// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { metadataUpdate } from './metadata.mjs'
import { serveHistory } from './history.mjs'
import { serveAccount } from './account.mjs'
import { sha256 } from './private-api.mjs'
import { testDatabase } from './test-db.mjs'

describe('fill-only cloud metadata', () => {
  it('fills numeric ratings without replacing existing values or resurrecting deleted history', () => {
    const db = testDatabase()
    try {
      const original = JSON.stringify({ kp_id: '301', rating_kp: 8.5, rating_imdb: 0 })
      db.sqlite
        .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
        .run('test', '301', original, '2000-01-01', 0)
      db.sqlite
        .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
        .run('test', '42', '{}', '', 1)
      const metadata = { rating_kp: 9.5, rating_imdb: 8.7, ratings_checked: 1 }
      for (const id of ['301', '42', '999']) {
        const update = metadataUpdate('user_history', metadata, { userId: 'test', id })
        db.sqlite.prepare(update.sql).run(...update.params)
      }
      const row = db.sqlite.prepare('SELECT * FROM user_history WHERE kp_id=?').get('301')
      expect(JSON.parse(row.metadata)).toEqual({
        kp_id: '301',
        rating_kp: 8.5,
        rating_imdb: 8.7,
        ratings_checked: 1
      })
      expect(row.added_at).toBe('2000-01-01')
      expect(
        db.sqlite.prepare('SELECT metadata FROM user_history WHERE kp_id=?').get('42').metadata
      ).toBe('{}')
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM user_history').get().n).toBe(2)
    } finally {
      db.sqlite.close()
    }
  })
  it('preserves dates, filled values, identities, lists and tombstones; never inserts', async () => {
    const db = testDatabase()
    const token = `rh1_${'a'.repeat(43)}`
    db.sqlite.prepare('INSERT INTO tg_users(telegram_id,name) VALUES (?,?)').run('123', 'Test')
    db.sqlite
      .prepare(
        'INSERT INTO tg_sessions(token_hash,telegram_id,expires_at,created_at) VALUES (?,?,?,?)'
      )
      .run(await sha256(token), '123', Date.now() + 60000, Date.now())
    const original = JSON.stringify({
      kp_id: '301',
      title: 'Keep',
      addedAt: '2000-01-01',
      poster: '',
      year: '',
      type: ''
    })
    db.sqlite
      .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
      .run('worker-tg:123', '301', original, '2000-01-01', 0)
    db.sqlite
      .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
      .run('worker-tg:999', '301', original, '2000-01-01', 0)
    db.sqlite
      .prepare('INSERT INTO user_history VALUES (?,?,?,?,?)')
      .run('worker-tg:123', '42', '{}', '', 1)
    db.sqlite
      .prepare('INSERT INTO account_lists VALUES (?,?,?,?,?)')
      .run('worker-tg:123', 'favorite', '301', original, '2000-01-01')
    const env = {
      HISTORY_DB: db,
      TELEGRAM_AUTH_ENABLED: 'true',
      ACCOUNT_RATE_LIMITER: { limit: async () => ({ success: true }) }
    }
    const request = (path) =>
      new Request('https://api.reyhoho.fun/api/' + path, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            title: 'Replace?',
            poster: 'https://example.com/p.jpg',
            year: 1999,
            type: 'FILM',
            token: 'bad',
            user_id: 999
          }
        })
      })
    expect((await serveHistory(request('history/301'), env, 'https://reyhoho.fun')).status).toBe(
      200
    )
    await serveHistory(request('history/42'), env, 'https://reyhoho.fun')
    await serveHistory(request('history/999'), env, 'https://reyhoho.fun')
    expect(
      (await serveAccount(request('list/favorite/301'), env, 'https://reyhoho.fun')).status
    ).toBe(200)
    for (const table of ['user_history', 'account_lists']) {
      const row = db.sqlite
        .prepare(`SELECT * FROM ${table} WHERE user_id=? AND kp_id=?`)
        .get('worker-tg:123', '301')
      expect(row.added_at).toBe('2000-01-01')
      expect(JSON.parse(row.metadata)).toEqual({
        kp_id: '301',
        title: 'Keep',
        addedAt: '2000-01-01',
        poster: 'https://example.com/p.jpg',
        year: '1999',
        type: 'FILM'
      })
    }
    expect(
      db.sqlite.prepare('SELECT metadata FROM user_history WHERE user_id=?').get('worker-tg:999')
        .metadata
    ).toBe(original)
    expect(db.sqlite.prepare('SELECT * FROM user_history WHERE kp_id=?').get('42').metadata).toBe(
      '{}'
    )
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM user_history').get().n).toBe(3)
    db.sqlite.close()
  })
  it('uses bound values and rejects arbitrary table names', () => {
    const update = metadataUpdate(
      'user_history',
      { title: "'); DROP TABLE user_history;--" },
      { userId: 'test', id: '301' }
    )
    expect(update.sql).not.toContain('DROP TABLE')
    expect(update.params[0]).toContain('DROP TABLE')
    expect(() => metadataUpdate('tg_users', {})).toThrow()
  })
})
