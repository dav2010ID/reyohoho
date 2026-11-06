import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ddbb: vi.fn(),
  live: vi.fn(),
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
    if (provider === 'ddbb_live') return { getPlayers: mocks.live }
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
  it('requests selected DDBB Live immediately without loading DDBB', async () => {
    mocks.store.contentApiProvider = 'ddbb_live'
    mocks.live.mockResolvedValue(primary)

    expect(await getPlayers(301)).toEqual(primary)
    expect(mocks.live).toHaveBeenCalledWith(
      301,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(mocks.loadProvider.mock.calls.map(([provider]) => provider)).toEqual(['ddbb_live'])
    expect(mocks.ddbb).not.toHaveBeenCalled()
    expect(mocks.kinobox).not.toHaveBeenCalled()
  })

  it('falls back from DDBB Live to Kinobox without requesting DDBB', async () => {
    mocks.store.contentApiProvider = 'ddbb_live'
    mocks.live.mockRejectedValue(new Error('Live unavailable'))

    expect(await getPlayers(301)).toEqual(fallback)
    expect(mocks.loadProvider.mock.calls.map(([provider]) => provider)).toEqual([
      'ddbb_live',
      'kinobox'
    ])
    expect(mocks.ddbb).not.toHaveBeenCalled()
  })

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
    expect(mocks.kinobox).toHaveBeenCalledWith(
      301,
      expect.objectContaining({ mode: options.mode, signal: expect.any(AbortSignal) })
    )
  })

  it('uses Kinobox after a DDBB error', async () => {
    mocks.ddbb.mockRejectedValue(new Error('Connection failed'))
    expect(await getPlayers(301)).toEqual(fallback)
  })

  it('uses Kinobox after the DDBB timeout', async () => {
    vi.useFakeTimers()
    let signal
    mocks.ddbb.mockImplementation((_id, options) => {
      signal = options.signal
      return new Promise(() => {})
    })
    const result = getPlayers(301)
    await vi.advanceTimersByTimeAsync(15000)
    expect(await result).toEqual(fallback)
    expect(signal.aborted).toBe(true)
    expect(mocks.analytics).toHaveBeenCalledWith(
      'player_provider_timeout',
      expect.objectContaining({ source: 'ddbb', status: 'timeout' })
    )
  })

  it('propagates caller cancellation without falling back', async () => {
    const controller = new AbortController()
    let providerSignal
    mocks.ddbb.mockImplementation((_id, options) => {
      providerSignal = options.signal
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
        )
      })
    })

    const result = getPlayers(301, { signal: controller.signal })
    await vi.waitFor(() => expect(mocks.ddbb).toHaveBeenCalled())
    controller.abort()

    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(providerSignal.aborted).toBe(true)
    expect(mocks.kinobox).not.toHaveBeenCalled()
  })

  it('keeps concurrent same-title requests independently cancellable', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const pending = []
    mocks.ddbb.mockImplementation((_id, options) =>
      new Promise((resolve, reject) => {
        pending.push({ options, resolve, reject })
        options.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
        )
      })
    )

    const first = getPlayers(301, { signal: firstController.signal })
    const second = getPlayers(301, { signal: secondController.signal })
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    firstController.abort()
    pending[1].resolve(primary)

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).resolves.toEqual(primary)
    expect(pending[0].options.signal).not.toBe(pending[1].options.signal)
    expect(pending[0].options.signal.aborted).toBe(true)
    expect(pending[1].options.signal.aborted).toBe(false)
    expect(mocks.kinobox).not.toHaveBeenCalled()
  })

  it('returns an empty list when neither source has players', async () => {
    mocks.ddbb.mockResolvedValue({})
    mocks.kinobox.mockResolvedValue({})
    expect(await getPlayers(301)).toEqual({})
  })
})
