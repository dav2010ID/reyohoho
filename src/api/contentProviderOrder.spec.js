import { describe, expect, it } from 'vitest'
import { getMovieInfoProviderOrder, getPlayerProviderOrder } from './contentProviderOrder'

describe('content provider order', () => {
  it('tries the chosen DDBB source first, then the other one', () => {
    expect(getPlayerProviderOrder('ddbb_live')).toEqual(['ddbb_live', 'ddbb'])
    expect(getPlayerProviderOrder('ddbb')).toEqual(['ddbb', 'ddbb_live'])
  })

  it('always loads movie info from the Worker', () => {
    expect(getMovieInfoProviderOrder('ddbb')).toEqual(['worker'])
    expect(getMovieInfoProviderOrder('ddbb_live')).toEqual(['worker'])
  })

  it('falls back to the default for retired providers persisted by older builds', () => {
    for (const retired of ['kinobox', 'kinobd', 'local', undefined]) {
      expect(getPlayerProviderOrder(retired)).toEqual(['ddbb_live', 'ddbb'])
      expect(getMovieInfoProviderOrder(retired)).toEqual(['worker'])
    }
  })
})
