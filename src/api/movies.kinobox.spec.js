import { describe, expect, it } from 'vitest'
import { normalizeKinoboxSearchResponse } from './movies.kinobox'

describe('Kinobox search response normalization', () => {
  it('reads the live API data.items envelope', () => {
    const results = normalizeKinoboxSearchResponse({
      data: {
        success: true,
        total: 131,
        items: [{ id: 301, title: { russian: 'Матрица', original: 'The Matrix' }, year: 1999 }]
      }
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ kp_id: 301, title: 'Матрица', name_ru: 'Матрица', year: 1999 })
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
  })
})
