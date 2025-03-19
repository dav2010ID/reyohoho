import api from '@/api/axios'

const apiSearch = async (searchTerm) => {
  try {
    const { data } = await api.get(`/search/${searchTerm}`)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

const getShikiInfo = async (shikiId) => {
  try {
    const { data } = await api.get(`/shiki_info/${shikiId}`)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

const getKpInfo = async (kpId) => {
  try {
    const { data } = await api.get(`/kp_info2/${kpId}`)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

const getPlayers = async (kpId) => {
  try {
    const { data } = await api.post(
      `/cache`,
      new URLSearchParams({
        kinopoisk: kpId,
        type: 'movie'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return data
  } catch (error) {
    throw new Error(error)
  }
}

const getMovies = async ({ activeTime = 'all', typeFilter = 'all' } = {}) => {
  try {
    const { data } = await api.get(`/top/${activeTime}?type=${typeFilter}`)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

const getDons = async () => {
  try {
    const { data } = await api.get(`/get_dons`)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

export { apiSearch, getDons, getKpInfo, getMovies, getPlayers, getShikiInfo }
