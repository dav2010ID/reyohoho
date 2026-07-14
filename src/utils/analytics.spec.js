import { describe, expect, it, vi } from 'vitest'
import {
  createSpaPageViewTracker,
  createYandexPageViewSender,
  normalizePageViewUrl
} from './analytics'

describe('Yandex Metrica SPA page views', () => {
  it('ignores URL fragments to match trackHash=false', () => {
    expect(normalizePageViewUrl('https://example.com/movie/1#comments')).toBe(
      'https://example.com/movie/1'
    )
  })

  it('sends a hit with title and previous page as referrer', () => {
    const ym = vi.fn()
    const sendPageView = createYandexPageViewSender({
      windowObject: { ym },
      counterId: 123
    })

    sendPageView({
      url: 'https://example.com/movie/1',
      title: 'Movie',
      referrer: 'https://example.com/'
    })

    expect(ym).toHaveBeenCalledWith(123, 'hit', 'https://example.com/movie/1', {
      title: 'Movie',
      referer: 'https://example.com/'
    })
  })

  it('waits until the GTM-managed counter is available', () => {
    const windowObject = {}
    const scheduled = []
    const sendPageView = createYandexPageViewSender({
      windowObject,
      counterId: 123,
      schedule: (callback) => scheduled.push(callback)
    })

    sendPageView({ url: 'https://example.com/top', title: 'Top', referrer: '' })
    expect(scheduled).toHaveLength(1)

    windowObject.ym = vi.fn()
    scheduled.shift()()

    expect(windowObject.ym).toHaveBeenCalledOnce()
  })

  it('does not send development traffic from loopback hosts', () => {
    const ym = vi.fn()
    const sendPageView = createYandexPageViewSender({
      windowObject: { ym, location: { hostname: '127.0.0.1' } },
      counterId: 123
    })

    expect(sendPageView({ url: 'http://127.0.0.1:5173/top', title: 'Top' })).toBe(false)
    expect(ym).not.toHaveBeenCalled()
  })

  it('does not break navigation when the analytics call is blocked', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sendPageView = createYandexPageViewSender({
      windowObject: {
        ym: () => {
          throw new Error('blocked')
        }
      },
      counterId: 123
    })

    expect(() =>
      sendPageView({ url: 'https://example.com/top', title: 'Top', referrer: '' })
    ).not.toThrow()
    expect(warning).toHaveBeenCalledOnce()
    warning.mockRestore()
  })

  it('skips the automatic initial hit, duplicate URLs and sensitive auth routes', () => {
    let currentPage = { url: 'https://example.com/', title: 'Home' }
    const sendPageView = vi.fn()
    const trackPageView = createSpaPageViewTracker({
      sendPageView,
      getPage: () => currentPage,
      shouldSkip: (route) => route.path === '/auth-success'
    })

    expect(trackPageView({ path: '/' })).toBe(false)
    expect(trackPageView({ path: '/' })).toBe(false)

    currentPage = { url: 'https://example.com/auth-success?token=secret', title: 'Login' }
    expect(trackPageView({ path: '/auth-success' })).toBe(false)

    currentPage = { url: 'https://example.com/movie/1', title: 'Movie' }
    expect(trackPageView({ path: '/movie/1' })).toBe(true)
    expect(sendPageView).toHaveBeenCalledWith({
      url: 'https://example.com/movie/1',
      title: 'Movie',
      referrer: 'https://example.com/'
    })
  })

  it('waits for the first non-sensitive route before accepting the automatic initial hit', () => {
    let currentPage = {
      url: 'https://example.com/auth-success?token=secret',
      title: 'Login'
    }
    const sendPageView = vi.fn()
    const trackPageView = createSpaPageViewTracker({
      sendPageView,
      getPage: () => currentPage,
      shouldSkip: (route) => route.path === '/auth-success'
    })

    expect(trackPageView({ path: '/auth-success' })).toBe(false)

    currentPage = { url: 'https://example.com/', title: 'Home' }
    expect(trackPageView({ path: '/' })).toBe(false)

    currentPage = { url: 'https://example.com/top', title: 'Top' }
    expect(trackPageView({ path: '/top' })).toBe(true)
    expect(sendPageView).toHaveBeenCalledWith({
      url: 'https://example.com/top',
      title: 'Top',
      referrer: 'https://example.com/'
    })
  })
})
