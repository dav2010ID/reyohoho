import { describe, expect, it } from 'vitest'
import { getSearchProviderOrder } from './searchProviderOrder'

describe('search provider order', () => {
  it('does not probe the local backend unless it is explicitly selected', () => {
    expect(getSearchProviderOrder('rhserv')).toEqual(['rhserv', 'kinobd', 'kinobox'])
    expect(getSearchProviderOrder('kinobd')).toEqual(['kinobd', 'rhserv', 'kinobox'])
  })

  it('keeps the local backend first when it is explicitly selected', () => {
    expect(getSearchProviderOrder('local')).toEqual(['local', 'rhserv', 'kinobd', 'kinobox'])
  })
})
