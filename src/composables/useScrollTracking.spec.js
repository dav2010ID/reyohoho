import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollTracking } from './useScrollTracking'

describe('useScrollTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useScrollTracking().stopTracking()
  })

  afterEach(() => {
    useScrollTracking().stopTracking()
    vi.useRealTimers()
  })

  it('shares reactive scroll state between router consumers', () => {
    const tracker = useScrollTracking()
    const secondConsumer = useScrollTracking()

    tracker.startTracking()
    window.dispatchEvent(new window.Event('scroll'))

    expect(tracker.userHasScrolled.value).toBe(true)
    expect(secondConsumer.userHasScrolled.value).toBe(true)
  })

  it('resets state when tracking a new navigation', () => {
    const tracker = useScrollTracking()
    tracker.startTracking()
    window.dispatchEvent(new window.Event('scroll'))

    tracker.startTracking()

    expect(tracker.userHasScrolled.value).toBe(false)
  })
})
