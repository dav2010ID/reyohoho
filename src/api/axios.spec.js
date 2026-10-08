import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  axiosCreate: vi.fn(),
  getCurrentApiUrl: vi.fn(),
  apiStore: {
    currentApiUrl: null,
    getCurrentApiDescription: vi.fn(() => 'Test API'),
    isCheckingHealth: false,
    lastCheckedAt: null,
    availableEndpoints: []
  },
  authStore: { token: null }
}))

vi.mock('axios', () => ({ default: { create: mocks.axiosCreate } }))
vi.mock('@/firebase/firebase', () => ({ getCurrentApiUrl: mocks.getCurrentApiUrl }))
vi.mock('@/store/api', () => ({ useApiStore: () => mocks.apiStore }))
vi.mock('@/store/auth', () => ({ useAuthStore: () => mocks.authStore }))

const createDeferred = () => {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const createAxiosInstance = (baseURL) => ({
  defaults: { baseURL, headers: { common: {} } },
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
})

describe('dynamic axios instance', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.apiStore.currentApiUrl = null
    mocks.authStore.token = null
    mocks.axiosCreate.mockImplementation(({ baseURL }) => createAxiosInstance(baseURL))
    const { resetApi } = await import('./axios')
    resetApi()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('never forwards a Worker bearer session to the legacy backend', async () => {
    vi.stubEnv('VITE_APP_API_URL', 'https://legacy.example')
    mocks.getCurrentApiUrl.mockResolvedValue('https://legacy.example')
    mocks.authStore.token = `rh1_${'a'.repeat(43)}`
    const { getApi } = await import('./axios')
    const instance = await getApi()
    const interceptor = instance.interceptors.request.use.mock.calls[0][0]
    const config = await interceptor({ url: '/user', headers: { Authorization: 'old-value' } })
    expect(config.headers).not.toHaveProperty('Authorization')
  })

  it('does not restore a stale endpoint after resetApi', async () => {
    const staleResolution = createDeferred()
    mocks.getCurrentApiUrl
      .mockImplementationOnce(() => staleResolution.promise)
      .mockResolvedValueOnce('https://new-api.example')
    const { getApi, resetApi } = await import('./axios')

    const staleRequest = getApi()
    resetApi()
    const freshInstance = await getApi()
    staleResolution.resolve('https://stale-api.example')

    expect(await staleRequest).toBe(freshInstance)
    expect(freshInstance.defaults.baseURL).toBe('https://new-api.example')
    expect(mocks.axiosCreate).toHaveBeenCalledTimes(1)
  })
})
