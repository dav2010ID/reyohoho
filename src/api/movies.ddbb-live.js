import axios from 'axios'
import { toPlayersMap } from '@/api/movies.ddbb'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const DDBB_LIVE_BASE_URL = import.meta.env.VITE_DDBB_LIVE_API_URL || 'https://a.ddbb.live'

const api = axios.create({
  baseURL: DDBB_LIVE_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const simulateErrorIfNeeded = async () => {
  if (isErrorSimulationEnabled && simulatedErrorCode) {
    const status = parseInt(simulatedErrorCode, 10)
    const error = new Error(`Simulated error ${status}`)
    error.response = { status }
    throw error
  }
}

const getPlayersRaw = async (kpId, { n = 0 } = {}) => {
  await simulateErrorIfNeeded()
  const { data } = await api.get('/api/players', {
    params: {
      kinopoisk: String(kpId),
      n
    }
  })

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, {
    ...options,
    source: 'ddbb_live',
    sourceLabel: 'DDBB LIVE'
  })
}

export { getPlayers, getPlayersRaw }

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
