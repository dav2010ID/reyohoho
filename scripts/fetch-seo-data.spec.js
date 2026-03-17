import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveMoviesToPersist, updateSeoDataFile } from './fetch-seo-data.js'

describe('fetch-seo-data', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the existing catalog when the fetched result is empty', () => {
    const existingMovies = [{ kp_id: '123', title: 'Existing movie', slug: 'existing-movie' }]

    expect(resolveMoviesToPersist(existingMovies, [])).toEqual(existingMovies)
  })

  it('does not overwrite the existing catalog when the API request fails', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-fetch-'))
    const outputPath = path.join(tempDir, 'movies.json')
    const existingMovies = [{ kp_id: '123', title: 'Existing movie', slug: 'existing-movie' }]

    await fs.writeFile(outputPath, `${JSON.stringify(existingMovies, null, 2)}\n`, 'utf8')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failed')))

    await expect(
      updateSeoDataFile({
        outputPath,
        apiBaseUrl: 'https://example.invalid',
        pageCount: 1
      })
    ).rejects.toThrow('Network failed')

    const persistedMovies = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(persistedMovies).toEqual(existingMovies)
  })
})
