import { importWorkerList } from './user'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addToList,
  delAllFromList,
  delFromList,
  flushHistoryOutbox,
  getMyLists,
  getMovieListStatus,
  repairCardRatings
} from './user'
import { replaceLocalList } from '@/utils/localUserLists'
import { getKpInfo } from './movies.worker'
import { normalizeHistory } from '../../shared/history-data.js'

const mocks = vi.hoisted(() => ({
  auth: { token: 'test-session', isWorkerSession: true, user: { id: 11 } },
  legacy: { put: vi.fn() },
  worker: { put: vi.fn(), get: vi.fn(), delete: vi.fn() },
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
  getCloudHistory: async () => (await mocks.history()).history,
  historyRequest: mocks.history
}))
vi.mock('./movies.worker', () => ({ getKpInfo: vi.fn() }))
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
  mocks.auth.token = 'test-session'
  mocks.auth.user = { id: 11 }
  mocks.worker.put.mockResolvedValue({ data: { ok: true } })
  mocks.legacy.put.mockResolvedValue({ data: { ok: true } })
  mocks.patch.mockResolvedValue({ ok: true })
  mocks.history.mockResolvedValue({ ok: true })
})

describe('compact cloud list requests', () => {
  it('batches imports and stops before sending data after an account switch', async () => {
    mocks.patch.mockResolvedValue({ added: 40 })
    await importWorkerList('favorite', Array.from({ length: 81 }, (_, i) => String(i + 1)))
    expect(mocks.patch.mock.calls.map(call => call[2].items.length)).toEqual([40, 40, 1])
    mocks.patch.mockClear()
    mocks.patch.mockImplementation(async () => { mocks.auth.token = 'another'; return { added: 40 } })
    await expect(importWorkerList('favorite', Array.from({ length: 81 }, (_, i) => String(i + 1)))).rejects.toThrow('Аккаунт изменился')
    expect(mocks.patch).toHaveBeenCalledTimes(1)
  })
  it.each(['delete', 'account'])('returns cards before metadata and ignores enrichment after %s', async (change) => {
    let finishMetadata
    getKpInfo.mockImplementation(() => new Promise((resolve) => { finishMetadata = resolve }))
    mocks.worker.get.mockResolvedValue({ data: [{ kp_id: '301', title: '', poster: '' }] })
    mocks.worker.delete.mockResolvedValue({ data: {} })
    const cards = await getMyLists('favorite')
    expect(cards).toHaveLength(1)
    expect(cards[0].title).toBe('')
    const saves = replaceLocalList.mock.calls.length
    if (change === 'delete') await delFromList('301', 'favorite')
    else mocks.auth.token = 'new-account'
    finishMetadata({ kp_id: '301', title: 'Late movie', poster: 'https://example.test/a.jpg' })
    await vi.waitFor(() => expect(getKpInfo).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cards[0].title).toBe('')
    expect(replaceLocalList).toHaveBeenCalledTimes(saves)
    expect(mocks.patch).not.toHaveBeenCalled()
  })
  it('rejects account changes while a response is in flight', async () => {
    mocks.worker.get.mockImplementation(async () => {
      mocks.auth.token = 'different-session'
      return { data: [movie] }
    })
    await expect(getMyLists('favorite')).rejects.toThrow('Аккаунт изменился')
  })
  it('does not use guest storage while an authenticated owner is unknown', async () => {
    mocks.auth.user = null
    await expect(getMyLists('favorite')).rejects.toThrow('Дождитесь')
    expect(mocks.worker.get).not.toHaveBeenCalled()
  })
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
      expect(mocks.localAdd).toHaveBeenCalledWith(type, '843831', movie, 'worker:11')
      expect(getKpInfo).not.toHaveBeenCalled()
    }
  )
  it('writes a bare ID without waiting for provider metadata', async () => {
    getKpInfo.mockImplementation(() => new Promise(() => {}))
    await addToList('843831', 'favorite')
    expect(mocks.worker.put.mock.calls[0][1].metadata).toMatchObject({
      kp_id: '843831',
      title: ''
    })
    expect(getKpInfo).not.toHaveBeenCalled()
  })
  it('still adds the ID if metadata loading is unavailable', async () => {
    getKpInfo.mockRejectedValue(new Error('offline'))
    await addToList('843831', 'favorite')
    expect(mocks.worker.put.mock.calls[0][1].metadata.kp_id).toBe('843831')
  })
  it('keeps cloud history PUT compact', async () => {
    await addToList('843831', 'history', movie)
    expect(mocks.history).toHaveBeenCalledWith('/843831', 'PUT', { ...normalizeHistory([movie])[0], viewedAt: expect.any(String) })
    expect(mocks.worker.put).not.toHaveBeenCalled()
  })
  it('strips full provider data from metadata repair PATCH requests', async () => {
    mocks.worker.get.mockResolvedValue({ data: [{ ...movie, title: '', poster: '' }] })
    getKpInfo.mockResolvedValue(movie)
    await getMyLists('favorite', { awaitMetadata: true })
    const [path, method, payload] = mocks.patch.mock.calls[0]
    expect(path).toBe('/list/favorite/843831')
    expect(method).toBe('PATCH')
    expect(payload.metadata.title).toBe('Сноуден')
    expect(payload.metadata).not.toHaveProperty('description')
    expect(payload.metadata).not.toHaveProperty('raw_data')
    expect(byteLength(payload)).toBeLessThan(8192)
  })
})

