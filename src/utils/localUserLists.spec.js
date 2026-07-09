import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addLocalListItem,
  clearLocalList,
  getLocalList,
  removeLocalListItem,
  replaceLocalList
} from './localUserLists'

describe('local user lists mirror', () => {
  beforeEach(() => localStorage.clear())

  it('stores metadata and mirrors add/remove/replace operations', () => {
    addLocalListItem('favorite', 301, {
      name_ru: 'Матрица',
      poster_url: 'https://example.test/matrix.jpg',
      rating_kinopoisk: 8.5
    })
    expect(getLocalList('favorite')[0]).toMatchObject({
      kp_id: '301',
      title: 'Матрица',
      poster: 'https://example.test/matrix.jpg',
      rating_kinopoisk: 8.5
    })

    removeLocalListItem('favorite', 301)
    expect(getLocalList('favorite')).toEqual([])

    replaceLocalList('later', [{ kp_id: 2022, title: 'День независимости' }])
    expect(getLocalList('later')[0].title).toBe('День независимости')
    clearLocalList('later')
    expect(getLocalList('later')).toEqual([])
  })

  it('recovers from malformed list shapes in persisted data', () => {
    localStorage.setItem(
      'reyohoho-user-lists',
      JSON.stringify({ favorite: { kp_id: 'broken' }, history: 'broken' })
    )

    expect(getLocalList('favorite')).toEqual([])
    expect(() => addLocalListItem('history', 301)).not.toThrow()
    expect(getLocalList('history')).toHaveLength(1)
  })

  it('does not block list operations when storage writes fail', () => {
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new window.DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(() => addLocalListItem('favorite', 301)).not.toThrow()
    vi.restoreAllMocks()
  })
})
