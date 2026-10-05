import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPage,
  isSeoSourceDisabled,
  resolveMoviesToPersist,
  updateSeoDataFile
} from './fetch-seo-data.js'

describe('fetch-seo-data', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('skips disabled KinoBD hosts but permits an explicitly configured other source', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(isSeoSourceDisabled('https://kinobd.net')).toBe(true)
    expect(isSeoSourceDisabled('https://api.kinobd.net')).toBe(true)
    expect(isSeoSourceDisabled('https://catalog.example.test')).toBe(false)
    await expect(fetchPage(1)).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves catalog bytes without requests when KinoBD is disabled', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-disabled-'))
    const outputPath = path.join(tempDir, 'movies.json')
    const raw = '[ { "kp_id": "301", "title": "Матрица" } ]\n'
    await fs.writeFile(outputPath, raw, 'utf8')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await updateSeoDataFile({ outputPath })).toEqual(JSON.parse(raw))
    expect(await fs.readFile(outputPath, 'utf8')).toBe(raw)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('attaches a bounded timeout to enabled source requests', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetch)

    await fetchPage(1, 'https://catalog.example.test')
    expect(timeout).toHaveBeenCalledWith(15000)
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      signal: controller.signal
    }))
  })
})
