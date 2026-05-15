import { debugLog } from '@/utils/logger'

class OBSWebSocket {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.isAuthenticated = false
    this.messageId = 0
    this.sources = new Map()
    this.filtersFound = new Map()
    this.pendingRequests = new Map()
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onSourcesUpdated: null,
      onFiltersFound: null,
      onError: null
    }

    this.BLUR_FILTER_NAME = 'reyohoho'
  }

  generateMessageId() {
    return ++this.messageId
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks
  }

  async connect(host = 'localhost', port = 4455, password = '') {
    return new Promise((resolve, reject) => {
      const url = `ws://${host}:${port}`
      debugLog(`Connecting to OBS WebSocket at ${url}`)
      this.ws = new WebSocket(url)

      this.ws.onopen = async () => {
        debugLog('WebSocket connection opened')
        try {
          const authResponse = await this.authenticate(password)
          debugLog('Authentication response:', authResponse)
          if (authResponse.success) {
            debugLog('Successfully authenticated to OBS')
            this.callbacks.onConnect?.()
            this.loadSourcesAndSearchFilters()
            resolve()
          } else {
            console.error('Authentication failed')
            reject(new Error('Authentication failed'))
          }
        } catch (error) {
          console.error('Error during authentication:', error)
          reject(error)
        }
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data))
      }

      this.ws.onclose = () => {
        debugLog('WebSocket connection closed')
        this.callbacks.onDisconnect?.()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.callbacks.onError?.(error.message || 'Connection error')
        reject(error)
      }
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    if (this.pendingRequests) {
      for (const [, { reject }] of this.pendingRequests.entries()) {
        reject(new Error('Connection closed'))
      }
      this.pendingRequests.clear()
    }

    this.sources.clear()
    this.filtersFound.clear()
  }

  sendRequest(requestType, requestData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        console.warn('No connection to OBS')
        reject(new Error('No connection to OBS'))
        return
      }

      const requestId = this.generateMessageId().toString()
      const request = {
        op: 6,
        d: {
          requestType,
          requestId,
          requestData
        }
      }

      debugLog(`Sending OBS request: ${requestType}`, requestData)

      this.pendingRequests.set(requestId, { resolve, reject })

      this.ws.send(JSON.stringify(request))

      setTimeout(() => {
        if (this.pendingRequests && this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request ${requestType} timed out`))
        }
      }, 10000)
    })
  }

  handleMessage(message) {
    switch (message.op) {
      case 0: // Hello
        this.handleHello(message.d)
        break
      case 2: // Identified
        this.handleIdentified()
        break
      case 7: // RequestResponse
        this.handleRequestResponse(message.d)
        break
      case 5: // Event
        this.handleEvent(message.d)
        break
      default:
        debugLog(`Unknown OBS message: op=${message.op}`)
    }
  }

  authenticate(password = '') {
    return new Promise((resolve) => {
      this.password = password
      this.authResolve = resolve
    })
  }

  async handleHello(data) {
    debugLog('Received OBS hello')
    this.isConnected = true

    const identify = {
      op: 1,
      d: {
        rpcVersion: 1
      }
    }

    if (data.authentication && this.password) {
      try {
        const encoder = new TextEncoder()

        const hash1 = await crypto.subtle.digest(
          'SHA-256',
          encoder.encode(this.password + data.authentication.salt)
        )
        const hashArray1 = Array.from(new Uint8Array(hash1))
        const base64Hash = btoa(String.fromCharCode(...hashArray1))

        const hash2 = await crypto.subtle.digest(
          'SHA-256',
          encoder.encode(base64Hash + data.authentication.challenge)
        )
        const hashArray2 = Array.from(new Uint8Array(hash2))
        const authResponse = btoa(String.fromCharCode(...hashArray2))

        identify.d.authentication = authResponse
      } catch (error) {
        console.error('Authentication error:', error)
      }
    }

    this.ws.send(JSON.stringify(identify))
  }

  handleIdentified() {
    debugLog('OBS authentication successful')
    this.isAuthenticated = true

    if (this.authResolve) {
      this.authResolve({ success: true })
      this.authResolve = null
    }
  }

  handleRequestResponse(data) {
    const { requestId, requestType, requestStatus, responseData } = data

    debugLog(`Received response for ${requestType}:`, {
      success: requestStatus.result,
      code: requestStatus.code,
      comment: requestStatus.comment
    })

    if (!this.pendingRequests) {
      console.warn('No pending requests map')
      return
    }

    const pendingRequest = this.pendingRequests.get(requestId)
    if (!pendingRequest) {
      console.warn(`No pending request found for ID: ${requestId}`)
      return
    }

    this.pendingRequests.delete(requestId)

    if (requestStatus.result) {
      debugLog(`Request ${requestType} successful`, responseData)
      pendingRequest.resolve(responseData)
    } else {
      console.error(`Request ${requestType} failed:`, requestStatus.comment)
      pendingRequest.reject(new Error(`${requestType} failed: ${requestStatus.comment}`))
    }
  }

  handleFilterListResponse(responseData) {
    const sourceName = responseData.sourceName
    const filters = responseData.filters || []

    const blurFilter = filters.find(
      (filter) => filter.filterName.toLowerCase() === this.BLUR_FILTER_NAME.toLowerCase()
    )

    if (blurFilter) {
      this.foundFilters.set(sourceName, {
        sourceName: sourceName,
        filterName: blurFilter.filterName,
        enabled: blurFilter.filterEnabled
      })
      debugLog(`Found reyohoho filter in source: ${sourceName}`)
    }

    this.checkSearchComplete()
  }

  checkSearchComplete() {
    setTimeout(() => {
      debugLog(`Search complete. Found ${this.foundFilters.size} reyohoho filters`)
      this.callbacks.onFiltersFound?.(Array.from(this.foundFilters.values()))
    }, 500)
  }

  handleEvent(data) {
    debugLog(`OBS event: ${data.eventType}`)
  }

  async testConnection() {
    try {
      debugLog('Testing OBS connection...')
      const version = await this.sendRequest('GetVersion')
      debugLog('OBS connection test successful:', version)
      return { success: true, version }
    } catch (error) {
      console.error('OBS connection test failed:', error)
      return { success: false, error: error.message }
    }
  }

  async loadSourcesAndSearchFilters() {
    try {
      debugLog('Loading sources and searching for filters...')

      try {
        const version = await this.sendRequest('GetVersion')
        debugLog('OBS version info:', version)
      } catch (error) {
        console.warn('Could not get OBS version:', error)
      }

      debugLog('Requesting scene list...')
      const scenes = await this.sendRequest('GetSceneList')
      debugLog('Raw scenes response:', scenes)

      if (!scenes || !scenes.scenes) {
        console.error('Invalid scenes response structure:', scenes)
        this.callbacks.onError?.('Invalid response from OBS - no scenes data')
        return
      }

      debugLog('Found scenes:', scenes.scenes.length)

      debugLog('Requesting input list...')
      const inputs = await this.sendRequest('GetInputList')
      debugLog('Raw inputs response:', inputs)

      if (!inputs || !inputs.inputs) {
        console.error('Invalid inputs response structure:', inputs)
        this.callbacks.onError?.('Invalid response from OBS - no inputs data')
        return
      }

      debugLog('Found inputs:', inputs.inputs.length)

      this.sources.clear()
      this.filtersFound.clear()

      for (const scene of scenes.scenes) {
        debugLog(
          `Checking scene: ${scene.sceneName} with ${scene.sceneItems ? scene.sceneItems.length : 0} items`
        )

        if (scene.sceneItems && Array.isArray(scene.sceneItems)) {
          for (const item of scene.sceneItems) {
            if (item.sourceName) {
              this.sources.set(item.sourceName, {
                sceneName: scene.sceneName,
                sourceId: item.sceneItemId,
                sourceName: item.sourceName
              })

              await this.searchFiltersInSource(item.sourceName, scene.sceneName)
            }
          }
        }
      }

      for (const input of inputs.inputs) {
        debugLog(`Checking input: ${input.inputName}`)
        if (!this.sources.has(input.inputName)) {
          this.sources.set(input.inputName, {
            sceneName: 'Direct Input',
            sourceId: null,
            sourceName: input.inputName
          })
        }

        await this.searchFiltersInSource(input.inputName, 'Direct Input')
      }

      const foundFilters = Array.from(this.filtersFound.values())
      debugLog('Total filters found:', foundFilters.length)
      foundFilters.forEach((filter) => {
        debugLog(
          `- ${filter.sourceName}: ${filter.filterName} (${filter.enabled ? 'enabled' : 'disabled'})`
        )
      })

      this.callbacks.onFiltersFound?.(foundFilters)
      this.callbacks.onSourcesUpdated?.(Array.from(this.sources.values()))
    } catch (error) {
      console.error('Error loading sources:', error)
      console.error('Error stack:', error.stack)
      this.callbacks.onError?.(`Error loading sources: ${error.message}`)
    }
  }

  async searchFiltersInSource(sourceName, sceneName) {
    try {
      debugLog(`Searching filters in source: ${sourceName}`)
      const response = await this.sendRequest('GetSourceFilterList', {
        sourceName: sourceName
      })

      debugLog(`Source ${sourceName} has ${response.filters.length} filters`)
      for (const filter of response.filters) {
        debugLog(
          `  Filter: ${filter.filterName} (${filter.filterEnabled ? 'enabled' : 'disabled'})`
        )

        const filterId = `${sourceName}::${filter.filterName}`
        this.filtersFound.set(filterId, {
          id: filterId,
          sourceName: sourceName,
          sceneName: sceneName,
          filterName: filter.filterName,
          enabled: filter.filterEnabled
        })
      }
    } catch (error) {
      console.warn(`Could not get filters for source ${sourceName}:`, error)
    }
  }

  async enableBlur(selectedFilterId) {
    if (!selectedFilterId) {
      console.warn('No filter selected for blur')
      return
    }

    const filter = this.filtersFound.get(selectedFilterId)
    if (!filter) {
      console.warn('Selected filter not found:', selectedFilterId)
      return
    }

    try {
      await this.sendRequest('SetSourceFilterEnabled', {
        sourceName: filter.sourceName,
        filterName: filter.filterName,
        filterEnabled: true
      })
      filter.enabled = true
      debugLog(`Enabled blur filter: ${filter.sourceName}::${filter.filterName}`)
    } catch (error) {
      this.callbacks.onError?.(`Error enabling filter: ${error.message}`)
    }
  }

  async disableBlur(selectedFilterId) {
    if (!selectedFilterId) {
      console.warn('No filter selected for blur')
      return
    }

    const filter = this.filtersFound.get(selectedFilterId)
    if (!filter) {
      console.warn('Selected filter not found:', selectedFilterId)
      return
    }

    try {
      await this.sendRequest('SetSourceFilterEnabled', {
        sourceName: filter.sourceName,
        filterName: filter.filterName,
        filterEnabled: false
      })
      filter.enabled = false
      debugLog(`Disabled blur filter: ${filter.sourceName}::${filter.filterName}`)
    } catch (error) {
      this.callbacks.onError?.(`Error disabling filter: ${error.message}`)
    }
  }

  async testBlur(selectedFilterId, duration = 2000) {
    if (!selectedFilterId) {
      console.warn('No filter selected for test')
      return
    }

    await this.enableBlur(selectedFilterId)
    setTimeout(() => {
      this.disableBlur(selectedFilterId)
    }, duration)
  }

  getFilterById(filterId) {
    return this.filtersFound.get(filterId)
  }

  getAllFilters() {
    return Array.from(this.filtersFound.values())
  }
}

export { OBSWebSocket }
