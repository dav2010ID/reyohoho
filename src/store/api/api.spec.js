import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCAL_API_URL, useApiStore } from './index'

vi.mock('@/api/axios', () => ({ resetApi: vi.fn() }))

describe('API backend selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('keeps the local backend selected when its health check succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const store = useApiStore()

    await store.setBackendMode('local')

    expect(store.backendMode).toBe('local')
    expect(store.backendModeUserSelected).toBe(true)
    expect(store.currentApiUrl).toBe(LOCAL_API_URL)
    expect(store.localApiHealthy).toBe(true)
    expect(fetch).toHaveBeenCalledWith(`${LOCAL_API_URL}/health`, expect.any(Object))
  })

  it('does not silently replace an unavailable manually selected local backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const store = useApiStore()

    await store.setBackendMode('local')

    expect(store.currentApiUrl).toBe(LOCAL_API_URL)
    expect(store.localApiHealthy).toBe(false)
  })

  it('keeps automatic and explicit local backend choices distinguishable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const store = useApiStore()

    await store.setBackendMode('local', { userSelected: false })

    expect(store.backendMode).toBe('local')
    expect(store.backendModeUserSelected).toBe(false)
  })

  it('returns to automatic endpoint selection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const store = useApiStore()
    const remoteEndpoint = { url: 'https://api.example.com', description: 'Remote' }
    store.setAvailableEndpoints([remoteEndpoint])

    await store.setBackendMode('local')
    await store.setBackendMode('auto')

    expect(store.backendMode).toBe('auto')
    expect(store.currentApiUrl).toBe(remoteEndpoint.url)
    expect(store.localApiHealthy).toBe(null)
  })
})
