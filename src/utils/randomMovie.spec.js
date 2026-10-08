import { describe, expect, it } from 'vitest'
import { normalizeRandomMovie } from './randomMovie'

describe('random movie modal data', () => {
  const movie = {
    kp_id: 301,
    title: 'Матрица',
    poster_url: 'https://poster.test/matrix',
    source: 'kinopoisk',
    type: 'FILM',
    year: 1999,
    film_length: 136,
    rating_kinopoisk: 8.5,
    rating_kinopoisk_vote_count: 42,
    countries: [{ country: 'США' }],
    genres: [{ genre: 'фантастика' }],
    web_url: 'https://www.kinopoisk.ru/film/301/'
  }
  it('fills the modal even when card enrichment fails', () => {
    expect(normalizeRandomMovie(movie)).toMatchObject({
      kp_id: 301,
      title: 'Матрица',
      cover: movie.poster_url,
      year: 1999,
      duration: 136,
      rating_kp: 8.5,
      countries: 'США',
      genres: 'фантастика',
      url_kp: movie.web_url,
      total_rating: 42,
      source: 'kinopoisk'
    })
  })
  it('enriches description and ratings without erasing available top data', () => {
    expect(
      normalizeRandomMovie(movie, {
        description: 'Описание',
        film_length: 137,
        rating_imdb: 8.7,
        poster_url: '',
        rating_kinopoisk: null,
        countries: [],
        genres: [],
        rating_age_limits: 'age16'
      })
    ).toMatchObject({
      description: 'Описание',
      duration: 137,
      cover: movie.poster_url,
      rating_kp: 8.5,
      rating_imdb: 8.7,
      countries: 'США',
      genres: 'фантастика',
      age_rating: '16+'
    })
  })
  it('keeps the legacy /chance field contract', () => {
    const legacy = {
      kp_id: 42,
      title: 'Film',
      cover: 'poster',
      duration: 100,
      rating_kp: 7,
      countries: 'США',
      genres: 'драма',
      url_kp: 'kp',
      rating_reyohoho: 9,
      budget: '$10'
    }
    expect(normalizeRandomMovie(legacy)).toMatchObject(legacy)
  })
  it('converts Kinobox clock durations and age codes to readable values', () => {
    expect(
      normalizeRandomMovie(movie, { film_length: '02:22:00', rating_age_limits: 'age18' })
    ).toMatchObject({ duration: 142, age_rating: '18+' })
  })
  it('keeps the top duration if enrichment contains an invalid duration', () => {
    expect(normalizeRandomMovie(movie, { film_length: 'unknown' }).duration).toBe(136)
    expect(normalizeRandomMovie({ kp_id: 1 }, { film_length: 'unknown' }).duration).toBeNull()
  })
})
