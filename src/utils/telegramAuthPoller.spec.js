import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTelegramAuthPoller } from './telegramAuthPoller'

const deferred = () => {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('Telegram auth poller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not overlap slow auth checks', async () => {
    const pending = deferred()
    const checkAuth = vi.fn(() => pending.promise)
    const poller = createTelegramAuthPoller({ checkAuth, intervalMs: 1000 })

    poller.start('login-token')
    await vi.advanceTimersByTimeAsync(3000)
    expect(checkAuth).toHaveBeenCalledTimes(1)

    pending.resolve({ authenticated: false })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(checkAuth).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('stops after successful authentication', async () => {
    const onAuthenticated = vi.fn()
    const poller = createTelegramAuthPoller({
      checkAuth: vi.fn().mockResolvedValue({ authenticated: true, token: 'access-token' }),
      onAuthenticated,
      intervalMs: 1000
    })

    poller.start('login-token')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(onAuthenticated).toHaveBeenCalledOnce()
    expect(onAuthenticated).toHaveBeenCalledWith('access-token')
    expect(poller.isActive()).toBe(false)
  })

  it('expires and stops polling', async () => {
    const onExpired = vi.fn()
    const checkAuth = vi.fn().mockResolvedValue({ authenticated: false })
    const poller = createTelegramAuthPoller({
      checkAuth,
      onExpired,
      intervalMs: 1000
    })

    poller.start('login-token', 1)
    await vi.advanceTimersByTimeAsync(1000)

    expect(onExpired).toHaveBeenCalledOnce()
    expect(checkAuth).not.toHaveBeenCalled()
    expect(poller.isActive()).toBe(false)
  })
})
