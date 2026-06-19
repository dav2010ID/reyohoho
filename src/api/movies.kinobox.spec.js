import { describe, expect, it } from 'vitest'
import { normalizeKinoboxSearchResponse } from './movies.kinobox'

describe('Kinobox search response normalization', () => {
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
})
