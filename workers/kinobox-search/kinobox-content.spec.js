// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'
import { serveKinoboxContent } from './kinobox-content.mjs'
import { resolveKinoboxResource } from './routes.mjs'

let time, entries, cache
const headers = {
  'X-Worker-Version': 'test',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://reyhoho.fun'
}
const upstream = (status = 200, data = { data: { movie: { id: 301 } } }) => ({
  status,
  headers: {},
  body: Buffer.from(JSON.stringify(data)),
  tls: { selectedAlpn: 'h2', version: 'TLS1.3' }
})
const serve = (load, path = '/api/movies/301', h = headers, budget) => {
  const url = new URL(path, 'https://api.reyhoho.fun')
  return serveKinoboxContent(resolveKinoboxResource(url), url, h, cache, load, budget)
}
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  time = 0
  vi.spyOn(Date, 'now').mockImplementation(() => time)
  entries = new Map()
  cache = {
    match: vi.fn(async (key) => {
      const e = entries.get(key)
      return e && e.expires > time ? e.response.clone() : undefined
    }),
    put: vi.fn(async (key, response) =>
      entries.set(key, {
        response,
        expires: time + Number(response.headers.get('Cache-Control').split('=')[1]) * 1000
      })
    ),
    delete: vi.fn(async (key) => entries.delete(key))
  }
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
describe('Kinobox public caching', () => {
  it('retries a stream reset once and charges both upstream attempts', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP/2 RST_STREAM: 1'))
      .mockResolvedValue(upstream())
    const budget = vi.fn(async () => null)
    const response = await serve(load, undefined, headers, budget)
    expect(response.status).toBe(200)
    expect(load).toHaveBeenCalledTimes(2)
    expect(budget).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[1][1].timeoutMs).toBeLessThanOrEqual(15000)
  })
  it('does not retry other transport errors', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Certificate verification failed'))
    expect((await serve(load)).status).toBe(502)
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('stops after a second reset', async () => {
    const load = vi.fn().mockRejectedValue(new Error('HTTP/2 RST_STREAM: 1'))
    expect((await serve(load)).status).toBe(502)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('does not bypass the upstream budget for retries', async () => {
    const load = vi.fn().mockRejectedValue(new Error('HTTP/2 RST_STREAM: 1'))
    const budget = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(new Response(null, { status: 429 }))
    expect((await serve(load, undefined, headers, budget)).status).toBe(429)
    expect(load).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['gzip', gzipSync],
    ['deflate', deflateSync],
    ['br', brotliCompressSync]
  ])('validates and caches bounded %s JSON as decoded text', async (encoding, compress) => {
    const reply = upstream()
    const load = vi.fn(async () => ({
      ...reply,
      headers: { 'content-encoding': encoding },
      body: compress(reply.body)
    }))
    const first = await serve(load)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual(JSON.parse(reply.body.toString()))
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(load).toHaveBeenCalledTimes(1)
  })
  it.each([Buffer.from('broken gzip'), gzipSync(Buffer.alloc(1024 * 1024 + 1, 32))])(
    'rejects corrupt or oversized decompressed payloads',
    async (body) => {
      const load = vi.fn(async () => ({
        ...upstream(),
        headers: { 'content-encoding': 'gzip' },
        body
      }))
      expect((await serve(load)).status).toBe(502)
      expect((await serve(load)).status).toBe(503)
      expect(load).toHaveBeenCalledTimes(1)
    }
  )
  it('adds a server-generated timestamp to players without changing the cache key', async () => {
    const load = vi.fn(async () => upstream(200, { data: [] }))
    expect((await serve(load, '/api/players?kinopoisk=301')).status).toBe(200)
    expect(load.mock.calls[0][0].params).toEqual({ kinopoisk: '301', ts: 0 })
  })

  it('charges cold upstream attempts, keeps hits free and denies without fetching', async () => {
    const load = vi.fn(async () => upstream())
    const budget = vi.fn(async () => null)
    expect((await serve(load, undefined, headers, budget)).status).toBe(200)
    expect((await serve(load, undefined, headers, budget)).status).toBe(200)
    expect(budget).toHaveBeenCalledTimes(1)
    const denied = vi.fn(async () => new Response('{}', { status: 429 }))
    expect((await serve(load, '/api/movies/302', headers, denied)).status).toBe(429)
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('never serves stale data during invalid-schema cooldown', async () => {
    const load = vi.fn().mockResolvedValueOnce(upstream()).mockResolvedValue(upstream(200, {}))
    await serve(load)
    time = 21600 * 1000 + 1
    expect((await serve(load)).status).toBe(502)
    expect((await serve(load)).status).toBe(503)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('serves MISS then HIT with request-specific CORS and no public client cache', async () => {
    const load = vi.fn(async () => upstream())
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('MISS')
    const hit = await serve(load, '/api/movies/301', {
      ...headers,
      'Access-Control-Allow-Origin': 'https://www.reyhoho.fun'
    })
    expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(hit.headers.get('Cache-Control')).toBe('no-store')
    expect(hit.headers.get('Access-Control-Allow-Origin')).toBe('https://www.reyhoho.fun')
    expect(load).toHaveBeenCalledTimes(1)
  })
  it.each([429, 500, 503])(
    'serves last good card on %s with a short retry backoff',
    async (status) => {
      const load = vi.fn().mockResolvedValueOnce(upstream()).mockResolvedValue(upstream(status))
      await serve(load)
      time = 21600 * 1000 + 1
      const stale = await serve(load)
      expect(stale.headers.get('X-Kinobox-Cache')).toBe('STALE')
      expect(await stale.json()).toEqual({ data: { movie: { id: 301 } } })
      expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('STALE')
      expect(load).toHaveBeenCalledTimes(2)
      time += 31000
      await serve(load)
      expect(load).toHaveBeenCalledTimes(3)
    }
  )
  it('bounds stale age and never caches an error as movie data', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(upstream())
      .mockRejectedValue(new Error('TCP timeout'))
    await serve(load)
    time = 48 * 3600 * 1000 + 1
    expect((await serve(load)).status).toBe(504)
    expect((await serve(load)).status).toBe(503)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('does not mask a definitive 404 or invalid JSON using stale data', async () => {
    const load = vi.fn().mockResolvedValueOnce(upstream()).mockResolvedValue(upstream(404))
    await serve(load)
    time = 21600 * 1000 + 1
    expect((await serve(load)).status).toBe(404)
    load.mockResolvedValue(upstream(200, {}))
    expect((await serve(load)).status).toBe(502)
  })
  it('collapses simultaneous cold requests in one isolate without sharing I/O promises', async () => {
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return upstream()
    })
    const replies = await Promise.all([serve(load), serve(load), serve(load)])
    expect(replies.map((r) => r.headers.get('X-Kinobox-Cache')).sort()).toEqual([
      'HIT',
      'HIT',
      'MISS'
    ])
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('continues to use the provider when the cache is unavailable', async () => {
    cache.match.mockRejectedValue(new Error('cache unavailable'))
    cache.put.mockRejectedValue(new Error('cache unavailable'))
    expect((await serve(async () => upstream())).status).toBe(200)
  })
})

describe('Kinobox cache bursts and failure recovery', () => {
  beforeEach(() => {
    // Keep the explicit Date.now clock used by the TTL cache; fake only polling timers.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  it('serves a warm burst with independent bodies and zero upstream attempts', async () => {
    const data = { data: { movie: { id: 301 } } }
    const load = vi.fn(async () => upstream(200, data))
    const budget = vi.fn(async () => null)
    await serve(load, undefined, headers, budget)
    load.mockClear()
    budget.mockClear()
    cache.match.mockClear()
    cache.put.mockClear()

    const replies = await Promise.all(
      Array.from({ length: 16 }, () => serve(load, undefined, headers, budget))
    )
    expect(replies.every((reply) => reply.headers.get('X-Kinobox-Cache') === 'HIT')).toBe(true)
    expect(await Promise.all(replies.map((reply) => reply.json()))).toEqual(
      Array.from({ length: 16 }, () => data)
    )
    expect(load).not.toHaveBeenCalled()
    expect(budget).not.toHaveBeenCalled()
    expect(cache.match).toHaveBeenCalledTimes(16)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('shares canonical paths and timestamps but isolates worker versions and request hosts', async () => {
    const load = vi.fn(async () => upstream())
    await serve(load, '/api/movies/301?ts=1')
    expect((await serve(load, '/api/movies/301/?ts=2')).headers.get('X-Kinobox-Cache')).toBe('HIT')
    const nextVersion = { ...headers, 'X-Worker-Version': 'test-v2' }
    expect((await serve(load, undefined, nextVersion)).headers.get('X-Kinobox-Cache')).toBe('MISS')
    const otherUrl = new URL('https://other-api.example/api/movies/301')
    const other = await serveKinoboxContent(
      resolveKinoboxResource(otherUrl),
      otherUrl,
      headers,
      cache,
      load
    )
    expect(other.headers.get('X-Kinobox-Cache')).toBe('MISS')
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('decodes and validates JSON once while preserving whitespace and large number literals', async () => {
    const body =
      ' \n{ "data": { "movie": { "id": 9007199254740993, "score": 1.2300e+2, "title": "Матрица" } } }\n\t'
    const buffer = Buffer.from(body)
    const decode = vi.spyOn(buffer, 'toString')
    const parse = vi.spyOn(JSON, 'parse')
    const load = vi.fn(async () => ({ ...upstream(), body: buffer }))
    const miss = await serve(load)
    expect(miss.headers.get('X-Kinobox-Cache')).toBe('MISS')
    expect(await miss.text()).toBe(body)
    expect(decode).toHaveBeenCalledExactlyOnceWith('utf8')
    expect(parse.mock.calls.filter(([text]) => text === body)).toHaveLength(1)
    for (const entry of entries.values()) expect(await entry.response.clone().text()).toBe(body)

    const hit = await serve(load)
    expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(await hit.text()).toBe(body)
    time = 21600 * 1000
    load.mockResolvedValue(upstream(503))
    const stale = await serve(load)
    expect(stale.headers.get('X-Kinobox-Cache')).toBe('STALE')
    expect(await stale.text()).toBe(body)
    expect(decode).toHaveBeenCalledTimes(1)
    expect(parse.mock.calls.filter(([text]) => text === body)).toHaveLength(1)
  })

  it('preserves the provider JSON text for a definitive isSuccess false response', async () => {
    const body = ' { "data": { "isSuccess": false, "id": 9007199254740993 } }\n'
    const reply = await serve(async () => ({ ...upstream(), body: Buffer.from(body) }))
    expect(reply.status).toBe(404)
    expect(await reply.text()).toBe(body)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('allows upstream calls for distinct cold keys to run concurrently', async () => {
    const fetch = deferred()
    let active = 0
    let peak = 0
    const load = vi.fn(async ({ path }) => {
      peak = Math.max(peak, ++active)
      await fetch.promise
      active--
      return upstream(200, { data: { movie: { id: Number(path.split('/').at(-1)) } } })
    })
    const pending = Promise.all(
      Array.from({ length: 8 }, (_, index) => serve(load, `/api/movies/${301 + index}`))
    )
    await vi.advanceTimersByTimeAsync(0)
    try {
      expect(load).toHaveBeenCalledTimes(8)
      expect(peak).toBe(8)
    } finally {
      fetch.resolve()
      await pending
    }
    expect((await pending).every((reply) => reply.headers.get('X-Kinobox-Cache') === 'MISS')).toBe(
      true
    )
  })

  it.each([
    ['movie', '/api/movies/301', { data: { movie: { id: 301 } } }, 21600],
    ['search', '/?query=Matrix', { data: { items: [{ id: 301 }] } }, 600],
    ['players', '/api/players?kinopoisk=301', { data: [{ type: 'player' }] }, 60]
  ])(
    'collapses a 16-request cold %s burst into one upstream attempt',
    async (_, path, data, ttl) => {
      let active = 0
      let peak = 0
      const load = vi.fn(async () => {
        peak = Math.max(peak, ++active)
        await new Promise((resolve) => setTimeout(resolve, 20))
        active--
        return upstream(200, data)
      })
      const budget = vi.fn(async () => null)
      const pending = Promise.all(
        Array.from({ length: 16 }, () => serve(load, path, headers, budget))
      )
      await vi.advanceTimersByTimeAsync(500)
      const replies = await pending

      expect(replies.map((reply) => reply.headers.get('X-Kinobox-Cache')).sort()).toEqual([
        ...Array(15).fill('HIT'),
        'MISS'
      ])
      expect(await Promise.all(replies.map((reply) => reply.json()))).toEqual(
        Array.from({ length: 16 }, () => data)
      )
      expect(load).toHaveBeenCalledTimes(1)
      expect(budget).toHaveBeenCalledTimes(1)
      expect(peak).toBe(1)
      const fresh = cache.put.mock.calls.find(([key]) => key.includes('/__kinobox-cache?'))
      expect(fresh[1].headers.get('Cache-Control')).toBe(`public, max-age=${ttl}`)
      const stale = cache.put.mock.calls.find(([key]) => key.includes('/__kinobox-stale?'))
      if (ttl === 21600) {
        expect(stale[1].headers.get('Cache-Control')).toBe('public, max-age=172800')
      } else {
        expect(stale).toBeUndefined()
      }
    }
  )

  it('holds the lease until both successful cache writes have finished', async () => {
    const write = deferred()
    const put = cache.put.getMockImplementation()
    cache.put.mockImplementation(async (...args) => {
      if (args[0].includes('/__kinobox-stale?')) await write.promise
      return put(...args)
    })
    const load = vi.fn(async () => upstream())
    let finished = false
    const leader = serve(load).then((reply) => {
      finished = true
      return reply
    })
    await vi.advanceTimersByTimeAsync(0)
    try {
      expect(finished).toBe(false)
      const replies = await Promise.all(Array.from({ length: 8 }, () => serve(load)))
      expect(replies.every((reply) => reply.headers.get('X-Kinobox-Cache') === 'HIT')).toBe(true)
      expect(load).toHaveBeenCalledTimes(1)
    } finally {
      write.resolve()
      await leader
    }
    expect(finished).toBe(true)
  })

  it.each([
    ['HTTP 429', () => upstream(429), 502, 'Upstream temporarily unavailable'],
    ['HTTP 500', () => upstream(500), 502, 'Upstream temporarily unavailable'],
    ['HTTP 503', () => upstream(503), 502, 'Upstream temporarily unavailable'],
    [
      'connection failure',
      () => {
        throw new Error('ECONNRESET')
      },
      502,
      'Upstream connection failed'
    ],
    [
      'timeout',
      () => {
        throw new Error('TCP timeout')
      },
      504,
      'Upstream timeout'
    ]
  ])(
    'backs off a cold burst after %s and recovers at the retry TTL',
    async (_, fail, status, error) => {
      const load = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return fail()
      })
      const pending = Promise.all(Array.from({ length: 8 }, () => serve(load)))
      await vi.advanceTimersByTimeAsync(500)
      const replies = await pending
      const first = replies.find((reply) => reply.headers.get('X-Kinobox-Cache') === 'MISS')
      expect(first.status).toBe(status)
      expect(await first.json()).toEqual({ error })
      expect(replies.filter((reply) => reply.status === 503)).toHaveLength(7)
      expect(replies.every((reply) => reply.headers.get('Retry-After') === '30')).toBe(true)
      expect(load).toHaveBeenCalledTimes(1)
      expect(cache.put).toHaveBeenCalledTimes(1)
      const [key, marker] = cache.put.mock.calls[0]
      expect(key).toContain('/__kinobox-retry?')
      expect(marker.headers.get('Cache-Control')).toBe('public, max-age=30')
      expect(await marker.clone().text()).toBe('{}')

      time = 29999
      expect((await serve(load)).status).toBe(503)
      expect(load).toHaveBeenCalledTimes(1)
      time = 30000
      load.mockResolvedValue(upstream())
      expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('MISS')
      expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('HIT')
      expect(load).toHaveBeenCalledTimes(2)
    }
  )

  it.each([
    ['malformed JSON', () => ({ ...upstream(), body: Buffer.from('{') }), 'Invalid upstream JSON'],
    ['invalid schema', () => upstream(200, { data: { movie: [] } }), 'Unexpected upstream schema'],
    [
      'compressed payload',
      () => ({ ...upstream(), headers: { 'content-encoding': 'unsupported' } }),
      'Unexpected upstream encoding'
    ]
  ])(
    'suppresses stale data for %s, stores only an invalid marker and later recovers',
    async (_, invalid, error) => {
      const load = vi
        .fn()
        .mockResolvedValueOnce(upstream())
        .mockImplementation(async () => invalid())
      await serve(load)
      time = 21600 * 1000
      cache.put.mockClear()
      const rejected = await serve(load)
      expect(rejected.status).toBe(502)
      expect(await rejected.json()).toEqual({ error })
      expect(rejected.headers.get('Retry-After')).toBe('30')
      expect(cache.put).toHaveBeenCalledTimes(1)
      const [key, marker] = cache.put.mock.calls[0]
      expect(key).toContain('/__kinobox-retry?')
      expect(await marker.clone().text()).toBe('invalid')
      expect(marker.headers.get('Cache-Control')).toBe('public, max-age=30')
      expect((await serve(load)).status).toBe(503)
      expect(load).toHaveBeenCalledTimes(2)

      time += 30000
      const replacement = { data: { movie: { id: 301, title: 'Updated' } } }
      load.mockResolvedValue(upstream(200, replacement))
      expect(await (await serve(load)).json()).toEqual(replacement)
      const hit = await serve(load)
      expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
      expect(await hit.json()).toEqual(replacement)
      expect(load).toHaveBeenCalledTimes(3)
    }
  )

  it.each([403, 404])(
    'documents that HTTP %s cold bursts have no retry marker or negative cache',
    async (status) => {
      const load = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return upstream(status)
      })
      const pending = Promise.all(Array.from({ length: 8 }, () => serve(load)))
      await vi.advanceTimersByTimeAsync(4000)
      const replies = await pending
      expect(load).toHaveBeenCalledTimes(8)
      expect(replies.every((reply) => reply.status === (status === 404 ? 404 : 502))).toBe(true)
      expect(replies.every((reply) => !reply.headers.has('Retry-After'))).toBe(true)
      expect(cache.put).not.toHaveBeenCalled()
    }
  )

  it('documents that failed cache writes cause one upstream attempt per burst member', async () => {
    cache.put.mockRejectedValue(new Error('cache unavailable'))
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return upstream()
    })
    const pending = Promise.all(Array.from({ length: 8 }, () => serve(load)))
    await vi.advanceTimersByTimeAsync(4000)
    const replies = await pending
    expect(replies.every((reply) => reply.status === 200)).toBe(true)
    expect(replies.every((reply) => reply.headers.get('X-Kinobox-Cache') === 'MISS')).toBe(true)
    expect(load).toHaveBeenCalledTimes(8)
    expect(entries.size).toBe(0)
  })

  it('bounds a waiting cold request to 43 cache reads and 10 seconds without a second fetch', async () => {
    const fetch = deferred()
    const load = vi.fn(() => fetch.promise)
    let finished = false
    const leader = serve(load).then((reply) => {
      finished = true
      return reply
    })
    await vi.advanceTimersByTimeAsync(0)
    cache.match.mockClear()
    const waiter = serve(load)
    time = 10000
    await vi.advanceTimersByTimeAsync(10000)
    const reply = await waiter
    try {
      expect(reply.status).toBe(503)
      expect(reply.headers.get('X-Kinobox-Cache')).toBe('BACKOFF')
      expect(reply.headers.get('Retry-After')).toBe('30')
      expect(cache.match).toHaveBeenCalledTimes(43)
      expect(load).toHaveBeenCalledTimes(1)
      // The content layer does not time out or cancel the upstream promise itself.
      expect(finished).toBe(false)
    } finally {
      fetch.resolve(upstream())
      await leader
    }
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('HIT')
  })

  it.each([
    ['HTTP 404', () => upstream(404), 404],
    ['provider not found', () => upstream(200, { data: { isSuccess: false } }), 404],
    ['invalid JSON cooldown', () => ({ ...upstream(), body: Buffer.from('{') }), 502],
    ['invalid schema cooldown', () => upstream(200, { data: { movie: [] } }), 502],
    [
      'unexpected encoding cooldown',
      () => ({ ...upstream(), headers: { 'content-encoding': 'unsupported' } }),
      502
    ]
  ])(
    'does not resurrect a stale card after %s followed by a transient failure',
    async (_, invalid, status) => {
      const load = vi
        .fn()
        .mockResolvedValueOnce(upstream())
        .mockImplementation(async () => invalid())
      await serve(load)
      time = 21600 * 1000
      const rejected = await serve(load)
      expect(rejected.status).toBe(status)
      expect(cache.delete).toHaveBeenCalledTimes(1)
      expect(cache.delete.mock.calls[0][0]).toContain('/__kinobox-stale?')
      expect([...entries.keys()].some((key) => key.includes('/__kinobox-stale?'))).toBe(false)
      time += 30000
      load.mockResolvedValue(upstream(503))
      const later = await serve(load)
      expect(later.status).toBe(502)
    }
  )

  it('prevents an expired lease holder from overwriting a newer successful response', async () => {
    const oldFetch = deferred()
    const oldData = { data: { movie: { id: 301, title: 'Old' } } }
    const newData = { data: { movie: { id: 301, title: 'New' } } }
    const load = vi
      .fn()
      .mockImplementationOnce(() => oldFetch.promise)
      .mockResolvedValue(upstream(200, newData))
    const leader = serve(load)
    await vi.advanceTimersByTimeAsync(0)
    time = 20001
    let replacement
    try {
      replacement = await (await serve(load)).json()
    } finally {
      oldFetch.resolve(upstream(200, oldData))
      await leader
    }
    expect(load).toHaveBeenCalledTimes(2)
    expect(replacement).toEqual(newData)
    const hit = await serve(load)
    expect(await hit.json()).toEqual(newData)
  })

  it('does not cache a successful response after its lease expires without a replacement', async () => {
    const fetch = deferred()
    const load = vi.fn(() => fetch.promise)
    const pending = serve(load)
    await vi.advanceTimersByTimeAsync(0)
    time = 20000
    fetch.resolve(upstream())
    const reply = await pending
    expect(reply.status).toBe(200)
    expect(reply.headers.get('X-Kinobox-Cache')).toBe('MISS')
    expect(cache.put).not.toHaveBeenCalled()
    expect(entries.size).toBe(0)

    load.mockResolvedValue(upstream())
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('MISS')
    expect((await serve(load)).headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['HTTP 404', () => upstream(404), 404],
    ['provider not found', () => upstream(200, { data: { isSuccess: false } }), 404],
    ['invalid JSON', () => ({ ...upstream(), body: Buffer.from('{') }), 502],
    ['invalid schema', () => upstream(200, {}), 502],
    [
      'unexpected encoding',
      () => ({ ...upstream(), headers: { 'content-encoding': 'unsupported' } }),
      502
    ],
    ['HTTP 503', () => upstream(503), 502],
    [
      'timeout',
      () => {
        throw new Error('TCP timeout')
      },
      504
    ]
  ])('fences late %s cache mutations from an expired lease', async (_, fail, status) => {
    const oldFetch = deferred()
    const newData = { data: { movie: { id: 301, title: 'New' } } }
    const oldLoad = vi.fn(async () => {
      await oldFetch.promise
      return fail()
    })
    const leader = serve(oldLoad)
    await vi.advanceTimersByTimeAsync(0)
    time = 20000
    let late
    try {
      expect((await serve(async () => upstream(200, newData))).status).toBe(200)
      cache.put.mockClear()
      cache.delete.mockClear()
    } finally {
      oldFetch.resolve()
      late = await leader
    }
    expect(late.status).toBe(status)
    expect(cache.put).not.toHaveBeenCalled()
    expect(cache.delete).not.toHaveBeenCalled()
    const hit = await serve(async () => {
      throw new Error('unexpected upstream attempt')
    })
    expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(await hit.json()).toEqual(newData)
    const stale = [...entries].find(([key]) => key.includes('/__kinobox-stale?'))
    expect(await stale[1].response.clone().json()).toEqual(newData)
  })

  it('does not resurrect a stale snapshot after a newer lease receives a definitive 404', async () => {
    await serve(async () => upstream())
    time = 21600 * 1000
    const fetch = deferred()
    const pending = serve(() => fetch.promise)
    await vi.advanceTimersByTimeAsync(0)
    time += 20000
    try {
      expect((await serve(async () => upstream(404))).status).toBe(404)
    } finally {
      fetch.resolve(upstream(503))
      await pending
    }
    expect((await pending).status).toBe(502)
    expect([...entries.keys()].some((key) => key.includes('/__kinobox-retry?'))).toBe(false)
    expect([...entries.keys()].some((key) => key.includes('/__kinobox-stale?'))).toBe(false)
  })

  it('rechecks lease ownership after waiting for stale invalidation', async () => {
    await serve(async () => upstream())
    time = 21600 * 1000
    const deletion = deferred()
    const remove = cache.delete.getMockImplementation()
    cache.delete.mockImplementationOnce(async (key) => {
      const removed = await remove(key)
      await deletion.promise
      return removed
    })
    const invalid = serve(async () => upstream(200, {}))
    await vi.advanceTimersByTimeAsync(0)
    expect(cache.delete).toHaveBeenCalledTimes(1)
    time += 20000
    const newData = { data: { movie: { id: 301, title: 'New' } } }
    try {
      expect((await serve(async () => upstream(200, newData))).status).toBe(200)
      cache.put.mockClear()
    } finally {
      deletion.resolve()
      await invalid
    }
    expect((await invalid).status).toBe(502)
    expect(cache.put).not.toHaveBeenCalled()
    expect([...entries.keys()].some((key) => key.includes('/__kinobox-retry?'))).toBe(false)
    const hit = await serve(vi.fn())
    expect(hit.headers.get('X-Kinobox-Cache')).toBe('HIT')
    expect(await hit.json()).toEqual(newData)
  })

  it('does not serve a stale snapshot that expires while waiting for an upstream error', async () => {
    const fetch = deferred()
    const load = vi
      .fn()
      .mockResolvedValueOnce(upstream())
      .mockImplementation(() => fetch.promise)
    await serve(load)
    time = 48 * 3600 * 1000 - 1
    const pending = serve(load)
    await vi.advanceTimersByTimeAsync(0)
    time += 2
    fetch.resolve(upstream(503))
    const reply = await pending
    expect(reply.status).toBe(502)
  })

  it('does not serve stale data that expires while awaiting a rate budget rejection', async () => {
    const load = vi.fn(async () => upstream())
    await serve(load)
    time = 48 * 3600 * 1000 - 1
    const rejection = deferred()
    const budget = vi.fn(() => rejection.promise)
    const denied = new Response('{}', { status: 429 })
    const pending = serve(load, undefined, headers, budget)
    await vi.advanceTimersByTimeAsync(0)
    time += 2
    rejection.resolve(denied)
    expect(await pending).toBe(denied)
    expect(load).toHaveBeenCalledTimes(1)
    expect(budget).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(2)
  })
})
