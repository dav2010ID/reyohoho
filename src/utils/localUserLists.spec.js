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

  it('migrates one legacy list and does not rewrite unrelated lists', () => {
    localStorage.setItem('reyohoho-user-lists', JSON.stringify({ favorite: [{ kp_id: '1' }], history: [{ kp_id: '2' }] }))
    expect(getLocalList('history')).toEqual([{ kp_id: '2' }])
    expect(JSON.parse(localStorage.getItem('reyohoho-user-lists'))).toEqual({ favorite: [{ kp_id: '1' }] })
    const spy = vi.spyOn(window.Storage.prototype, 'setItem')
    replaceLocalList('history', [{ kp_id: '3' }])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('reyohoho-user-lists:history')
    spy.mockRestore()
  })
  it('keeps guest, worker accounts and legacy accounts isolated while offline', () => {
    addLocalListItem('favorite', 1, { title: 'Guest' })
    addLocalListItem('favorite', 2, { title: 'Worker A' }, 'worker:11')
    addLocalListItem('favorite', 3, { title: 'Worker B' }, 'worker:12')
    addLocalListItem('favorite', 4, { title: 'Legacy A' }, 'legacy:11')
    clearLocalList('favorite', 'worker:11')
    expect(getLocalList('favorite', 'worker:11')).toEqual([])
    expect(getLocalList('favorite', 'worker:12').map((x) => x.kp_id)).toEqual(['3'])
    expect(getLocalList('favorite', 'legacy:11').map((x) => x.kp_id)).toEqual(['4'])
    expect(getLocalList('favorite').map((x) => x.kp_id)).toEqual(['1'])
    expect(getLocalList('favorite', 'worker:13')).toEqual([])
  })

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
