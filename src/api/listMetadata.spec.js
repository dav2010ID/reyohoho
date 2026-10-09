import { afterEach, describe, expect, it, vi } from 'vitest'
import { getKpInfo } from './movies.kinobox'
import { enrichListMetadata } from './listMetadata'
vi.mock('./movies.kinobox', () => ({ getKpInfo: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const movie = {
  title: 'Матрица',
  poster: 'https://example.com/poster.jpg',
  year: 1999,
  type: 'FILM'
}
describe('imported card metadata', () => {
  it('loads ratings for complete old cards only when requested, retaining existing fields', async () => {
    getKpInfo.mockResolvedValue({
      ...movie,
      title: 'Other title',
      rating_kp: 8.5,
      rating_imdb: 8.7
    })
    const [result] = await enrichListMetadata([{ ...movie, kp_id: '301' }], {
      includeRatings: true
    })
    expect(result).toMatchObject({ ...movie, rating_kp: 8.5, rating_imdb: 8.7, ratings_checked: 1 })
    await enrichListMetadata([result], { includeRatings: true })
    expect(getKpInfo).toHaveBeenCalledTimes(1)
  })
  it('does not repeatedly fetch a successfully checked movie with no published ratings', async () => {
    getKpInfo.mockResolvedValue(movie)
    const [result] = await enrichListMetadata([{ ...movie, kp_id: '301' }], {
      includeRatings: true
    })
    expect(result.ratings_checked).toBe(1)
    await enrichListMetadata([result], { includeRatings: true })
    expect(getKpInfo).toHaveBeenCalledTimes(1)
  })
  it('bounds concurrent metadata requests across independent cards', async () => {
    let active = 0,
      peak = 0
    getKpInfo.mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return movie
    })
    await Promise.all(
      Array.from({ length: 9 }, (_, index) =>
        enrichListMetadata([{ ...movie, kp_id: String(1000 + index) }], { includeRatings: true })
      )
    )
    expect(getKpInfo).toHaveBeenCalledTimes(9)
    expect(peak).toBe(3)
  })
  it('enriches bare IDs and persists only improvements, preserving dates and filled fields', async () => {
    getKpInfo.mockResolvedValue(movie)
    const persist = vi.fn().mockResolvedValue({ ok: true })
    const [result] = await enrichListMetadata(
      [{ kp_id: '301', title: 'Моё название', addedAt: '2000-01-01' }],
      { persist }
    )
    expect(result).toMatchObject({
      ...movie,
      title: 'Моё название',
      addedAt: '2000-01-01',
      kp_id: '301'
    })
    expect(result.slug).toBeTruthy()
    expect(persist).toHaveBeenCalledWith(result)
  })
  it('does not request complete cards or invalid IDs', async () => {
    const items = [{ ...movie, kp_id: '301' }, { kp_id: 'invalid' }]
    expect(await enrichListMetadata(items)).toEqual(items)
    expect(getKpInfo).not.toHaveBeenCalled()
  })
  it('keeps IDs on failure and retries; storage failure does not hide the movie', async () => {
    getKpInfo.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(movie)
    expect(await enrichListMetadata([{ kp_id: '301' }])).toEqual([{ kp_id: '301' }])
    const result = await enrichListMetadata([{ kp_id: '301' }], {
      persist: vi.fn().mockRejectedValue(new Error('offline'))
    })
    expect(result[0].title).toBe(movie.title)
    expect(getKpInfo).toHaveBeenCalledTimes(2)
  })
  it('never persists after logout or an account change', async () => {
    let current = true
    getKpInfo.mockImplementation(async () => {
      current = false
      return movie
    })
    const persist = vi.fn()
    await expect(
      enrichListMetadata([{ kp_id: '301' }], { persist, isCurrent: () => current })
    ).rejects.toThrow('Аккаунт изменился')
    expect(persist).not.toHaveBeenCalled()
  })
})
