import axios from 'axios'
import { toPlayersMap } from '@/api/movies.ddbb'

const DDBB_LIVE_BASE_URL = import.meta.env.VITE_DDBB_LIVE_API_URL || 'https://a.ddbb.live'

const api = axios.create({
  baseURL: DDBB_LIVE_BASE_URL
})

const getPlayersRaw = async (kpId, { n = 0, signal, ...options } = {}) => {
  const { data } = await api.get('/api/players', {
    ...options,
    params: {
      kinopoisk: String(kpId),
      n
    },
    ...(signal ? { signal } : {})
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
