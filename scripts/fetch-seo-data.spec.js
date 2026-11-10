// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkFreshness,
  createReader,
  refreshCatalog,
  updateSeoDataFile
} from './fetch-seo-data.js'

const now = new Date('2026-11-10T12:00:00Z')
const poster = 'https://avatars.mds.yandex.net/get-kinopoisk-image/123/pic/600x900'
const item = (id) => ({
  id,
  title: { russian: 'Фильм ' + id, original: 'Film ' + id },
  year: 2000,
  gallery: { posterUrl: '//cdnabc.svc.cdn.yandex.net/get-kinopoisk-image/123/pic' }
})
const page = (ids) => ({ data: { total: 2, items: ids.map((id) => ({ movie: item(id) })) } })
const read = async (endpoint) => {
  if (endpoint.includes('/top?')) {
    const { searchParams } = new URL(endpoint, 'https://example.test')
    const id = searchParams.get('type') === 'movie' ? 1 : 3
    return page([searchParams.get('page') === '1' ? id : 2])
  }
  const id = Number(endpoint.split('/').at(-1))
  return { data: { movie: { ...item(id), description: 'Описание ' + id, gallery: {} } } }
}

describe('SEO catalog refresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('paginates both lists, fetches each title once and preserves published pages and lastmod', async () => {
    const request = vi.fn(read)
    const archive = { kp_id: '8', slug: 'archive', title: 'Архив', updatedAt: '2026-01-05', poster }
    const options = { read: request, pageSize: 1, pageCount: 2, now }
    const movies = await refreshCatalog([archive], options)
    expect(movies.map((m) => m.kp_id)).toEqual(['1', '2', '3', '8'])
    expect(movies[0]).toMatchObject({
      slug: 'film-1',
      poster,
      description: 'Описание 1',
      updatedAt: now.toISOString()
    })
    expect(movies[3]).toEqual(archive)
    expect(request.mock.calls.filter(([url]) => url === '/api/movies/2')).toHaveLength(1)
    expect(await refreshCatalog(movies, { ...options, now: new Date('2026-11-17') })).toEqual(
      movies
    )
  })

  it('removes a dead archive poster if the source confirms there is no artwork', async () => {
    const [archive] = (
      await refreshCatalog(
        [{ kp_id: '8', slug: 'archive', title: 'Архив', poster: 'https://kbd.so/old.jpg' }],
        { read, pageSize: 1, pageCount: 1, now }
      )
    ).slice(-1)
    expect(archive).toMatchObject({
      kp_id: '8',
      slug: 'archive',
      poster: '',
      updatedAt: now.toISOString()
    })
  })

  it.each(['partial list', 'wrong movie', 'network failure'])(
    'does not publish or mark fresh after %s',
    async (failure) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-refresh-test-'))
      const outputPath = path.join(dir, 'movies.json')
      const stamp = path.join(dir, 'seo-refresh.json')
      const raw = '[ ]\n'
      await fs.writeFile(outputPath, raw)
      await fs.writeFile(stamp, '{}')
      try {
        const fail = async (endpoint) => {
          if (failure === 'network failure') throw new Error('Offline')
          if (endpoint.includes('page=2') && failure === 'partial list') return page([])
          if (endpoint === '/api/movies/2' && failure === 'wrong movie')
            return read('/api/movies/3')
          return read(endpoint)
        }
        await expect(
          updateSeoDataFile({ outputPath, read: fail, pageSize: 1, pageCount: 2, now })
        ).rejects.toThrow()
        expect(await fs.readFile(outputPath, 'utf8')).toBe(raw)
        expect(await fs.readFile(stamp, 'utf8')).toBe('{}')
      } finally {
        await fs.unlink(outputPath)
        await fs.unlink(stamp)
        await fs.rmdir(dir)
      }
    }
  )

  it('honors Worker backoff and attaches deadlines to retries', async () => {
    const wait = vi.fn(async () => {})
    vi.spyOn(Date, 'now').mockReturnValue(100000)
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '60' } }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    expect(await createReader('https://worker.test', wait)('/api/movies/1')).toEqual({ ok: true })
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([0, 60000])
    expect(fetch.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('checks refresh age independently of whether a movie changed', () => {
    expect(() => checkFreshness({ refreshedAt: '2026-11-01' }, +now)).not.toThrow()
    for (const refreshedAt of [undefined, 'invalid', '2026-09-20', '2026-11-12']) {
      expect(() => checkFreshness({ refreshedAt }, +now)).toThrow('14 days')
    }
  })
})
