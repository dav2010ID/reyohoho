import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserLists from './UserLists.vue'

const mocks = vi.hoisted(() => ({
  auth: null, route: null, main: null,
  get: vi.fn(), counters: vi.fn(), del: vi.fn(), clear: vi.fn(), add: vi.fn(),
  importHistory: vi.fn(), notify: vi.fn(), logout: vi.fn()
}))
vi.mock('@/store/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/store/main', () => ({ useMainStore: () => mocks.main }))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/user', () => ({
  getMyLists: mocks.get, getUserLists: mocks.get, getListCounters: mocks.counters,
  delFromList: mocks.del, delAllFromList: mocks.clear, importWorkerList: vi.fn(), addToList: mocks.add
}))
vi.mock('@/utils/authSession', () => ({ logoutAndRedirect: mocks.logout }))
vi.mock('@/api/cloudHistory', () => ({ isCloudHistoryEnabled: () => true, importCloudHistory: mocks.importHistory }))
const mountLists = () => shallowMount(UserLists, { global: { stubs: {
  MovieList: { name: 'MovieList', props: ['moviesList'], emits: ['item-deleted'],
    template: '<div><button v-for="movie in moviesList" :key="movie.kp_id" @click="$emit(\'item-deleted\', Number(movie.kp_id))">{{ movie.title }}</button></div>' },
  Notification: { template: '<div />', methods: { showNotification: mocks.notify } }
} } })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

describe('user list mutations and account boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth = reactive({ token: 'account-A', isWorkerSession: true, user: { id: 1 } })
    mocks.route = reactive({ params: {}, query: { type: 'favorite' } })
    mocks.main = reactive({ history: [], setHistory: vi.fn() })
    mocks.get.mockReset().mockResolvedValue([{ kp_id: '301', title: 'Matrix' }])
    mocks.counters.mockResolvedValue({ favorite: 1 })
    mocks.del.mockReset().mockResolvedValue({})
    mocks.importHistory.mockResolvedValue([])
  })

  it('deletes once from the selected list and handles numeric card events', async () => {
    const pending = deferred()
    mocks.del.mockReturnValue(pending.promise)
    const wrapper = mountLists()
    await flushPromises()
    const card = wrapper.getComponent({ name: 'MovieList' })
    await card.get('button').trigger('click')
    await card.get('button').trigger('click')
    expect(mocks.del).toHaveBeenCalledExactlyOnceWith(301, 'favorite')
    expect(card.props('moviesList')).toHaveLength(1)
    pending.resolve({})
    await flushPromises()
    expect(wrapper.text()).toContain('Нет фильмов')
    wrapper.unmount()
  })

  it('retains cards after a failed deletion and does not label errors as empty', async () => {
    mocks.del.mockRejectedValue(new Error('offline'))
    const wrapper = mountLists()
    await flushPromises()
    await wrapper.getComponent({ name: 'MovieList' }).get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.getComponent({ name: 'ErrorMessage' }).props('message')).toBeTruthy()
    mocks.route.query.type = 'later'
    await flushPromises()
    expect(wrapper.getComponent({ name: 'MovieList' }).props('moviesList')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ignores a slow list response after a filter change', async () => {
    const old = deferred()
    mocks.get.mockImplementation((type) => type === 'favorite' ? old.promise : Promise.resolve([{ kp_id: '42', title: 'Later movie' }]))
    const wrapper = mountLists()
    mocks.route.query.type = 'later'
    await flushPromises()
    old.resolve([{ kp_id: '301', title: 'Old favorite' }])
    await flushPromises()
    expect(wrapper.getComponent({ name: 'MovieList' }).props('moviesList')[0].title).toBe('Later movie')
    wrapper.unmount()
  })

  it('does not log out a new account after an old deletion returns 401', async () => {
    const old = deferred()
    mocks.del.mockReturnValue(old.promise)
    const wrapper = mountLists()
    await flushPromises()
    await wrapper.getComponent({ name: 'MovieList' }).get('button').trigger('click')
    mocks.auth.token = 'account-B'
    mocks.auth.user = { id: 2 }
    mocks.get.mockResolvedValue([{ kp_id: '42', title: 'Account B' }])
    await flushPromises()
    old.reject({ response: { status: 401 } })
    await flushPromises()
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'MovieList' }).props('moviesList')[0].title).toBe('Account B')
    wrapper.unmount()
  })

  it('refuses to download a partial export', async () => {
    const wrapper = mountLists()
    await flushPromises()
    mocks.get.mockImplementation((type) => type === 'later' ? Promise.reject(new Error('offline')) : Promise.resolve([]))
    const createUrl = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl }))
    await wrapper.get('[title="Экспортировать"]').trigger('click')
    await flushPromises()
    expect(createUrl).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('не удалось получить все списки'))
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('imports dated history through the merge endpoint without first rewriting dates', async () => {
    mocks.get.mockResolvedValue([])
    const wrapper = mountLists()
    await flushPromises()
    const input = wrapper.get('input[type="file"]')
    const dated = { kp_id: 301, addedAt: '2020-01-01T00:00:00.000Z' }
    Object.defineProperty(input.element, 'files', { value: [{ text: async () => JSON.stringify({ data: { serverLists: { history: [301] }, localHistory: [dated] } }) }] })
    await input.trigger('change')
    await flushPromises()
    expect(mocks.importHistory).toHaveBeenCalledTimes(1)
    expect(mocks.importHistory.mock.calls[0][0][0]).toMatchObject(dated)
    expect(mocks.add).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
