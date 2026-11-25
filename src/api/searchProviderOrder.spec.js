import { describe, expect, it } from 'vitest'
import { getSearchProviderOrder } from './searchProviderOrder'

describe('search provider order', () => {
  it('always searches through the Worker', () => {
    for (const provider of ['rhserv', 'kinobd', 'local', 'kinobox', 'ddbb', undefined])
      expect(getSearchProviderOrder(provider)).toEqual(['worker'])
  })
})
