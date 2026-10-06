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
  it('uses the fixed Kinopoisk top through the shared proxy for remote mode', async () => {
    const options = { typeFilter: 'series', page: 2, limit: 36 }
    expect(await getMovies(options)).toEqual([])
    expect(mocks.top).toHaveBeenCalledWith(options)
    expect(mocks.loadProvider).toHaveBeenCalledWith('kinobox')
  })
  it('preserves local backend list requests', async () => {
    mocks.store.contentApiProvider = 'local'
    const options = { activeTime: '7d', typeFilter: 'all' }
    await getMovies(options)
    expect(mocks.local).toHaveBeenCalledWith(options)
    expect(mocks.top).not.toHaveBeenCalled()
  })
  it('does not misrepresent a rating top as local popularity when local fails', async () => {
    mocks.store.contentApiProvider = 'local'
    mocks.local.mockRejectedValue(new Error('Unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await expect(getMovies({ activeTime: '7d' })).rejects.toThrow('Unavailable')
      expect(mocks.top).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
