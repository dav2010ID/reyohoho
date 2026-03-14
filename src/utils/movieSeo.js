import movies from '@/data/movies.json'

const FALLBACK_DESCRIPTION =
  'ReYohoho - онлайн просмотр фильмов и сериалов. Подборки, рейтинги и удобная навигация.'
const SITE_NAME = 'ReYohoho'
const SITE_ORIGIN = 'https://dav2010id.github.io'
const SITE_BASE_PATH = '/reyohoho'

const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

const normalizeMovie = (movie) => {
  const kpId = String(movie?.kp_id || movie?.kinopoisk_id || '').trim()
  const title = String(movie?.title || movie?.name_ru || movie?.name_original || '').trim()

  if (!kpId || !title) return null

  const slug = String(movie?.slug || toSlug(title)).trim()
  const year = movie?.year ? String(movie.year).trim() : ''
  const description = String(movie?.description || FALLBACK_DESCRIPTION).trim()
  const poster = String(movie?.poster || movie?.poster_url || '').trim()
  const updatedAt = String(movie?.updatedAt || movie?.updated_at || '').trim()

  return {
    kp_id: kpId,
    slug,
    title,
    year,
    description,
    poster,
    updatedAt
  }
}

const normalizedMovies = Array.isArray(movies) ? movies.map(normalizeMovie).filter(Boolean) : []
const moviesByKpId = new Map(normalizedMovies.map((movie) => [String(movie.kp_id), movie]))

export const getMovieSeoEntry = (kpId) => moviesByKpId.get(String(kpId)) || null

export const buildMoviePath = (kpId, slug = '') => {
  const normalizedKpId = String(kpId || '').trim()
  const normalizedSlug = String(slug || '').trim()

  if (!normalizedKpId) return '/movie'
  return normalizedSlug ? `/movie/${normalizedKpId}/${normalizedSlug}` : `/movie/${normalizedKpId}`
}

export const buildMovieCanonicalUrl = (kpId, slug = '') =>
  `${SITE_ORIGIN}${SITE_BASE_PATH}${buildMoviePath(kpId, slug)}`

export const buildMovieSeo = (movieLike = {}, kpIdOverride = null) => {
  const fallbackEntry = kpIdOverride ? getMovieSeoEntry(kpIdOverride) : null
  const kpId = String(movieLike?.kinopoisk_id || movieLike?.kp_id || kpIdOverride || '').trim()
  const baseTitle = String(movieLike?.title || movieLike?.name_ru || fallbackEntry?.title || '').trim()
  const year = String(movieLike?.year || fallbackEntry?.year || '').trim()
  const description = String(movieLike?.description || fallbackEntry?.description || FALLBACK_DESCRIPTION)
    .replace(/\s+/g, ' ')
    .trim()
  const poster = String(
    movieLike?.poster_url ||
      movieLike?.poster ||
      movieLike?.cover ||
      fallbackEntry?.poster ||
      ''
  ).trim()
  const slug = String(movieLike?.slug || fallbackEntry?.slug || toSlug(baseTitle)).trim()
  const title = baseTitle
    ? `${baseTitle}${year ? ` (${year})` : ''} смотреть онлайн - ${SITE_NAME}`
    : SITE_NAME

  return {
    title,
    description,
    poster,
    slug,
    canonicalUrl: kpId ? buildMovieCanonicalUrl(kpId, slug) : `${SITE_ORIGIN}${SITE_BASE_PATH}/`,
    siteName: SITE_NAME,
    type: 'video.movie'
  }
}

export const getAllMovieSeoEntries = () => normalizedMovies
