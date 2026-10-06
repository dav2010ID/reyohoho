import { describe, expect, it } from 'vitest'
import { normalizeKinoboxSearchResponse, normalizeKinoboxMovie } from './movies.kinobox'
import { getMovieName } from '@/utils/textUtils'

describe('Kinobox search response normalization', () => {
  it('reads the live API data.items envelope', () => {
    const results = normalizeKinoboxSearchResponse({
      data: {
        success: true,
        total: 131,
        items: [
          {
            id: 301,
            title: { russian: 'Матрица', original: 'The Matrix' },
            gallery: { posterUrl: 'https://poster.example/matrix.jpg' },
            year: 1999
          }
        ]
      }
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      kp_id: 301,
      title: 'Матрица',
      name_ru: 'Матрица',
      year: 1999
    })
    expect(getMovieName(results[0].raw_data)).toBe('Матрица')
    expect(results[0].poster).toBe('https://poster.example/matrix.jpg')
  })
  it('normalizes nested movie search results for the existing search UI', () => {
    const results = normalizeKinoboxSearchResponse({
      data: {
        movies: [
          {
            id: 123,
            title: { russian: 'Тест', original: 'Test' },
            rating: { kinopoisk: { value: '7.5', count: 42 } },
            type: 'series',
            year: 2024
          }
        ]
      }
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 123,
      kp_id: 123,
      title: 'Тест',
      name_ru: 'Тест',
      name_original: 'Test',
      rating_kp: 7.5,
      type: 'TV_SERIES',
      year: 2024,
      source: 'kinobox'
    })
    expect(results[0].raw_data.type).toBe('TV_SERIES')
  })

  it('returns an empty list for unsupported responses', () => {
    expect(normalizeKinoboxSearchResponse({ data: null })).toEqual([])
  })

  it('uses the original title when no Russian title is available', () => {
    const results = normalizeKinoboxSearchResponse({
      data: { items: [{ id: 301, title: { russian: null, original: 'The Matrix' } }] }
    })
    expect(results[0].title).toBe('The Matrix')
    expect(getMovieName(results[0].raw_data)).toBe('The Matrix')
  })
})

describe('Kinobox movie card normalization', () => {
  it('keeps title, description, ratings, poster and other movie information', () => {
    const movie = normalizeKinoboxMovie(
      {
        id: 301,
        title: { russian: 'Матрица', original: 'The Matrix' },
        description: 'Хакер Нео узнает правду о своём мире.',
        synopsis: 'Жизнь Томаса Андерсона разделена на две части.',
        rating: { kinopoisk: { value: 8.5, count: 815101 }, imdb: { value: 8.7, count: 2200000 } },
        gallery: { posterUrl: 'https://poster.example/matrix.jpg' },
        year: 1999,
        duration: '02:16:00',
        countries: [{ name: 'США' }],
        genres: [{ name: 'фантастика' }]
      },
      301
    )
    expect(movie).toMatchObject({
      kp_id: 301,
      title: 'Матрица',
      name_original: 'The Matrix',
      description: 'Хакер Нео узнает правду о своём мире.',
      rating_kinopoisk: 8.5,
      rating_imdb: 8.7,
      rating_kinopoisk_vote_count: 815101,
      rating_imdb_vote_count: 2200000,
      poster: 'https://poster.example/matrix.jpg',
      year: 1999,
      film_length: '02:16:00',
      countries: [{ country: 'США' }],
      genres: [{ genre: 'фантастика' }]
    })
  })
})
