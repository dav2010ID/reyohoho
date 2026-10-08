import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let auth, api
const session = `rh1_${'a'.repeat(43)}`
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_WORKER_AUTH_ENABLED', 'true')
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/store/auth')
  auth = useAuthStore()
  auth.setToken(session)
  auth.setUser({ id: '123' })
  api = await import('./workerAccount')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Worker account routing', () => {
  it('explains service unavailability without exposing backend terminology', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response('{}', { status: 503 })))
    await expect(api.workerAccountRequest('/user')).rejects.toThrow(
      'Сервис аккаунта временно недоступен. Попробуйте позже.'
    )
  })
  it('recognizes own sessions and sends them only to the fixed custom domain', async () => {
    const fetchMock = vi.fn(async () => new globalThis.Response('{"id":"123"}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(auth.isWorkerSession).toBe(true)
    expect(await api.workerAccountRequest('/user')).toEqual({ id: '123' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.reyhoho.fun/api/user')
    expect(options.headers.Authorization).toBe(`Bearer ${session}`)
    expect(url).not.toContain(session)
    expect(options.credentials).toBe('omit')
    expect(options.redirect).toBe('error')
    await expect(api.workerAccountRequest('//evil.example/user')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('uses POST JSON for browser polling and omits existing account credentials', async () => {
    const fetchMock = vi.fn(async () => new globalThis.Response('{"authenticated":false}'))
    vi.stubGlobal('fetch', fetchMock)
    await api.workerAccountRequest('/auth/check-telegram-auth', 'POST', { token: 'temporary-challenge' }, { anonymous: true })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).not.toContain('temporary-challenge')
    expect(options.method).toBe('POST')
    expect(options.body).toContain('temporary-challenge')
    expect(options.headers).not.toHaveProperty('Authorization')
  })
  it('rejects late results after account switch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      auth.setToken('other-session')
      return new globalThis.Response('{"id":"123"}')
    }))
    await expect(api.workerAccountRequest('/user')).rejects.toThrow('Аккаунт изменился')
  })
  it('does not send legacy tokens to the Worker account endpoints', async () => {
    auth.setToken('legacy-token')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(auth.isWorkerSession).toBe(false)
    await expect(api.workerAccountRequest('/user')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
