import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthSuccess from './AuthSuccess.vue'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import { readPendingSync } from '@/utils/pendingAccountSync'
import { replaceLocalList } from '@/utils/localUserLists'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getMyLists: vi.fn(), addToList: vi.fn(), importHistory: vi.fn(),
  replace: vi.fn(), getKpInfo: vi.fn()
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/api/user', () => ({
  getUser: mocks.getUser, getMyLists: mocks.getMyLists, addToList: mocks.addToList
}))
vi.mock('@/api/cloudHistory', () => ({ importCloudHistory: mocks.importHistory }))
vi.mock('@/api/movies', () => ({ getKpInfo: mocks.getKpInfo }))

describe('sign-in messages', () => {
  it('does not upload legacy history into a new account after a delayed metadata read', async () => {
    useAuthStore().setToken('legacy.account.A')
    let resolveMetadata
    mocks.getKpInfo.mockReturnValue(new Promise((resolve) => { resolveMetadata = resolve }))
    const wrapper = create()
    await flushPromises()
    expect(mocks.getKpInfo).toHaveBeenCalledWith('301')
    useAuthStore().setToken('legacy-B')
    useAuthStore().setUser({ id: 2 })
    resolveMetadata({ name_ru: 'Matrix', poster_url: '/poster.jpg' })
    await flushPromises()
    expect(mocks.addToList).not.toHaveBeenCalled()
    expect(readPendingSync('legacy:1').history.map((item) => item.kp_id)).toEqual(['301'])
    expect(useAuthStore().user.id).toBe(2)
    wrapper.unmount()
  })
  it('keeps failed list items across a remount and retries only unconfirmed writes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    replaceLocalList('favorite', [{ kp_id: '301' }, { kp_id: '302' }], 'guest')
    mocks.addToList.mockImplementation(async (id) => {
      if (id === '302') throw new Error('offline')
    })
    const first = create()
    await flushPromises()
    expect(readPendingSync('worker:1').lists.favorite.map((item) => item.kp_id)).toEqual(['302'])
    first.unmount()
    mocks.addToList.mockClear()
    mocks.addToList.mockResolvedValue({ ok: true })
    const second = create()
    await flushPromises()
    expect(mocks.addToList).toHaveBeenCalledTimes(1)
    expect(mocks.addToList.mock.calls[0][0]).toBe('302')
    expect(readPendingSync('worker:1')).toBeNull()
    expect(mocks.importHistory).toHaveBeenCalledTimes(1)
    second.unmount()
  })
  it('does not install a stale user after account changes during sign-in', async () => {
    let resolve
    mocks.getUser.mockReturnValue(new Promise((done) => { resolve = done }))
    const wrapper = create()
    useAuthStore().logout()
    resolve({ id: 1 })
    await flushPromises()
    expect(useAuthStore().user).toBeNull()
    expect(mocks.getMyLists).not.toHaveBeenCalled()
    wrapper.unmount()
  })
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
  it.each([null, 'rh1_' + 'x'.repeat(43)])('ignores a URL token with stored session %s', async (token) => {
    useAuthStore().setToken(token)
    window.history.replaceState(null, '', '/auth-success?token=rh1_' + 'a'.repeat(43))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = create()
    await flushPromises()
    expect(useAuthStore().token).toBe(token)
    expect(mocks.getUser).toHaveBeenCalledTimes(token ? 1 : 0)
    window.history.replaceState(null, '', '/')
    wrapper.unmount()
  })
  it('clears the rejected session on a 401 from user lookup', async () => {
    useAuthStore().setToken('legacy.account.A')
    mocks.getUser.mockRejectedValue({ response: { status: 401 } })
    const wrapper = create()
    await flushPromises()
    expect(useAuthStore().token).toBeNull()
    wrapper.unmount()
  })
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
