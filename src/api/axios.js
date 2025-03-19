import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(
  (config) => {
    return config
  },
  (err) => Promise.reject(err)
)

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    console.error('Error', err)
    return Promise.reject(err)
  }
)

export default api
