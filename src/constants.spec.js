import { describe, expect, it } from 'vitest'
import { handleApiError } from './constants'

describe('API error messages', () => {
  it('respects Retry-After and does not mislabel all 403s as copyright blocks', () => {
    expect(handleApiError({ response: { status: 429, headers: { 'retry-after': '12' } } }).message).toContain('12 с')
    expect(handleApiError({ response: { status: 403 } }).message).not.toContain('правообладател')
    expect(handleApiError({ name: 'TimeoutError' }).code).toBe(408)
  })
})
