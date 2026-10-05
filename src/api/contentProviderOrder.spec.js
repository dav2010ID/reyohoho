import { describe, expect, it } from 'vitest'
import { getMovieInfoProviderOrder, getPlayerProviderOrder } from './contentProviderOrder'

describe('content provider order', () => {
  it('does not aggregate local players for a remote provider', () => {
    expect(getPlayerProviderOrder('ddbb')).toEqual(['ddbb'])
    expect(getPlayerProviderOrder('kinobox')).toEqual(['kinobox', 'ddbb'])
  })

  it('keeps player requests local when local mode is selected', () => {
    expect(getPlayerProviderOrder('local')).toEqual(['local'])
  })

  it('does not request local movie info for a remote provider', () => {
    expect(getMovieInfoProviderOrder('ddbb')).toEqual(['kinobox'])
    expect(getMovieInfoProviderOrder('kinobox')).toEqual(['kinobox'])
  })

  it('keeps local movie info first when local mode is selected', () => {
    expect(getMovieInfoProviderOrder('local')).toEqual([
      'local',
      'kinobox'
    ])
  })

  it('excludes disabled KinoBD even when persisted as the selected provider', () => {
    expect(getMovieInfoProviderOrder('kinobd')).toEqual(['kinobox'])
    expect(getPlayerProviderOrder('kinobd')).toEqual(['ddbb'])
  })
})
