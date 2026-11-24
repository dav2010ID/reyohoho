// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import release from '../../release.json'
import { resetHealthCache, serveHealth } from './health.mjs'
import { testDatabase } from './test-db.mjs'

describe('Worker health', () => {
  beforeEach(() => resetHealthCache())
  const read = async (env, now) => (await serveHealth(env, {}, 'test-version', now)).json()

  it('reports the contract and the newest applied D1 migration', async () => {
    const db = testDatabase()
    db.sqlite.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)')
    db.sqlite.exec("INSERT INTO d1_migrations(name) VALUES ('0004_active_history_quota.sql')")
    expect(await read({ HISTORY_DB: db }, 0)).toEqual({
      worker: 'test-version',
      apiContract: release.apiContract,
      d1Migration: '0004_active_history_quota.sql',
      schemaReady: false
    })
    db.sqlite.exec(`INSERT INTO d1_migrations(name) VALUES ('${release.d1Migration}')`)
    // Cached for a minute, then re-read.
    expect((await read({ HISTORY_DB: db }, 30_000)).schemaReady).toBe(false)
    expect(await read({ HISTORY_DB: db }, 61_000)).toMatchObject({
      d1Migration: release.d1Migration,
      schemaReady: true
    })
    db.sqlite.close()
  })
  it('answers without D1 or migration records and does not cache the failure', async () => {
    expect(await read({}, 0)).toMatchObject({ d1Migration: null, schemaReady: false })
    const db = testDatabase()
    expect((await read({ HISTORY_DB: db }, 0)).d1Migration).toBeNull()
    // The migration ledger appears a moment later: no minute-long stale answer.
    db.sqlite.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)')
    db.sqlite.exec(`INSERT INTO d1_migrations(name) VALUES ('${release.d1Migration}')`)
    expect((await read({ HISTORY_DB: db }, 1_000)).schemaReady).toBe(true)
    db.sqlite.close()
  })
})
