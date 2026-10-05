import { describe, expect, it } from 'vitest'
import { getSearchProviderOrder } from './searchProviderOrder'

describe('search provider order', () => {
  it('does not probe the local backend unless it is explicitly selected', () => {
    expect(getSearchProviderOrder('rhserv')).toEqual(['kinobox'])
    expect(getSearchProviderOrder('kinobd')).toEqual(['kinobox'])
  })

  it('keeps the local backend first when it is explicitly selected', () => {
    expect(getSearchProviderOrder('local')).toEqual(['local', 'kinobox'])
  })
})
