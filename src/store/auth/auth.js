import { defineStore } from 'pinia'
import { AUTH_STORE_NAME } from '../constants'

export const useAuthStore = defineStore(AUTH_STORE_NAME, {
  state: () => ({
    token: null,
    user: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user
  },

  actions: {
    setUser(user) {
      this.user = user
    },
    setToken(token) {
      this.token = token
    },
    logout() {
      this.user = null
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
    key: AUTH_STORE_NAME
  }
})
