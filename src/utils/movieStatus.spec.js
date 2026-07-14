import { describe, expect, it } from 'vitest'
import { formatProductionStatus } from './movieStatus'

describe('formatProductionStatus', () => {
  it.each([null, undefined, '', '  ', 'None', 'none', 'null', 'undefined'])(
    'hides empty backend status %j',
    (value) => {
      expect(formatProductionStatus(value)).toBe('')
    }
  )

  it('translates known statuses', () => {
    expect(formatProductionStatus('released')).toBe('Вышел')
  })

  it('preserves unknown meaningful statuses', () => {
    expect(formatProductionStatus('Paused')).toBe('Paused')
  })
})
