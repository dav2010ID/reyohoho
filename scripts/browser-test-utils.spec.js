import { describe, expect, it } from 'vitest'
import { isIgnoredConsoleError, isIgnoredFailure, resolveAppUrl } from './browser-test-utils'

describe('browser test URL resolution', () => {
  it('keeps routes inside a configured application base path', () => {
    expect(resolveAppUrl('http://127.0.0.1:4174/reyohoho/', 'top')).toBe(
      'http://127.0.0.1:4174/reyohoho/top'
    )
  })

  it('resolves routes correctly for a root deployment', () => {
    expect(resolveAppUrl('http://127.0.0.1:4174/', '/top')).toBe('http://127.0.0.1:4174/top')
  })

  it('preserves the canonical trailing slash for the application root', () => {
    expect(resolveAppUrl('http://127.0.0.1:4174/reyohoho/')).toBe('http://127.0.0.1:4174/reyohoho/')
  })
})

describe('optional external provider failures', () => {
  it('does not hide backend endpoint failures', () => {
    expect(isIgnoredFailure('https://backend.example.test/health')).toBe(false)
    expect(isIgnoredFailure('https://backend.example.test/comments/123')).toBe(false)
  })

  it('classifies matching browser console errors as non-blocking', () => {
    expect(
      isIgnoredConsoleError(
        '[API Error] {url: https://backend.example.test/rating/123, message: Network Error}',
        'http://127.0.0.1/app.js'
      )
    ).toBe(false)
    expect(
      isIgnoredConsoleError('Error loading rating: AxiosError: Network Error', '/assets/rating.js')
    ).toBe(true)
  })
})
