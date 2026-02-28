const KP_SMALL_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp_small'
const KP_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp'

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  return value
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
    normalizeUrl(movie.poster) ||
    normalizeUrl(movie.cover) ||
    normalizeUrl(movie.poster_url_preview) ||
    normalizeUrl(movie.poster_url) ||
    normalizeUrl(movie.small_poster) ||
    normalizeUrl(movie.big_poster) ||
    normalizeUrl(movie.raw_data?.poster_url_preview) ||
    normalizeUrl(movie.raw_data?.poster_url)

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

