import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrerenderMovieSeoEntries = vi.fn()

vi.mock('vite-ssg', () => ({
  ViteSSG: vi.fn(() => ({}))
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn()
}))

vi.mock('./store/theme', () => ({
  useThemeStore: () => ({
    initTheme: vi.fn()
  })
}))

vi.mock('./composables/useAppSetup', () => ({
  useAppSetup: vi.fn()
}))

vi.mock('./router/routes', () => ({
  routes: []
}))

vi.mock('./router', () => ({
  installRouterGuards: vi.fn()
}))

vi.mock('./utils/movieSeo', () => ({
  buildMoviePath: (kpId, slug) => `/movie/${kpId}/${slug}`,
  getPrerenderMovieSeoEntries
}))

vi.mock('./App.vue', () => ({
  default: {}
}))

describe('main includedRoutes', () => {
  beforeEach(() => {
    getPrerenderMovieSeoEntries.mockReset()
  })

  it('adds prerender movie routes to static paths', async () => {
    getPrerenderMovieSeoEntries.mockReturnValue([
      { kp_id: '123', slug: 'test-slug' },
      { kp_id: '456', slug: 'another-slug' }
    ])

    const { includedRoutes } = await import('./main.js')
    const result = await includedRoutes(['/', '/top', '/movie/:kp_id/:slug'])

    expect(result).toEqual([
      '/',
      '/top',
      '/movie/123/test-slug',
      '/movie/456/another-slug'
    ])
  })
})
