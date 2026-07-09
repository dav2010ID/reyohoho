import { defineStore } from 'pinia'
import { API_STORE_NAME } from '../constants'
import { debugLog } from '@/utils/logger'

export const LOCAL_API_URL = (import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:8000').replace(
  /\/$/,
  ''
)

export const useApiStore = defineStore(API_STORE_NAME, {
  state: () => ({
    currentApiUrl: null,
    availableEndpoints: [],
    lastCheckedAt: null,
    isCheckingHealth: false,
    fallbackUrl: import.meta.env.VITE_APP_API_URL,
    endpointsHash: null,
    backendMode: 'auto',
    localApiUrl: LOCAL_API_URL,
    localApiHealthy: null
  }),

  actions: {
    async checkEndpointHealth(url) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        })

        return response.ok
      } catch (error) {
        console.warn(`Health check failed for ${url}:`, error.message)
        return false
      } finally {
        clearTimeout(timeoutId)
      }
    },

    async selectWorkingEndpoint(endpoints) {
      if (this.backendMode === 'local') {
        return await this.selectLocalEndpoint()
      }

      this.isCheckingHealth = true

      try {
        for (const endpoint of endpoints) {
          debugLog(`Checking health for: ${endpoint.url}`)

          const isHealthy = await this.checkEndpointHealth(endpoint.url)

          if (isHealthy) {
            debugLog(`Selected working API: ${endpoint.url} (${endpoint.description})`)
            if (this.currentApiUrl !== endpoint.url) {
              this.currentApiUrl = endpoint.url
              import('@/api/axios').then(({ resetApi }) => resetApi())
            } else {
              this.currentApiUrl = endpoint.url
            }
            this.lastCheckedAt = Date.now()
            this.isCheckingHealth = false
            return endpoint.url
          }
        }

        console.warn('No working endpoints found, using fallback')
        if (this.currentApiUrl !== this.fallbackUrl) {
          this.currentApiUrl = this.fallbackUrl
          import('@/api/axios').then(({ resetApi }) => resetApi())
        } else {
          this.currentApiUrl = this.fallbackUrl
        }
        this.lastCheckedAt = Date.now()
        this.isCheckingHealth = false
        return this.fallbackUrl
      } catch (error) {
        console.error('Error selecting working endpoint:', error)
        if (this.currentApiUrl !== this.fallbackUrl) {
          this.currentApiUrl = this.fallbackUrl
          import('@/api/axios').then(({ resetApi }) => resetApi())
        } else {
          this.currentApiUrl = this.fallbackUrl
        }
        this.lastCheckedAt = Date.now()
        this.isCheckingHealth = false
        return this.fallbackUrl
      }
    },

    async selectLocalEndpoint() {
      this.isCheckingHealth = true
      this.localApiHealthy = await this.checkEndpointHealth(this.localApiUrl)
      this.setCurrentApiUrl(this.localApiUrl)
      this.lastCheckedAt = Date.now()
      this.isCheckingHealth = false
      return this.localApiUrl
    },

    async setBackendMode(mode) {
      if (!['auto', 'local'].includes(mode)) return
      this.backendMode = mode

      if (mode === 'local') {
        return await this.selectLocalEndpoint()
      }

      this.localApiHealthy = null
      return await this.selectWorkingEndpoint(this.availableEndpoints)
    },

    async recheckSelectedEndpoint() {
      if (this.backendMode === 'local') {
        return await this.selectLocalEndpoint()
      }
      return await this.selectWorkingEndpoint(this.availableEndpoints)
    },

    setAvailableEndpoints(endpoints) {
      const newHash = this.generateEndpointsHash(endpoints)

      if (this.endpointsHash && this.endpointsHash !== newHash) {
        debugLog('API endpoints changed')
      }

      this.availableEndpoints = endpoints
      this.endpointsHash = newHash
    },

    setCurrentApiUrl(url) {
      if (this.currentApiUrl !== url) {
        this.currentApiUrl = url
        import('@/api/axios').then(({ resetApi }) => resetApi())
      }
    },

    generateEndpointsHash(endpoints) {
      const str = JSON.stringify(
        endpoints.map((ep) => ({ url: ep.url, description: ep.description }))
      )
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      return hash.toString()
    },

    getCurrentApiDescription() {
      if (this.backendMode === 'local') {
        return 'Локальный backend'
      }
      if (!this.currentApiUrl || !this.availableEndpoints.length) {
        return 'Fallback API'
      }

      const endpoint = this.availableEndpoints.find((ep) => ep.url === this.currentApiUrl)
      return endpoint ? endpoint.description : 'Unknown API'
    },

    shouldRecheckEndpoints() {
      if (!this.lastCheckedAt) return true

      const hourInMs = 60 * 60 * 1000
      return Date.now() - this.lastCheckedAt > hourInMs
    }
  },

  persist: {
    key: API_STORE_NAME,
    pick: [
      'currentApiUrl',
      'availableEndpoints',
      'lastCheckedAt',
      'endpointsHash',
      'backendMode'
    ]
  }
})
