import { describe, expect, it, vi } from 'vitest'
import { useCommentsData } from './useCommentsData'

describe('useCommentsData', () => {
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
    expect(fetchComments).toHaveBeenCalledWith('301')
  })

  it('exposes loading while the request is pending', async () => {
    let resolveRequest
    const fetchComments = vi.fn(
      () => new Promise((resolve) => (resolveRequest = resolve))
    )
    const state = useCommentsData({ movieId: () => '301', fetchComments })

    const request = state.loadCommentsData()
    expect(state.commentsLoading.value).toBe(true)
    resolveRequest([])
    await request

    expect(state.commentsLoading.value).toBe(false)
  })
})
