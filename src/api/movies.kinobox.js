import axios from 'axios'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const KINOBOX_BASE_URL = import.meta.env.VITE_KINOBOX_API_URL || 'https://api.kinobox.tv'
const KINOBOX_REFERER = import.meta.env.VITE_KINOBOX_REFERER || 'https://tapeop.dev/'
const KINOBOX_ORIGIN = import.meta.env.VITE_KINOBOX_ORIGIN || 'https://tapeop.dev'

const api = axios.create({
  baseURL: KINOBOX_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Referer: KINOBOX_REFERER,
    Origin: KINOBOX_ORIGIN
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

const toPlayersMap = (providers = [], { type = null, translationId = null } = {}) => {
  const players = {}
  const selectedType = type ? String(type).toLowerCase() : null
  const selectedTranslationId =
    translationId === null || translationId === undefined ? null : String(translationId)

  for (const provider of providers) {
    const providerType = normalizePlayerType(provider?.type)

    if (selectedType && providerType.toLowerCase() !== selectedType) {
      continue
    }

    const providerBaseIframe = provider?.iframeUrl || ''
    const providerLabel = `KINOBOX>${providerType}`

    if (providerBaseIframe) {
      const key = ensureUniqueKey(players, providerLabel)
      players[key] = {
        name: key,
        translate: providerType,
        iframe: providerBaseIframe,
        quality: '',
        warning: false,
        source: 'kinobox',
        raw_data: provider
      }
    }

    const translations = Array.isArray(provider?.translations) ? provider.translations : []
    for (const translation of translations) {
      const iframe = translation?.iframeUrl || ''
      if (!iframe) continue

      const tId =
        translation?.id === null || translation?.id === undefined ? null : String(translation.id)
      if (selectedTranslationId && tId !== selectedTranslationId) continue

      const translationName = String(translation?.name || 'Translation').trim()
      const key = ensureUniqueKey(players, `${providerLabel}>${translationName}`)
      players[key] = {
        name: key,
        translate: translationName,
        iframe,
        quality: translation?.quality || '',
        warning: false,
        source: 'kinobox',
        raw_data: translation,
        provider: providerType
      }
    }
  }

  return players
}

const getPlayersRaw = async (kpId, { title = '' } = {}) => {
  const { data } = await apiCall((client) =>
    client.get('/api/players', {
      params: {
        kinopoisk: String(kpId),
        ...(title ? { title: String(title) } : {})
      }
    })
  )

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, options)
}

export { getPlayers, getPlayersRaw }

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
