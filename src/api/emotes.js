import { getApi } from '@/api/axios'

const apiCall = async (callFn) => {
  const api = await getApi()
  return await callFn(api)
}

const searchEmotes = async (query) => {
  const { data } = await apiCall((api) => api.get(`/search_emotes/${query}`))
  return data.emotes || []
}

export { searchEmotes }
