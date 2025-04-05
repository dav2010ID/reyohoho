import { defineStore } from 'pinia'
import { AUTH_STORE_NAME } from '../constants'

export const useAuthStore = defineStore(AUTH_STORE_NAME, {
  state: () => ({
    token: null,
    user: null
  }),

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
    }
  },

  persist: {
    key: AUTH_STORE_NAME
  }
})
