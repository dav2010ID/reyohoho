import { describe, expect, it, vi } from 'vitest'
import { useCommentsData } from './useCommentsData'

describe('useCommentsData', () => {
  it('retains nested replies without duplicating flat entries', async () => {
    const reply = { id: 2, parent_id: 1, content: 'reply' }
    const state = useCommentsData({ movieId: () => '301', fetchComments: async () => [{ id: 1, parent_id: null, replies: [reply] }, reply] })
    await state.loadCommentsData()
    expect(state.comments.value.map(item => item.id).sort()).toEqual([1, 2])
    expect(state.commentsLoaded.value).toBe(true)
  })
  it('ignores late success from a superseded request even if transport ignores abort', async () => {
    const pending = []
    const state = useCommentsData({
      movieId: () => '301',
      fetchComments: () => new Promise((resolve) => pending.push(resolve))
    })
    const old = state.loadCommentsData()
    const latest = state.loadCommentsData()
    pending[1]([{ id: 2 }])
    await latest
    pending[0]([{ id: 1 }])
    expect(await old).toBe(null)
    expect(state.comments.value).toEqual([{ id: 2 }])
  })

  it('ignores late failures after cancellation without showing an error', async () => {
    let reject
    const state = useCommentsData({
      movieId: () => '301',
      fetchComments: () =>
        new Promise((_, fail) => {
          reject = fail
        })
    })
    const pending = state.loadCommentsData()
    state.cancelCommentsLoad()
    reject(new Error('late offline'))
    expect(await pending).toBe(null)
    expect(state.commentsLoadError.value).toBe('')
    expect(state.commentsLoading.value).toBe(false)
  })
  it('loads comments and clears a previous error', async () => {
    const fetchComments = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ id: 1 }])
    const state = useCommentsData({ movieId: () => '301', fetchComments })

    expect(await state.loadCommentsData()).toBe(false)
    expect(state.commentsLoadError.value).toBeTruthy()
    expect(await state.loadCommentsData()).toBe(true)

    expect(state.comments.value).toEqual([{ id: 1 }])
    expect(state.commentsLoadError.value).toBe('')
    expect(fetchComments).toHaveBeenLastCalledWith('301', {
      signal: expect.any(AbortSignal)
    })
  })

  it('exposes loading while the request is pending', async () => {
    let resolveRequest
    const fetchComments = vi.fn(() => new Promise((resolve) => (resolveRequest = resolve)))
    const state = useCommentsData({ movieId: () => '301', fetchComments })

    const request = state.loadCommentsData()
    expect(state.commentsLoading.value).toBe(true)
    resolveRequest([])
    await request

    expect(state.commentsLoading.value).toBe(false)
  })

  it('cancels a stale request before loading comments again', async () => {
    const signals = []
    const fetchComments = vi.fn((_, { signal }) => {
      signals.push(signal)
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
        )
        if (signals.length === 2) resolve([{ id: 2 }])
      })
    })
    const state = useCommentsData({ movieId: () => '301', fetchComments })

    const staleRequest = state.loadCommentsData()
    const latestRequest = state.loadCommentsData()

    expect(await staleRequest).toBe(null)
    expect(signals[0].aborted).toBe(true)
    expect(await latestRequest).toBe(true)
    expect(state.comments.value).toEqual([{ id: 2 }])
    expect(state.commentsLoadError.value).toBe('')
  })
})
