import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthSuccess from './AuthSuccess.vue'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getMyLists: vi.fn(), addToList: vi.fn(), importHistory: vi.fn(),
  replace: vi.fn()
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/api/user', () => ({
  getUser: mocks.getUser, getMyLists: mocks.getMyLists, addToList: mocks.addToList
}))
vi.mock('@/api/cloudHistory', () => ({ importCloudHistory: mocks.importHistory }))
vi.mock('@/api/movies', () => ({ getKpInfo: vi.fn() }))

describe('sign-in messages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    setActivePinia(createPinia())
    useAuthStore().setToken('rh1_' + 'x'.repeat(43))
    useMainStore().setHistory([{ kp_id: '301', title: 'Matrix' }])
    mocks.getUser.mockResolvedValue({ id: 1 })
    mocks.getMyLists.mockResolvedValue([])
    mocks.importHistory.mockResolvedValue([{ kp_id: '301', title: 'Matrix' }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  const create = () => mount(AuthSuccess, { global: { stubs: { RouterLink: true } } })
  it('asks to sync local history and lists with the cloud, without naming the provider', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = create()
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(
      'Синхронизировать локальную историю и списки этого браузера с облаком?'
    )
    expect(mocks.importHistory).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Авторизация прошла успешно!')
    wrapper.unmount()
  })
  it('does not upload local data when the user declines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = create()
    await flushPromises()
    expect(mocks.importHistory).not.toHaveBeenCalled()
    expect(localStorage.getItem('reyohoho-guest-history-backup')).toContain('301')
    wrapper.unmount()
  })
  it('explains sync failures in plain language', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mocks.importHistory.mockRejectedValue(new Error('technical-details'))
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось синхронизировать историю и списки.')
    expect(wrapper.text()).not.toContain('technical-details')
    wrapper.unmount()
  })
  it('does not expose internal errors when sign-in fails', async () => {
    mocks.getUser.mockRejectedValue(new Error('technical-details'))
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось завершить вход.')
    expect(wrapper.text()).not.toContain('technical-details')
    wrapper.unmount()
  })
})
