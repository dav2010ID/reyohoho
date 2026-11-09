import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useApiStore } from '@/store/api'
import { useMainStore } from '@/store/main'
import { routes } from './routes'
import { installRouterGuards } from './index'

describe('incoming links', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: routes.map((route) => ({ ...route, component: {} }))
  })
  installRouterGuards(router, { isClient: false })
  afterEach(() => vi.unstubAllEnvs())

  it('handles legacy links before mounting a page that cannot load', async () => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_APP_API_URL', '')
    for (const path of ['/shiki/123', '/movie/shiki123/title', '/#shiki123', '/#shiki=123', '/#imdb=0198781']) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('Settings')
      expect(router.currentRoute.value.query.tab).toBe('api')
    }
    useMainStore().contentApiProvider = 'local'
    await router.push('/shiki/123')
    expect(router.currentRoute.value.name).toBe('movie-info-shiki')
    await router.push('/#imdb=0198781')
    expect(router.currentRoute.value.name).toBe('Settings')
    useApiStore().$patch({ backendMode: 'local', backendModeUserSelected: true })
    await router.push('/#imdb=0198781')
    expect(router.currentRoute.value.fullPath).toBe('/#imdb=0198781')
  })

  it('keeps anchors on their page and resolves numeric legacy links', async () => {
    await router.push('/top#section-test')
    expect(router.currentRoute.value.fullPath).toBe('/top#section-test')
    await router.push('/#301')
    expect(router.currentRoute.value.params.kp_id).toBe('301')
  })
  it('rejects invalid movie IDs before loading the component', () => {
    for (const id of ['bad', '0', '012', '1234567890123', 'shikibad', 'SHIKI123']) {
      expect(router.resolve('/movie/' + id).name).toBe('NotFound')
    }
    expect(router.resolve('/movie/shiki123/title').name).toBe('movie-info')
  })
  it('removes URL credentials while preserving unrelated query fields', async () => {
    await router.push('/auth-success?token=foreign&lang=ru')
    expect(router.currentRoute.value.fullPath).toBe('/auth-success?lang=ru')
  })
})