describe('history outbox', () => {
  beforeEach(() => localStorage.clear())
  const offline = () => Object.assign(new TypeError('Failed to fetch'), {})
  const httpError = (status, code) => Object.assign(new Error('fail'), { code, response: { status } })

  it('keeps a failed viewing and replays it on top of the next server snapshot', async () => {
    mocks.history.mockRejectedValueOnce(offline())
    await expect(addToList('843831', 'history', movie)).rejects.toThrow()
    mocks.history.mockImplementation(async (path, method) =>
      method === 'PUT' ? { ok: true } : { history: [{ kp_id: '42', title: 'Server', addedAt: '2020-01-01T00:00:00.000Z' }] }
    )
    const history = await getMyLists('history')
    expect(history.map((item) => item.kp_id)).toEqual(['843831', '42'])
    expect(history[0].title).toBe('Сноуден')
    await vi.waitFor(() => expect(localStorage.getItem('reyohoho-history-outbox:worker%3A11')).toBeNull())
    const replay = mocks.history.mock.calls.find(([path, method]) => path === '/843831' && method === 'PUT')
    expect(replay[2]).not.toHaveProperty('description')
    expect(Date.parse(replay[2].viewedAt)).toBeLessThanOrEqual(Date.now())
  })
  it('hides a queued deletion from the server snapshot until it is sent', async () => {
    mocks.history.mockRejectedValueOnce(httpError(503))
    await expect(delFromList('42', 'history')).rejects.toThrow()
    let releaseDelete
    mocks.history.mockImplementation((path, method) =>
      method === 'DELETE' ? new Promise((resolve) => { releaseDelete = resolve }) : Promise.resolve({ history: [{ kp_id: '42' }, { kp_id: '7' }] })
    )
    expect((await getMyLists('history')).map((item) => item.kp_id)).toEqual(['7'])
    releaseDelete({ ok: true })
    await vi.waitFor(() => expect(localStorage.getItem('reyohoho-history-outbox:worker%3A11')).toBeNull())
  })
  it('drops writes the server can never accept and keeps the newest operation per title', async () => {
    mocks.history.mockRejectedValueOnce(httpError(400))
    await expect(addToList('843831', 'history', movie)).rejects.toThrow()
    expect(localStorage.getItem('reyohoho-history-outbox:worker%3A11')).toBeNull()
    mocks.history.mockRejectedValue(offline())
    await expect(addToList('301', 'history', movie)).rejects.toThrow()
    await expect(delFromList('301', 'history')).rejects.toThrow()
    const queued = JSON.parse(localStorage.getItem('reyohoho-history-outbox:worker%3A11'))
    expect(queued.map((entry) => [entry.kpId, entry.op])).toEqual([['301', 'del']])
  })
  it('does not let a replay in flight bring titles back after clearing the history', async () => {
    mocks.history.mockRejectedValue(offline())
    await expect(addToList('301', 'history', movie)).rejects.toThrow()
    await expect(addToList('302', 'history', movie)).rejects.toThrow()
    const calls = []
    let releaseFirst
    mocks.history.mockImplementation((path, method) => {
      calls.push(`${method} ${path || '/'}`)
      if (method === 'PUT' && !releaseFirst)
        return new Promise((resolve) => {
          releaseFirst = () => resolve({ ok: true })
        })
      return Promise.resolve({ ok: true })
    })
    const replay = flushHistoryOutbox()
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'))
    const clearing = delAllFromList('history')
    // The DELETE waits for the request already sent ...
    await Promise.resolve()
    expect(calls).toEqual(['PUT /301'])
    releaseFirst()
    await clearing
    await replay
    // ... and the rest of the old snapshot is never sent.
    expect(calls).toEqual(['PUT /301', 'DELETE /'])
    expect(localStorage.getItem('reyohoho-history-outbox:worker%3A11')).toBeNull()
  })
  it('does not clear an account the user switched to, and keeps the queue when the DELETE fails', async () => {
    mocks.history.mockRejectedValue(offline())
    await expect(addToList('301', 'history', movie)).rejects.toThrow()
    const outbox = () => localStorage.getItem('reyohoho-history-outbox:worker%3A11')
    let release
    mocks.history.mockImplementation((path, method) =>
      method === 'PUT' && !release
        ? new Promise((resolve) => {
            release = () => resolve({ ok: true })
          })
        : method === 'DELETE'
          ? Promise.reject(offline())
          : Promise.resolve({ ok: true })
    )
    void flushHistoryOutbox()
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const clearing = delAllFromList('history')
    mocks.auth.token = 'other-session'
    release()
    await expect(clearing).rejects.toThrow('Аккаунт изменился')
    expect(mocks.history.mock.calls.some(([, method]) => method === 'DELETE')).toBe(false)
    mocks.auth.token = 'test-session'
    mocks.history.mockRejectedValue(offline())
    await expect(addToList('302', 'history', movie)).rejects.toThrow()
    await expect(delAllFromList('history')).rejects.toThrow()
    expect(JSON.parse(outbox()).map((entry) => entry.kpId)).toContain('302')
  })
  it('keeps queues separate per account', async () => {
    mocks.history.mockRejectedValue(offline())
    await expect(addToList('301', 'history', movie)).rejects.toThrow()
    mocks.auth.user = { id: 22 }
    mocks.history.mockResolvedValue({ history: [] })
    expect(await getMyLists('history')).toEqual([])
    expect(localStorage.getItem('reyohoho-history-outbox:worker%3A11')).not.toBeNull()
  })
})

