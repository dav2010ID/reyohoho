import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ddbb: vi.fn(),
  kinobox: vi.fn(),
  loadProvider: vi.fn(),
  analytics: vi.fn(),
  store: { contentApiProvider: 'kinobox' }
}))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.store }))
vi.mock('@/utils/analytics', () => ({ trackAnalyticsEvent: mocks.analytics }))
vi.mock('@/api/providerRegistry', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProvider: mocks.loadProvider
}))

import { getPlayers } from './movies'

const primary = { 'DDBB>Alloha': { iframe: 'https://primary.test/301' } }
const fallback = { 'KINOBOX>Alloha': { iframe: 'https://fallback.test/301' } }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.store.contentApiProvider = 'kinobox'
  mocks.loadProvider.mockImplementation(async (provider) => {
    if (provider === 'ddbb') return { getPlayers: mocks.ddbb }
    if (provider === 'kinobox') return { getPlayers: mocks.kinobox }
    throw new Error('Unexpected provider: ' + provider)
  })
  mocks.kinobox.mockResolvedValue(fallback)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('player fallback chain', () => {
  it('returns DDBB only without requesting Kinobox when DDBB has players', async () => {
    mocks.ddbb.mockResolvedValue(primary)
    expect(await getPlayers(301)).toEqual(primary)
    expect(mocks.kinobox).not.toHaveBeenCalled()
    expect(mocks.loadProvider).toHaveBeenCalledTimes(1)
  })

  it('does not start Kinobox while DDBB is still pending', async () => {
    let resolve
    mocks.ddbb.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const result = getPlayers(301)
    await vi.waitFor(() => expect(mocks.ddbb).toHaveBeenCalled())
    expect(mocks.kinobox).not.toHaveBeenCalled()
    resolve(primary)
    expect(await result).toEqual(primary)
  })

  it('uses Kinobox after an empty DDBB response and forwards options', async () => {
    mocks.ddbb.mockResolvedValue({})
    const options = { mode: 'kp_id' }
    expect(await getPlayers(301, options)).toEqual(fallback)
    expect(mocks.kinobox).toHaveBeenCalledWith(301, options)
  })

  it('uses Kinobox after a DDBB error', async () => {
    mocks.ddbb.mockRejectedValue(new Error('Connection failed'))
    expect(await getPlayers(301)).toEqual(fallback)
  })

  it('uses Kinobox after the DDBB timeout', async () => {
    vi.useFakeTimers()
    mocks.ddbb.mockReturnValue(new Promise(() => {}))
    const result = getPlayers(301)
    await vi.advanceTimersByTimeAsync(15000)
    expect(await result).toEqual(fallback)
    expect(mocks.analytics).toHaveBeenCalledWith(
      'player_provider_timeout',
      expect.objectContaining({ source: 'ddbb', status: 'timeout' })
    )
  })

  it('returns an empty list when neither source has players', async () => {
    mocks.ddbb.mockResolvedValue({})
    mocks.kinobox.mockResolvedValue({})
    expect(await getPlayers(301)).toEqual({})
  })
})
