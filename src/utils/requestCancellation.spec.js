import { describe, expect, it } from 'vitest'
import { isRequestCanceled, rethrowRequestCancellation } from './requestCancellation'

describe('request cancellation helpers', () => {
  it.each([
    { code: 'ERR_CANCELED' },
    { name: 'CanceledError' },
    { name: 'AbortError' }
  ])('recognizes cancellation errors', (error) => {
    expect(isRequestCanceled(error)).toBe(true)
    expect(() => rethrowRequestCancellation(error)).toThrow(error)
  })

  it('does not treat regular failures as cancellation', () => {
    const error = new Error('offline')

    expect(isRequestCanceled(error)).toBe(false)
    expect(rethrowRequestCancellation(error)).toBeUndefined()
  })
})
