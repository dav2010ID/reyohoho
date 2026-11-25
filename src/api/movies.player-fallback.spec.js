import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ddbb: vi.fn(),
  live: vi.fn(),
  loadProvider: vi.fn(),
  analytics: vi.fn(),
  store: { contentApiProvider: 'ddbb_live' }
}))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.store }))
vi.mock('@/utils/analytics', () => ({ trackAnalyticsEvent: mocks.analytics }))
vi.mock('@/api/providerRegistry', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProvider: mocks.loadProvider
}))

let getPlayers

const primary = { 'DDBB LIVE>Alloha': { iframe: 'https://primary.test/301' } }
const fallback = { 'DDBB>Alloha': { iframe: 'https://fallback.test/301' } }
const loaded = () => mocks.loadProvider.mock.calls.map(([provider]) => provider)

beforeEach(async () => {
  vi.resetModules()
  ;({ getPlayers } = await import('./movies'))
  vi.resetAllMocks()
  mocks.store.contentApiProvider = 'ddbb_live'
  mocks.loadProvider.mockImplementation(async (provider) => {
    if (provider === 'ddbb') return { getPlayers: mocks.ddbb }
    if (provider === 'ddbb_live') return { getPlayers: mocks.live }
    throw new Error('Unexpected provider: ' + provider)
  })
  mocks.live.mockResolvedValue({})
  mocks.ddbb.mockResolvedValue(fallback)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('player fallback chain', () => {
  it('tries DDBB Live first by default and stops when it has players', async () => {
    mocks.live.mockResolvedValue(primary)
    expect(await getPlayers(301)).toEqual(primary)
    expect(mocks.live).toHaveBeenCalledWith(
      301,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(loaded()).toEqual(['ddbb_live'])
    expect(mocks.ddbb).not.toHaveBeenCalled()
  })

  it('treats a retired persisted source as the default', async () => {
    mocks.store.contentApiProvider = 'kinobox'
    mocks.live.mockResolvedValue(primary)
    expect(await getPlayers(301)).toEqual(primary)
    expect(loaded()).toEqual(['ddbb_live'])
  })

  it('starts with DDBB when it is chosen and falls back to DDBB Live', async () => {
    mocks.store.contentApiProvider = 'ddbb'
    mocks.ddbb.mockRejectedValue(new Error('Connection failed'))
    mocks.live.mockResolvedValue(primary)
    expect(await getPlayers(301)).toEqual(primary)
    expect(loaded()).toEqual(['ddbb', 'ddbb_live'])
  })

  it('uses DDBB after a DDBB Live error', async () => {
    mocks.live.mockRejectedValue(new Error('Live unavailable'))
    expect(await getPlayers(301)).toEqual(fallback)
    expect(loaded()).toEqual(['ddbb_live', 'ddbb'])
  })

  it('uses DDBB after an empty DDBB Live response and forwards options', async () => {
    const options = { mode: 'kp_id' }
    expect(await getPlayers(301, options)).toEqual(fallback)
    expect(mocks.ddbb).toHaveBeenCalledWith(
      301,
      expect.objectContaining({ mode: options.mode, signal: expect.any(AbortSignal) })
    )
  })

  it('does not start DDBB while DDBB Live is still pending', async () => {
    let resolve
    mocks.live.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const result = getPlayers(301)
    await vi.waitFor(() => expect(mocks.live).toHaveBeenCalled())
    expect(mocks.ddbb).not.toHaveBeenCalled()
    resolve(primary)
    expect(await result).toEqual(primary)
  })

  it('starts DDBB while DDBB Live is stalled and aborts the losing request', async () => {
    vi.useFakeTimers()
    let signal
    mocks.live.mockImplementation((_id, options) => {
      signal = options.signal
      return new Promise(() => {})
    })
    const result = getPlayers(301)
    await vi.advanceTimersByTimeAsync(1999)
    expect(mocks.ddbb).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toEqual(fallback)
    expect(signal.aborted).toBe(true)
    expect(mocks.analytics).not.toHaveBeenCalledWith(
      'player_provider_timeout',
      expect.objectContaining({ source: 'ddbb_live', status: 'timeout' })
    )
  })

  it('bounds the wait even when every provider hangs', async () => {
    vi.useFakeTimers()
    for (const mock of [mocks.live, mocks.ddbb])
      mock.mockImplementation(() => new Promise(() => {}))
    const result = getPlayers(301)
    await vi.advanceTimersByTimeAsync(12000)
    expect(await result).toEqual({})
    expect(
      mocks.analytics.mock.calls.filter(([event]) => event === 'player_provider_timeout')
    ).toHaveLength(2)
  })

  it('skips a failed source on the next film but allows an explicit retry', async () => {
    mocks.live.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(primary)
    expect(await getPlayers(301)).toEqual(fallback)
    expect(await getPlayers(302)).toEqual(fallback)
    expect(mocks.live).toHaveBeenCalledTimes(1)
    expect(await getPlayers(302, { retryProviders: true })).toEqual(primary)
  })

  it('propagates caller cancellation without falling back', async () => {
    const controller = new AbortController()
    let providerSignal
    mocks.live.mockImplementation((_id, options) => {
      providerSignal = options.signal
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
        )
      })
    })

    const result = getPlayers(301, { signal: controller.signal })
    await vi.waitFor(() => expect(mocks.live).toHaveBeenCalled())
    controller.abort()

    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(providerSignal.aborted).toBe(true)
    expect(mocks.ddbb).not.toHaveBeenCalled()
  })

  it('keeps concurrent same-title requests independently cancellable', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const pending = []
    mocks.live.mockImplementation(
      (_id, options) =>
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
    expect(mocks.ddbb).not.toHaveBeenCalled()
  })

  it('returns an empty list when no source has players', async () => {
    mocks.ddbb.mockResolvedValue({})
    expect(await getPlayers(301)).toEqual({})
  })
})
