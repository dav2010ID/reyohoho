import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from './latestRequest'

describe('latest request guard', () => {
  it('accepts only the newest request', () => {
    const guard = createLatestRequestGuard()
    const first = guard.begin()
    const firstSignal = guard.getSignal(first)
    const second = guard.begin()

    expect(firstSignal.aborted).toBe(true)
    expect(guard.isLatest(first)).toBe(false)
    expect(guard.isLatest(second)).toBe(true)
    expect(guard.getSignal(first)).toBe(null)
    expect(guard.getSignal(second).aborted).toBe(false)
  })

  it('invalidates an active request on reset', () => {
    const guard = createLatestRequestGuard()
    const request = guard.begin()
    const signal = guard.getSignal(request)

    guard.invalidate()

    expect(signal.aborted).toBe(true)
    expect(guard.isLatest(request)).toBe(false)
  })
})
