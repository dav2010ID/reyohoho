import { defineStore } from 'pinia'
import { AUTH_STORE_NAME } from '../constants'
import { useMainStore } from '../main'
import { getLocalList, replaceLocalList } from '@/utils/localUserLists'

export const useAuthStore = defineStore(AUTH_STORE_NAME, {
  state: () => ({
    token: null,
    user: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isWorkerSession: (state) => /^rh1_[A-Za-z0-9_-]{43}$/.test(state.token || '')
  },

  actions: {
    setUser(user) {
      const main = useMainStore()
      const owner = user?.id ? `worker:${user.id}` : 'guest'
      if (main.historyOwner !== owner) {
        replaceLocalList('history', main.history, main.historyOwner || 'guest')
        main.historyOwner = owner
        main.setHistory(getLocalList('history', owner))
      }
      this.user = user
    },
    setToken(token) {
      if (this.token !== token) {
        useMainStore().cloudHistoryAccount = null
        this.setUser(null)
      }
      this.token = token
    },
    logout() {
      if (this.isWorkerSession) {
        const token = this.token
        void import('@/api/workerAccount')
          .then(({ workerAccountRequest }) =>
            workerAccountRequest('/auth/logout', 'POST', {}, { token })
          )
          .catch(() => {})
      }
      useMainStore().cloudHistoryAccount = null
      this.setUser(null)
      this.token = null
    },
    async updateUserName(name) {
      const { updateUserName: updateUserNameApi } = await import('@/api/user')
      await updateUserNameApi(name)
      if (this.user) {
        this.user.name = name
      }
    }
  },

  persist: {
    key: AUTH_STORE_NAME,
    afterHydrate: ({ store }) => {
      // Only Worker (Telegram) sessions exist now. A token persisted by the old
      // optional backend is dropped; its local lists stay under their old key.
      if (store.token && !store.isWorkerSession) store.token = null
      store.setUser(store.token ? store.user : null)
    }
  }
})
