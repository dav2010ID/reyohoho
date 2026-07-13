import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime, parseDate } from './dateUtils'

describe('date utilities', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses the legacy compact UTC format', () => {
    expect(parseDate('20260713T120305')?.toISOString()).toBe('2026-07-13T12:03:05.000Z')
  })

  it('parses ISO timestamps returned by the local backend', () => {
    expect(parseDate('2026-07-13T12:03:05Z')?.toISOString()).toBe('2026-07-13T12:03:05.000Z')
  })

  it('returns an empty relative value for invalid timestamps', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('formats relative time for an ISO backend timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T12:05:05Z'))

    expect(formatRelativeTime('2026-07-13T12:03:05Z')).toContain('2')
  })
})
