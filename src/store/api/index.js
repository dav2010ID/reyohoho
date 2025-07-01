import { defineStore } from 'pinia'
import { API_STORE_NAME } from '../constants'

export const useApiStore = defineStore(API_STORE_NAME, {
  state: () => ({
    currentApiUrl: null,
    availableEndpoints: [],
    lastCheckedAt: null,
    isCheckingHealth: false,
    fallbackUrl: import.meta.env.VITE_APP_API_URL,
    userSelectedApiUrl: null,
    endpointsHash: null
  }),

  actions: {
    async checkEndpointHealth(url) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        })

        clearTimeout(timeoutId)
        return response.ok
      } catch (error) {
        console.warn(`Health check failed for ${url}:`, error.message)
        return false
      }
    },

    async selectWorkingEndpoint(endpoints) {
      this.isCheckingHealth = true

      try {
        if (this.userSelectedApiUrl) {
          const userEndpoint = endpoints.find((ep) => ep.url === this.userSelectedApiUrl)
          if (userEndpoint) {
            const isHealthy = await this.checkEndpointHealth(this.userSelectedApiUrl)
            if (isHealthy) {
              console.log(`Using user selected API: ${this.userSelectedApiUrl}`)
              this.currentApiUrl = this.userSelectedApiUrl
              this.lastCheckedAt = Date.now()
              this.isCheckingHealth = false
              return this.userSelectedApiUrl
            } else {
              console.warn(
                `User selected API ${this.userSelectedApiUrl} is not healthy, selecting another`
              )
              this.userSelectedApiUrl = null
            }
          } else {
            console.warn(
              `User selected API ${this.userSelectedApiUrl} is not in available endpoints, resetting`
            )
            this.userSelectedApiUrl = null
          }
        }

        for (const endpoint of endpoints) {
          console.log(`Checking health for: ${endpoint.url}`)

          const isHealthy = await this.checkEndpointHealth(endpoint.url)

          if (isHealthy) {
            console.log(`Selected working API: ${endpoint.url} (${endpoint.description})`)
            this.currentApiUrl = endpoint.url
            this.lastCheckedAt = Date.now()
            this.isCheckingHealth = false
            return endpoint.url
          }
        }

        console.warn('No working endpoints found, using fallback')
        this.currentApiUrl = this.fallbackUrl
        this.lastCheckedAt = Date.now()
        this.isCheckingHealth = false
        return this.fallbackUrl
      } catch (error) {
        console.error('Error selecting working endpoint:', error)
        this.currentApiUrl = this.fallbackUrl
        this.lastCheckedAt = Date.now()
        this.isCheckingHealth = false
        return this.fallbackUrl
      }
    },

    setAvailableEndpoints(endpoints) {
      const newHash = this.generateEndpointsHash(endpoints)

      if (this.endpointsHash && this.endpointsHash !== newHash) {
        console.log('API endpoints changed, resetting user selection')
        this.userSelectedApiUrl = null
      }

      this.availableEndpoints = endpoints
      this.endpointsHash = newHash
    },

    setCurrentApiUrl(url) {
      this.currentApiUrl = url
    },

    setUserSelectedApiUrl(url) {
      this.userSelectedApiUrl = url
      if (url) {
        this.currentApiUrl = url
      }
    },

    resetUserSelection() {
      this.userSelectedApiUrl = null
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
      'userSelectedApiUrl',
      'endpointsHash'
    ]
  }
})
