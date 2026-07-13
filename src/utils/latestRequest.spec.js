import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from './latestRequest'

describe('latest request guard', () => {
  it('accepts only the newest request', () => {
    const guard = createLatestRequestGuard()
    const first = guard.begin()
    const second = guard.begin()

    expect(guard.isLatest(first)).toBe(false)
    expect(guard.isLatest(second)).toBe(true)
  })

  it('invalidates an active request on reset', () => {
    const guard = createLatestRequestGuard()
    const request = guard.begin()

    guard.invalidate()

    expect(guard.isLatest(request)).toBe(false)
  })
})
