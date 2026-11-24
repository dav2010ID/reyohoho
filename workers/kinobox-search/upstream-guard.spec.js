// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BREAKER_FAILURES,
  BREAKER_OPEN_MS,
  guardUpstream,
  resetUpstreamGuards
} from './upstream-guard.mjs'

describe('upstream guard', () => {
  let now
  const clock = () => now
  beforeEach(() => {
    now = 1_000_000
    resetUpstreamGuards()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())
  const fail = () => Promise.reject(new Error('connect timeout'))

  it('opens after repeated failures, skips the upstream, then tries again', async () => {
    for (let i = 0; i < BREAKER_FAILURES; i += 1)
      await expect(guardUpstream('kinopoisk', {}, fail, clock)).rejects.toThrow('connect timeout')
    const run = vi.fn(async () => ({ status: 200 }))
    await expect(guardUpstream('kinopoisk', {}, run, clock)).rejects.toMatchObject({
      reason: 'circuit_open'
    })
    expect(run).not.toHaveBeenCalled()
    // Other upstreams are unaffected.
    await expect(guardUpstream('kinobox', {}, run, clock)).resolves.toEqual({ status: 200 })
    now += BREAKER_OPEN_MS + 1
    await expect(guardUpstream('kinopoisk', {}, run, clock)).resolves.toEqual({ status: 200 })
  })
  it('counts 5xx answers but not missing titles', async () => {
    const notFound = () => Promise.reject(Object.assign(new Error('404'), { upstreamStatus: 404 }))
    for (let i = 0; i < BREAKER_FAILURES * 2; i += 1)
      await expect(guardUpstream('kinopoisk', {}, notFound, clock)).rejects.toThrow('404')
    const ok = vi.fn(async () => ({ status: 200 }))
    await guardUpstream('kinopoisk', {}, ok, clock)
    expect(ok).toHaveBeenCalled()
    for (let i = 0; i < BREAKER_FAILURES; i += 1)
      await guardUpstream('kinobox', {}, async () => ({ status: 503 }), clock)
    await expect(guardUpstream('kinobox', {}, ok, clock)).rejects.toMatchObject({
      reason: 'circuit_open'
    })
  })
  it('opens on throttling answered as a 429 response', async () => {
    for (let i = 0; i < BREAKER_FAILURES; i += 1)
      await guardUpstream('kinobox', {}, async () => ({ status: 429 }), clock)
    await expect(
      guardUpstream('kinobox', {}, async () => ({ status: 200 }), clock)
    ).rejects.toMatchObject({ reason: 'circuit_open' })
  })
  it('honours the shared upstream budget and the Kinobox kill switch', async () => {
    const run = vi.fn(async () => ({ status: 200 }))
    const limiter = { limit: vi.fn(async () => ({ success: false })) }
    await expect(
      guardUpstream('kinopoisk', { UPSTREAM_RATE_LIMITER: limiter }, run, clock)
    ).rejects.toMatchObject({ reason: 'upstream_budget' })
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'upstream:kinopoisk' })
    const broken = { limit: vi.fn(async () => { throw new Error('binding') }) }
    await expect(
      guardUpstream('kinopoisk', { UPSTREAM_RATE_LIMITER: broken }, run, clock)
    ).resolves.toEqual({ status: 200 })
    await expect(
      guardUpstream('kinobox', { KINOBOX_TRANSPORT: 'off' }, run, clock)
    ).rejects.toMatchObject({ reason: 'disabled' })
    expect(run).toHaveBeenCalledTimes(1)
  })
})
