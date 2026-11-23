import { describe, expect, it } from 'vitest'
import { getMovieInfoProviderOrder, getPlayerProviderOrder } from './contentProviderOrder'

describe('content provider order', () => {
  it('tries DDBB Live, then DDBB, then Kinobox for remote players', () => {
    expect(getPlayerProviderOrder('ddbb')).toEqual(['ddbb_live', 'ddbb', 'kinobox'])
    expect(getPlayerProviderOrder('kinobox')).toEqual(['ddbb_live', 'ddbb', 'kinobox'])
    expect(getPlayerProviderOrder('ddbb_live')).toEqual(['ddbb_live', 'kinobox'])
  })

  it('does not request local movie info for a remote provider', () => {
    expect(getMovieInfoProviderOrder('ddbb')).toEqual(['kinobox'])
    expect(getMovieInfoProviderOrder('kinobox')).toEqual(['kinobox'])
  })

  it('ignores retired providers persisted by older builds', () => {
    expect(getMovieInfoProviderOrder('kinobd')).toEqual(['kinobox'])
    expect(getPlayerProviderOrder('kinobd')).toEqual(['ddbb_live', 'ddbb', 'kinobox'])
    expect(getPlayerProviderOrder('local')).toEqual(['ddbb_live', 'ddbb', 'kinobox'])
    expect(getMovieInfoProviderOrder('local')).toEqual(['kinobox'])
  })
})
