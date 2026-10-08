import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let api, auth, main
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_CLOUD_HISTORY_ENABLED', 'true')
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/store/auth')
  const { useMainStore } = await import('@/store/main')
  auth = useAuthStore()
  main = useMainStore()
  auth.setToken('private-token')
  auth.setUser({ id: 11 })
  api = await import('./cloudHistory')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('cloud history client', () => {
  it('requires opt-in for this account and disables on logout or token change', () => {
    expect(api.isCloudHistoryEnabled()).toBe(false)
    main.cloudHistoryAccount = '11'
    expect(api.isCloudHistoryEnabled()).toBe(true)
    auth.setUser({ id: 22 })
    expect(api.isCloudHistoryEnabled()).toBe(false)
    auth.setUser({ id: 11 })
    auth.setToken('replacement')
    expect(main.cloudHistoryAccount).toBeNull()
    main.cloudHistoryAccount = '11'
    auth.logout()
    expect(api.isCloudHistoryEnabled()).toBe(false)
    expect(main.cloudHistoryAccount).toBeNull()
  })
  it('sends credentials only to the fixed custom-domain API and whitelists import data', async () => {
    const fetchMock = vi.fn(async (_url, options) => new globalThis.Response(JSON.stringify(
      options.method === 'GET' ? { history: [] } : { ok: true }
    ), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await api.importCloudHistory([{ kp_id: 301, title: 'Матрица', token: 'secret' }])
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.reyhoho.fun/api/history/import')
    const options = fetchMock.mock.calls[0][1]
    expect(options.headers.Authorization).toBe('Bearer private-token')
    expect(options.body).not.toContain('secret')
    expect(options.redirect).toBe('error')
    expect(options.credentials).toBe('omit')
  })
  it('rejects responses on account switch without changing local history', async () => {
    main.setHistory([{ kp_id: 301 }])
    vi.stubGlobal('fetch', vi.fn(async () => {
      auth.logout()
      return new globalThis.Response('{"history":[{"kp_id":42}]}')
    }))
    await expect(api.historyRequest()).rejects.toThrow('Аккаунт изменился')
    expect(main.history).toEqual([{ kp_id: 301 }])
  })
  it('keeps local data when storage is unavailable', async () => {
    main.setHistory([{ kp_id: 301 }])
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response('{}', { status: 503 })))
    await expect(api.historyRequest()).rejects.toThrow('Локальная история сохранена')
    expect(main.history).toEqual([{ kp_id: 301 }])
  })
})
