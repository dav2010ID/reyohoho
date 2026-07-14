import { describe, expect, it } from 'vitest'
import { formatMovieDuration } from './movieDuration'

describe('movie duration formatting', () => {
  it.each([
    [95, '1 ч. 35 мин.'],
    ['95', '1 ч. 35 мин.'],
    [45, '0 ч. 45 мин.']
  ])('formats supported duration %j', (value, expected) => {
    expect(formatMovieDuration(value)).toBe(expected)
  })

  it.each([null, undefined, '', 'None', 'unknown', 0, -5, Number.NaN])(
    'hides invalid duration %j',
    (value) => {
      expect(formatMovieDuration(value)).toBe('')
    }
  )
})
