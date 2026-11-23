// @vitest-environment node
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkLive, checkStatic, readRelease } from './check-release.mjs'

const release = { apiContract: 2, d1Migration: '0005_login_context.sql' }

describe('release manifest', () => {
  it('matches the newest D1 migration in the repository', async () => {
    const actual = await readRelease(path.resolve('.'))
    expect(await checkStatic(actual)).toEqual([])
    expect(await checkStatic({ ...actual, d1Migration: '0001_history.sql' })).toEqual([
      expect.stringContaining('newest migration is')
    ])
  })
  it('blocks a site release until the migration and the Worker are live', () => {
    expect(checkLive({ apiContract: 2, d1Migration: '0005_login_context.sql' }, release)).toEqual([])
    expect(checkLive({ apiContract: 3, d1Migration: '0006_next.sql' }, release)).toEqual([])
    expect(checkLive(null, release)).toEqual(['the Worker has no /api/health'])
    const errors = checkLive({ apiContract: 1, d1Migration: '0004_active_history_quota.sql' }, release)
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('deploy the API Worker first')
    expect(errors[1]).toContain('apply the migration first')
  })
})
