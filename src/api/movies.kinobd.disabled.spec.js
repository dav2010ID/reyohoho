import { describe, expect, it } from 'vitest'
import { apiSearch, getMovies, getPlayers } from './movies.kinobd'

describe('KinoBD temporary suspension', () => {
  it('rejects direct adapter calls before making network requests', async () => {
    await expect(apiSearch('Матрица')).rejects.toThrow('temporarily disabled')
    await expect(getMovies()).rejects.toThrow('temporarily disabled')
    await expect(getPlayers(301)).rejects.toThrow('temporarily disabled')
  })
})
