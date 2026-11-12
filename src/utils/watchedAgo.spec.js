import { describe, expect, it } from 'vitest'
import { formatWatchedAgo } from './watchedAgo'

const now = new Date(2026, 10, 12, 15, 0)

describe('formatWatchedAgo', () => {
  it.each([
    [new Date(2026, 10, 12, 1, 0), 'смотрели сегодня'],
    [new Date(2026, 10, 12, 18, 0), 'смотрели сегодня'],
    [new Date(2026, 10, 11, 23, 0), 'смотрели вчера'],
    [new Date(2026, 10, 10, 9, 0), 'смотрели 2 дня назад'],
    [new Date(2026, 10, 7, 9, 0), 'смотрели 5 дней назад'],
    [new Date(2026, 9, 3, 9, 0), 'смотрели 3 окт.']
  ])('formats %s', (date, label) => {
    expect(formatWatchedAgo(date.toISOString(), now)).toBe(label)
  })

  it('returns nothing for missing or invalid dates', () => {
    expect(formatWatchedAgo(undefined, now)).toBe('')
    expect(formatWatchedAgo('not a date', now)).toBe('')
  })
})
