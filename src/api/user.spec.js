import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addToList, getMyLists, getMovieListStatus, repairCardRatings } from './user'
import { getKpInfo } from './movies.kinobox'
import { normalizeHistory } from '../../migration/history-transfer/history-data.js'

const mocks = vi.hoisted(() => ({
  auth: { token: 'test-session', isWorkerSession: true },
  legacy: { put: vi.fn() },
  worker: { put: vi.fn(), get: vi.fn() },
  patch: vi.fn(),
  history: vi.fn(),
  localAdd: vi.fn()
}))
vi.mock('@/store/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('./axios', () => ({ getApi: async () => mocks.legacy }))
vi.mock('./workerAccount', () => ({
  workerAccountAdapter: mocks.worker,
  workerAccountRequest: mocks.patch,
  workerAuthEnabled: true
}))
vi.mock('./cloudHistory', () => ({
  isCloudHistoryEnabled: () => true,
  historyRequest: mocks.history
}))
vi.mock('./movies.kinobox', () => ({ getKpInfo: vi.fn() }))
vi.mock('./movieSeoNormalizer', () => ({ normalizeMovieListResponse: async (data) => data }))
vi.mock('@/utils/localUserLists', () => ({
  addLocalListItem: mocks.localAdd,
  clearLocalList: vi.fn(),
  getLocalList: vi.fn(),
  removeLocalListItem: vi.fn(),
  replaceLocalList: vi.fn()
}))

const movie = {
  kp_id: '843831',
  title: 'Сноуден',
  slug: 'snowden',
  year: 2016,
  type: 'FILM',
  poster: 'https://example.com/poster.jpg',
  description: 'Описание'.repeat(1500),
  raw_data: { cast: Array(100).fill({ name: 'Актёр' }) }
}
const byteLength = (body) => new TextEncoder().encode(JSON.stringify(body)).byteLength

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.isWorkerSession = true
  mocks.worker.put.mockResolvedValue({ data: { ok: true } })
  mocks.legacy.put.mockResolvedValue({ data: { ok: true } })
  mocks.patch.mockResolvedValue({ ok: true })
  mocks.history.mockResolvedValue({ ok: true })
})

describe('compact cloud list requests', () => {
  it('does not put a failed cloud list write in the local cache', async () => {
    mocks.worker.put.mockRejectedValue(new Error('offline'))
    await expect(addToList('843831', 'favorite', movie)).rejects.toThrow('offline')
    expect(mocks.localAdd).not.toHaveBeenCalled()
  })
  it('reads membership with one private request without hydrating cards', async () => {
    mocks.patch.mockResolvedValue({ favorite: true, later: false })
    expect(await getMovieListStatus('301')).toEqual({ favorite: true, later: false })
    expect(mocks.patch).toHaveBeenCalledWith('/list-status/301')
    expect(getKpInfo).not.toHaveBeenCalled()
  })
  it.each([{ response: { status: 404 } }, new TypeError('Failed to fetch')])(
    'supports the old Worker during endpoint rollout without provider requests (%s)',
    async (error) => {
      mocks.patch.mockRejectedValue(error)
      mocks.worker.get.mockImplementation(async (path) => ({
        data: path === '/list/favorite' ? [{ kp_id: 301 }] : []
      }))
      mocks.history.mockResolvedValue({ history: [{ kp_id: '301' }] })
      expect(await getMovieListStatus(301)).toEqual({
        favorite: true,
        later: false,
        watching: false,
        completed: false,
        abandoned: false,
        history: true
      })
      expect(getKpInfo).not.toHaveBeenCalled()
    }
  )
  it('repairs ratings using a compact fill-only cloud history PATCH', async () => {
    getKpInfo.mockResolvedValue({ ...movie, rating_kp: 7.5 })
    const result = await repairCardRatings(movie, 'history')
    expect(result.rating_kp).toBe(7.5)
    expect(mocks.history).toHaveBeenCalledWith('/843831', 'PATCH', {
      metadata: expect.objectContaining({ rating_kp: 7.5, ratings_checked: 1 })
    })
    expect(mocks.history.mock.calls[0][2].metadata).not.toHaveProperty('raw_data')
  })
  it.each(['favorite', 'later', 'watching', 'completed', 'abandoned'])(
    'sends only card metadata to %s while retaining local metadata',
    async (type) => {
      expect(byteLength({ metadata: movie })).toBeGreaterThan(8192)
      expect(await addToList('843831', type, movie)).toEqual({ ok: true })
      const [path, payload] = mocks.worker.put.mock.calls[0]
      expect(path).toBe(`/list/${type}/843831`)
      expect(payload).toEqual({ metadata: normalizeHistory([movie])[0] })
      expect(byteLength(payload)).toBeLessThan(8192)
      expect(payload.metadata).not.toHaveProperty('raw_data')
      expect(mocks.localAdd).toHaveBeenCalledWith(type, '843831', movie)
      expect(getKpInfo).not.toHaveBeenCalled()
    }
  )
  it('sends compact hydrated metadata for a bare ID', async () => {
    getKpInfo.mockResolvedValue(movie)
    await addToList('843831', 'favorite')
    expect(mocks.worker.put.mock.calls[0][1].metadata).toMatchObject({
      kp_id: '843831',
      title: 'Сноуден',
      poster: movie.poster,
      year: '2016',
      type: 'FILM'
    })
  })
  it('still adds the ID if metadata loading is unavailable', async () => {
    getKpInfo.mockRejectedValue(new Error('offline'))
    await addToList('843831', 'favorite')
    expect(mocks.worker.put.mock.calls[0][1].metadata.kp_id).toBe('843831')
  })
  it('preserves the legacy backend payload', async () => {
    mocks.auth.isWorkerSession = false
    await addToList('843831', 'favorite', movie)
    expect(mocks.legacy.put).toHaveBeenCalledWith('/list/favorite/843831', { metadata: movie })
    expect(mocks.worker.put).not.toHaveBeenCalled()
  })
  it('keeps cloud history PUT compact', async () => {
    await addToList('843831', 'history', movie)
    expect(mocks.history).toHaveBeenCalledWith('/843831', 'PUT', normalizeHistory([movie])[0])
    expect(mocks.worker.put).not.toHaveBeenCalled()
  })
  it('strips full provider data from metadata repair PATCH requests', async () => {
    mocks.worker.get.mockResolvedValue({ data: [{ ...movie, title: '', poster: '' }] })
    getKpInfo.mockResolvedValue(movie)
    await getMyLists('favorite')
    const [path, method, payload] = mocks.patch.mock.calls[0]
    expect(path).toBe('/list/favorite/843831')
    expect(method).toBe('PATCH')
    expect(payload.metadata.title).toBe('Сноуден')
    expect(payload.metadata).not.toHaveProperty('description')
    expect(payload.metadata).not.toHaveProperty('raw_data')
    expect(byteLength(payload)).toBeLessThan(8192)
  })
})
