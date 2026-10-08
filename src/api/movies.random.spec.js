import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  random: vi.fn(),
  local: vi.fn(),
  backend: vi.fn(),
  loadProvider: vi.fn(),
  store: { contentApiProvider: 'kinobox' }
}))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.store }))
vi.mock('@/api/providerRegistry', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProvider: mocks.loadProvider
}))
import { getRandomMovie } from './movies'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.store.contentApiProvider = 'kinobox'
  mocks.random.mockResolvedValue({ kp_id: 301, title: 'Матрица' })
  mocks.loadProvider.mockImplementation(async (provider) => {
    if (provider === 'kinobox') return { getRandomMovie: mocks.random }
    if (provider === 'local') return { getRandomMovie: mocks.local }
    if (provider === 'backend') return { getRandomMovie: mocks.backend }
    throw new Error('Unexpected provider')
  })
})

describe('random film routing', () => {
  it.each(['kinobox', 'ddbb', 'ddbb_live', 'kinobd'])(
    'uses the proxy for %s without the legacy backend',
    async (provider) => {
      mocks.store.contentApiProvider = provider
      const signal = new AbortController().signal
      expect(await getRandomMovie({ signal })).toMatchObject({ kp_id: 301 })
      expect(mocks.random).toHaveBeenCalledWith({ signal })
      expect(mocks.loadProvider).toHaveBeenCalledTimes(1)
      expect(mocks.loadProvider).toHaveBeenCalledWith('kinobox')
    }
  )
  it.each(['local', 'backend'])('preserves explicitly selected %s /chance', async (provider) => {
    mocks.store.contentApiProvider = provider
    mocks[provider].mockResolvedValue({ kp_id: 42 })
    expect(await getRandomMovie()).toEqual({ kp_id: 42 })
    expect(mocks.random).not.toHaveBeenCalled()
  })
  it('does not fall back to an unconfigured backend on proxy errors or cancellation', async () => {
    const error = Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' })
    mocks.random.mockRejectedValue(error)
    await expect(getRandomMovie()).rejects.toBe(error)
    expect(mocks.backend).not.toHaveBeenCalled()
  })
})
