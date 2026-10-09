import { describe, expect, it, vi } from 'vitest'
import { createPublicDataCache } from './publicDataCache'

describe('public provider cache', () => {
  it('deduplicates simultaneous calls and returns independent objects', async () => {
    const cache = createPublicDataCache()
    const load = vi.fn(async () => ({ title: 'Matrix', lists: [] }))
    const [a, b] = await Promise.all([
      cache('movie:301', load, 1000),
      cache('movie:301', load, 1000)
    ])
    a.lists.push('favorite')
    expect(b.lists).toEqual([])
    expect((await cache('movie:301', load, 1000)).lists).toEqual([])
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('expires entries and evicts the least recently used entry', async () => {
    let time = 0
    const cache = createPublicDataCache({ maxEntries: 2, now: () => time })
    const load = vi.fn(async () => ({}))
    await cache('a', load, 100)
    await cache('b', load, 100)
    await cache('a', load, 100)
    await cache('c', load, 100)
    await cache('b', load, 100)
    expect(load).toHaveBeenCalledTimes(4)
    time = 101
    await cache('b', load, 100)
    expect(load).toHaveBeenCalledTimes(5)
  })
  it('does not cache failures, invalid or oversized payloads', async () => {
    const cache = createPublicDataCache({ maxBytes: 20 })
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ title: 'very large movie title' })
    await expect(cache('a', load, 100)).rejects.toThrow('offline')
    await cache('a', load, 100)
    await cache('a', load, 100)
    expect(load).toHaveBeenCalledTimes(3)
    const invalid = vi.fn(async () => ({}))
    await cache('b', invalid, 100, { validate: () => false })
    await cache('b', invalid, 100, { validate: () => false })
    expect(invalid).toHaveBeenCalledTimes(2)
  })
  it('keeps signal-owned transports separate and rejects an already aborted caller', async () => {
    const cache = createPublicDataCache()
    const controller = new AbortController()
    const load = vi.fn(async () => ({}))
    await Promise.all([cache('a', load, 100, { signal: controller.signal }), cache('a', load, 100)])
    expect(load).toHaveBeenCalledTimes(2)
    controller.abort()
    await expect(cache('a', load, 100, { signal: controller.signal })).rejects.toMatchObject({
      code: 'ERR_CANCELED'
    })
  })
  it('bypasses shared state for SSR or customized requests', async () => {
    const cache = createPublicDataCache()
    const load = vi.fn(async () => ({}))
    await cache('a', load, 100, { bypass: true })
    await cache('a', load, 100, { bypass: true })
    expect(load).toHaveBeenCalledTimes(2)
  })
})
