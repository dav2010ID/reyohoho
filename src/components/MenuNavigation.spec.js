import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import MenuNavigation from './MenuNavigation.vue'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBaseURL: vi.fn()
}))
vi.mock('@/api/user', () => ({ getUser: mocks.getUser }))
vi.mock('@/api/axios', () => ({ getBaseURL: mocks.getBaseURL }))

const navStub = (layout) => ({
  props: ['links'],
  template: `<nav data-layout="${layout}"><a v-for="link in links" :key="link.to" :href="link.to" :data-icon="link.icon">{{ link.text }}</a></nav>`
})

let pinia
let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  mocks.getUser.mockResolvedValue({ id: '123', name: 'Test', photo: null })
  mocks.getBaseURL.mockResolvedValue('https://legacy.example')
})
afterEach(() => wrapper?.unmount())
const render = () =>
  mount(MenuNavigation, {
    global: {
      plugins: [pinia],
      stubs: {
        DesktopMenu: navStub('desktop'),
        MobileMenu: navStub('mobile'),
        ModalSearch: true
      }
    }
  })

describe('reactive account navigation', () => {
  it.each([false, true])('updates immediately on login/logout (mobile=%s)', async (mobile) => {
    useMainStore().setIsMobile(mobile)
    const auth = useAuthStore()
    wrapper = render()
    const menuInstance = wrapper.vm.$.uid
    expect(wrapper.get('nav').attributes('data-layout')).toBe(mobile ? 'mobile' : 'desktop')
    expect(wrapper.get('a[href="/login"]').text()).toBe('Войти')

    auth.setToken('test-session')
    await nextTick()
    // A token alone is not a loaded/authenticated profile.
    expect(wrapper.find('a[href="/lists"]').exists()).toBe(false)
    auth.setUser({ id: '123', name: 'Test', photo: null })
    await nextTick()
    expect(wrapper.get('a[href="/user"]').text()).toBe('Профиль')
    expect(wrapper.get('a[href="/lists"]').text()).toBe('Мои списки')
    expect(wrapper.get('a[href="/notifications"]').text()).toBe('Уведомления')
    expect(wrapper.find('a[href="/login"]').exists()).toBe(false)
    expect(wrapper.vm.$.uid).toBe(menuInstance)
    expect(mocks.getUser).not.toHaveBeenCalled()

    auth.logout()
    await nextTick()
    expect(wrapper.get('a[href="/login"]').text()).toBe('Войти')
    expect(wrapper.find('a[href="/user"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/lists"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/notifications"]').exists()).toBe(false)
  })

  it('restores a Worker profile without contacting the legacy backend resolver', async () => {
    const auth = useAuthStore()
    auth.setToken(`rh1_${'a'.repeat(43)}`)
    wrapper = render()
    await flushPromises()
    expect(auth.isAuthenticated).toBe(true)
    expect(wrapper.get('a[href="/user"]').text()).toBe('Профиль')
    expect(mocks.getBaseURL).not.toHaveBeenCalled()
  })

  it('does not restore a stale user response after logout', async () => {
    let resolveUser
    mocks.getUser.mockReturnValue(new Promise((resolve) => { resolveUser = resolve }))
    const auth = useAuthStore()
    auth.setToken('old-session')
    wrapper = render()
    await flushPromises()
    expect(mocks.getUser).toHaveBeenCalledOnce()
    auth.logout()
    resolveUser({ id: '123', name: 'Old user', photo: null })
    await flushPromises()
    expect(auth.user).toBeNull()
    expect(wrapper.get('a[href="/login"]').text()).toBe('Войти')
    expect(mocks.getBaseURL).not.toHaveBeenCalled()
  })

  it('updates the legacy avatar after restoring its backend base URL', async () => {
    mocks.getUser.mockResolvedValue({ id: '123', name: 'Test', photo: '/avatar.png' })
    useAuthStore().setToken('legacy-session')
    wrapper = render()
    await flushPromises()
    expect(wrapper.get('a[href="/user"]').attributes('data-icon')).toBe(
      'https://legacy.example/avatar.png'
    )
  })
})
