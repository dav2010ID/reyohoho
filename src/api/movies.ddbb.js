import axios from 'axios'
import { getSafePlayerUrl } from '@/utils/playerSecurity'

const DDBB_BASE_URL = import.meta.env.VITE_DDBB_API_URL || 'https://p2.ddbb.lol'

const api = axios.create({
  baseURL: DDBB_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const apiCall = async (callFn) => {
  return await callFn(api)
}

const ensureUniqueKey = (obj, baseKey) => {
  if (!obj[baseKey]) return baseKey
  let idx = 2
  while (obj[`${baseKey} #${idx}`]) idx++
  return `${baseKey} #${idx}`
}

const normalizePlayerType = (value) => String(value || 'Player').trim()

// Vibix records carry SDK embed attributes instead of a URL. Build the iframe URL
// that rendex-sdk would create, rather than loading the third-party SDK script.
const VIBIX_EMBED_ORIGIN =
  import.meta.env.VITE_VIBIX_EMBED_ORIGIN || 'https://river-3-329.kinescopecdn.net'
const VIBIX_ATTRIBUTES =
  /^data-publisher-id="(\d{1,12})" data-type="(movie|serial)" data-id="(\d{1,12})"$/
const VIBIX_PATHS = { movie: 'embed', serial: 'embed-serials' }

const getVibixIframe = (value) => {
  const match = VIBIX_ATTRIBUTES.exec(String(value || '').trim())
  if (!match) return null
  const [, publisherId, type, id] = match
  return `${VIBIX_EMBED_ORIGIN}/${publisherId}/${VIBIX_PATHS[type]}/${id}?lang=ru`
}

// Provider records must carry an absolute URL; relative text would load this site.
const getProviderIframe = (provider) => {
  if (normalizePlayerType(provider?.type).toLowerCase() === 'vibix') {
    const vibix = getVibixIframe(provider?.iframeUrl)
    if (vibix) return vibix
  }
  const value = String(provider?.iframeUrl || '').trim()
  return /^https?:\/\//i.test(value) ? getSafePlayerUrl(value) : null
}

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

    const providerBaseIframe = getProviderIframe(provider)
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

const getPlayersRaw = async (kpId, { n = 0, signal, ...options } = {}) => {
  const { data } = await apiCall((client) =>
    client.get('/api/players', {
      ...options,
      params: {
        kinopoisk: String(kpId),
        n
      },
      ...(signal ? { signal } : {})
    })
  )

  return Array.isArray(data?.data) ? data.data : []
}

const getPlayers = async (kpId, options = {}) => {
  const providers = await getPlayersRaw(kpId, options)
  return toPlayersMap(providers, options)
}

export { getPlayers, getPlayersRaw, toPlayersMap }
