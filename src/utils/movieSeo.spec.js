import { describe, expect, it } from 'vitest'
import { getMovieSeoPath, getMovieSeoSlug, registerMovieSeoEntry } from './movieSeo'

describe('movieSeo', () => {
  it('prefers the original Latin title over a stale fallback slug', () => {
    const movie = {
      kp_id: '5591410',
      title: 'Молодой Шерлок',
      name_ru: 'Молодой Шерлок',
      name_original: 'Young Sherlock'
    }

    expect(getMovieSeoSlug(movie)).toBe('young-sherlock')
    expect(getMovieSeoPath(movie)).toBe('/movie/5591410/young-sherlock')
  })

  it('falls back to transliterated localized title when no original Latin title exists', () => {
    const movie = {
      kp_id: '999999',
      title: 'Пространство',
      name_ru: 'Пространство'
    }

    expect(getMovieSeoSlug(movie)).toBe('prostranstvo')
  })

  it('uses a registered canonical title for sparse list entries with the same kp id', () => {
    registerMovieSeoEntry({
      kp_id: '5591410',
      title: 'Young Sherlock',
      name_original: 'Young Sherlock'
    })

    expect(
      getMovieSeoPath({
        kp_id: '5591410',
        title: 'ÐœÐ¾Ð»Ð¾Ð´Ð¾Ð¹ Ð¨ÐµÑ€Ð»Ð¾Ðº'
      })
    ).toBe('/movie/5591410/young-sherlock')
  })

  it('falls back to a deterministic movie-id slug when the title cannot be transliterated', () => {
    const movie = {
      kp_id: '424242',
      title: '天空の城ラピュタ'
    }

    expect(getMovieSeoSlug(movie)).toBe('movie-424242')
    expect(getMovieSeoPath(movie)).toBe('/movie/424242/movie-424242')
  })

  it('prefers richer incoming canonical data when registering the same kp id again', () => {
    registerMovieSeoEntry({
      kp_id: '777777',
      title: 'Старый слаг',
      slug: 'staryy-slag'
    })

    registerMovieSeoEntry({
      kp_id: '777777',
      title: 'Молодой Шерлок',
      name_original: 'Young Sherlock'
    })

    expect(getMovieSeoSlug({ kp_id: '777777' })).toBe('young-sherlock')
    expect(getMovieSeoPath({ kp_id: '777777' })).toBe('/movie/777777/young-sherlock')
  })
})
