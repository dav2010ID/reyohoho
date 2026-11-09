import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'
import { installRouterGuards } from './index'

describe('incoming links', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: routes.map((route) => ({ ...route, component: {} }))
  })
  installRouterGuards(router, { isClient: false })

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
