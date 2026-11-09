import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  auth: { token: 'legacy-session', isWorkerSession: false },
  getApi: vi.fn(),
  legacy: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  worker: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }
}))
vi.mock('@/store/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/api/axios', () => ({ getApi: mocks.getApi }))
vi.mock('./workerAccount', () => ({ workerAccountAdapter: mocks.worker }))

import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationsAsRead,
  deleteNotification
} from './notifications'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubEnv('VITE_APP_API_URL', 'https://configured.example')
  vi.resetAllMocks()
  mocks.auth.token = 'legacy-session'
  mocks.auth.isWorkerSession = false
  mocks.getApi.mockResolvedValue(mocks.legacy)
  for (const method of ['get', 'post', 'delete']) {
    mocks.legacy[method].mockResolvedValue({ data: { ok: true } })
  }
})

afterEach(() => vi.unstubAllEnvs())

describe('notification request guards', () => {
  it('does not try legacy notifications without a configured server', async () => {
    vi.stubEnv('VITE_APP_API_URL', '')
    await expect(getNotifications()).rejects.toThrow('Уведомления недоступны')
    expect(mocks.getApi).not.toHaveBeenCalled()
  })
  it('preserves legacy reads and notification mutations', async () => {
    await expect(getNotifications()).resolves.toEqual({ ok: true })
    await getUnreadNotificationsCount()
    await markNotificationsAsRead([12, 34])
    await deleteNotification(12)
    expect(mocks.legacy.get).toHaveBeenCalledWith('/notifications')
    expect(mocks.legacy.get).toHaveBeenCalledWith('/notifications/unread-count')
    expect(mocks.legacy.post).toHaveBeenCalledWith('/notifications/mark-read', {
      notification_ids: [12, 34]
    })
    expect(mocks.legacy.delete).toHaveBeenCalledWith('/notifications/12')
  })

  it.each([
    [null, false],
    ['worker-session', true]
  ])(
    'rejects unavailable notifications before selecting a transport (%s)',
    async (token, isWorkerSession) => {
      Object.assign(mocks.auth, { token, isWorkerSession })
      await expect(getNotifications()).rejects.toThrow('Уведомления недоступны')
      expect(mocks.getApi).not.toHaveBeenCalled()
      expect(mocks.worker.get).not.toHaveBeenCalled()
    }
  )

  it('does not issue a request when the account changes while resolving the API', async () => {
    mocks.getApi.mockImplementation(async () => {
      mocks.auth.token = 'another-session'
      return mocks.legacy
    })
    await expect(getNotifications()).rejects.toThrow('Аккаунт изменился')
    expect(mocks.legacy.get).not.toHaveBeenCalled()
  })

  it('discards a response received after the account changes', async () => {
    mocks.legacy.get.mockImplementation(async () => {
      mocks.auth.token = 'another-session'
      return { data: { ok: true } }
    })
    await expect(getNotifications()).rejects.toThrow('Аккаунт изменился')
  })
})
