import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  top: vi.fn(),
  local: vi.fn(),
  loadProvider: vi.fn(),
  store: { contentApiProvider: 'kinobox' }
}))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.store }))
vi.mock('@/api/providerRegistry', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProvider: mocks.loadProvider
}))
import { getMovies } from './movies'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.store.contentApiProvider = 'kinobox'
  mocks.top.mockResolvedValue([])
  mocks.local.mockResolvedValue([])
  mocks.loadProvider.mockImplementation(async (provider) => {
    if (provider === 'kinobox') return { getTopMovies: mocks.top }
    if (provider === 'local') return { getMovies: mocks.local }
    throw new Error('Unexpected provider')
  })
})

describe('top list dispatch', () => {
  it.each(['kinobox', 'ddbb', 'local'])('uses the fixed Kinopoisk top through the shared proxy (%s)', async (provider) => {
    mocks.store.contentApiProvider = provider
    const options = { typeFilter: 'series', page: 2, limit: 36 }
    expect(await getMovies(options)).toEqual([])
    expect(mocks.top).toHaveBeenCalledWith(options)
    expect(mocks.loadProvider).toHaveBeenCalledWith('kinobox')
  })
})
