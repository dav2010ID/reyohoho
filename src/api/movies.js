import api from '@/api/axios'

const apiSearch = async (searchTerm) => {
  const { data } = await api.get(`/search/${searchTerm}`)
  return data
}

const getShikiInfo = async (shikiId) => {
  const { data } = await api.get(`/shiki_info/${shikiId}`)
  return data
}

const getKpInfo = async (kpId) => {
  const { data } = await api.get(`/kp_info2/${kpId}`)
  return data
}

const getPlayers = async (kpId) => {
  const { data } = await api.post(
    '/cache',
    new URLSearchParams({
      kinopoisk: kpId,
      type: 'movie'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return data
}

const getMovies = async ({ activeTime = 'all', typeFilter = 'all' } = {}) => {
  const { data } = await api.get(`/top/${activeTime}?type=${typeFilter}`)
  return data
}

const getDons = async () => {
  const { data } = await api.get('/get_dons')
  return data
}

export { apiSearch, getDons, getKpInfo, getMovies, getPlayers, getShikiInfo }