describe('exclusive viewing statuses', () => {
  it('drops the title from the other local status lists after a status write', async () => {
    const { removeLocalListItem } = await import('@/utils/localUserLists')
    await addToList('843831', 'completed', movie)
    expect(removeLocalListItem.mock.calls.map((call) => call[0]).sort()).toEqual(['abandoned', 'watching'])
    removeLocalListItem.mockClear()
    await addToList('843831', 'favorite', movie)
    expect(removeLocalListItem).not.toHaveBeenCalled()
  })
})

describe('list import batching', () => {
  it('splits by bytes and reports a full list instead of failing silently', async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ kp_id: String(i + 1), title: 'Я'.repeat(299), poster: 'https://example.com/' + 'p'.repeat(2000) }))
    mocks.patch.mockResolvedValue({ added: 1, rejected: 0 })
    await importWorkerList('favorite', items)
    const sizes = mocks.patch.mock.calls.map((call) => byteLength(call[2]))
    expect(mocks.patch.mock.calls.length).toBeGreaterThan(1)
    for (const size of sizes) expect(size).toBeLessThanOrEqual(60 * 1024)
    mocks.patch.mockReset()
    mocks.patch
      .mockResolvedValueOnce({ added: 30, rejected: 10 })
      .mockRejectedValueOnce(Object.assign(new Error('full'), { code: 'list_capacity', response: { status: 409 } }))
    const error = await importWorkerList('favorite', Array.from({ length: 41 }, (_, i) => String(i + 1))).catch((caught) => caught)
    expect(error).toMatchObject({ code: 'list_capacity', added: 30, rejected: 11 })
  })
})
