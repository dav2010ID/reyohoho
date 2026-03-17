import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSitemapUrls, generateSeoAssets } from './generate-seo-assets.js'

describe('generate-seo-assets', () => {
  it('falls back to static routes when movies.json is missing', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-assets-'))
    const robotsPath = path.join(tempDir, 'robots.txt')
    const sitemapPath = path.join(tempDir, 'sitemap.xml')

    const { urls } = await generateSeoAssets({
      moviesPath: path.join(tempDir, 'missing-movies.json'),
      robotsPath,
      sitemapPath,
      siteOrigin: 'https://example.com',
      basePath: '/app'
    })

    expect(urls.map((item) => item.loc)).toEqual([
      'https://example.com/app/',
      'https://example.com/app/top',
      'https://example.com/app/contact'
    ])
  })

  it('includes movie routes in sitemap URLs when catalog entries exist', () => {
    const urls = createSitemapUrls({
      siteOrigin: 'https://example.com',
      basePath: '/app',
      currentDate: '2026-03-17',
      movies: [
        {
          kp_id: '123',
          title: 'Interstellar',
          name_original: 'Interstellar',
          year: '2014',
          updatedAt: '2026-03-01T12:00:00Z'
        }
      ]
    })

    expect(urls.some((item) => item.loc === 'https://example.com/app/movie/123/interstellar')).toBe(
      true
    )
  })
})
