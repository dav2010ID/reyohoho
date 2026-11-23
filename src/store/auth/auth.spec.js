import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import persistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from './auth'
import { useMainStore } from '../main'
import { getLocalList, replaceLocalList } from '@/utils/localUserLists'

vi.mock('@/api/workerAccount', () => ({ workerAccountRequest: vi.fn().mockResolvedValue({}) }))

describe('account history ownership', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('clears the old user while a new token is being identified and preserves each history', () => {
    const auth = useAuthStore()
    const main = useMainStore()
    main.setHistory([{ kp_id: '10' }])
    auth.setToken('rh1_' + 'a'.repeat(43))
    auth.setUser({ id: 1 })
    main.setHistory([{ kp_id: '11' }])
    auth.setToken('rh1_' + 'b'.repeat(43))
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(main.historyOwner).toBe('guest')
    expect(main.history.map((item) => item.kp_id)).toEqual(['10'])
    expect(getLocalList('history', 'worker:1').map((item) => item.kp_id)).toEqual(['11'])
    auth.setUser({ id: 2 })
    expect(main.history).toEqual([])
    main.setHistory([{ kp_id: '12' }])
    auth.logout()
    expect(main.history.map((item) => item.kp_id)).toEqual(['10'])
    expect(getLocalList('history', 'worker:2').map((item) => item.kp_id)).toEqual(['12'])
    auth.setToken('rh1_' + 'a'.repeat(43))
    auth.setUser({ id: 1 })
    expect(main.historyOwner).toBe('worker:1')
    expect(main.history.map((item) => item.kp_id)).toEqual(['11'])
  })

  it.each([
    { token: 'rh1_' + 'b'.repeat(43), user: { id: 2 }, owner: 'worker:2', movie: '12' },
    { token: null, user: { id: 1 }, owner: 'guest', movie: '10' }
  ])('reconciles persisted history before use for $owner', ({ token, user, owner, movie }) => {
    localStorage.setItem('main', JSON.stringify({ historyOwner: 'worker:1', history: [{ kp_id: '11' }] }))
    localStorage.setItem('auth', JSON.stringify({ token, user }))
    replaceLocalList('history', [{ kp_id: movie }], owner)
    const pinia = createPinia().use(persistedstate)
    createApp({}).use(pinia)
    const auth = useAuthStore(pinia)
    const main = useMainStore(pinia)
    expect(main.historyOwner).toBe(owner)
    expect(main.history.map((item) => item.kp_id)).toEqual([movie])
    expect(getLocalList('history', 'worker:1').map((item) => item.kp_id)).toEqual(['11'])
    expect(auth.user).toEqual(token ? user : null)
  })
})
