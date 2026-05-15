const KP_SMALL_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp_small'
const KP_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp'

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  return value
}

export const optimizePosterUrl = (value) => {
  const url = normalizeUrl(value)
  if (!url) return ''

  return url
    .replace(`${KP_POSTER_BASE}/`, `${KP_SMALL_POSTER_BASE}/`)
    .replace(/\/x1000(?=($|[?#]))/, '/x300')
}

const getKpIdFromMovie = (movie = {}) => {
  return (
    movie.kp_id ||
    movie.kinopoisk_id ||
    movie.id_kp ||
    movie.id ||
    movie.raw_data?.film_id ||
    null
  )
}

export const resolvePosterByMovie = (movie = {}) => {
  const direct =
    optimizePosterUrl(movie.poster) ||
    optimizePosterUrl(movie.cover) ||
    optimizePosterUrl(movie.poster_url_preview) ||
    optimizePosterUrl(movie.poster_url) ||
    optimizePosterUrl(movie.small_poster) ||
    optimizePosterUrl(movie.big_poster) ||
    optimizePosterUrl(movie.raw_data?.poster_url_preview) ||
    optimizePosterUrl(movie.raw_data?.poster_url)

  if (direct) return direct

  const kpId = getKpIdFromMovie(movie)
  if (kpId) return `${KP_SMALL_POSTER_BASE}/${kpId}.jpg`

  return ''
}

export const resolvePosterSetByMovie = (movie = {}) => {
  const preview = resolvePosterByMovie(movie)

  const big =
    normalizeUrl(movie.poster_url) ||
    normalizeUrl(movie.big_poster) ||
    normalizeUrl(movie.raw_data?.poster_url) ||
    (() => {
      const kpId = getKpIdFromMovie(movie)
      return kpId ? `${KP_POSTER_BASE}/${kpId}.jpg` : ''
    })()

  return {
    preview,
    full: big || preview
  }
}

