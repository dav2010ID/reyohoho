import axios from 'axios'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const DDBB_BASE_URL = import.meta.env.VITE_DDBB_API_URL || 'https://p2.ddbb.lol'

const api = axios.create({
  baseURL: DDBB_BASE_URL,
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

const apiCall = async (callFn) => {
  await simulateErrorIfNeeded()
  return await callFn(api)
}

const ensureUniqueKey = (obj, baseKey) => {
  if (!obj[baseKey]) return baseKey
  let idx = 2
  while (obj[`${baseKey} #${idx}`]) idx++
  return `${baseKey} #${idx}`
}

const normalizePlayerType = (value) => String(value || 'Player').trim()

const toPlayersMap = (
  providers = [],
  { type = null, source = 'ddbb', sourceLabel = 'DDBB' } = {}
) => {
  const players = {}
  const selectedType = type ? String(type).toLowerCase() : null

  for (const provider of providers) {
    const providerType = normalizePlayerType(provider?.type)

    if (selectedType && providerType.toLowerCase() !== selectedType) {
      continue
    }

    const providerBaseIframe = provider?.iframeUrl || ''
    const providerLabel = `${sourceLabel}>${providerType}`

    if (providerBaseIframe) {
      const key = ensureUniqueKey(players, providerLabel)
      players[key] = {
        name: key,
        translate: providerType,
        iframe: providerBaseIframe,
        quality: '',
        warning: false,
        source,
        raw_data: provider
      }
    }

  }

  return players
}

const getPlayersRaw = async (kpId, { n = 0 } = {}) => {
  const { data } = await apiCall((client) =>
    client.get('/api/players', {
      params: {
        kinopoisk: String(kpId),
        n
      }
    })
  )

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, options)
}

export { getPlayers, getPlayersRaw, toPlayersMap }

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
