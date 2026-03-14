import movies from '@/data/movies.json'

const FALLBACK_DESCRIPTION =
  'ReYohoho - online movie and TV streaming with collections, ratings, and simple navigation.'
const SITE_NAME = 'ReYohoho'
const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || 'https://dav2010id.github.io'
const SITE_BASE_PATH = import.meta.env.VITE_BASE_URL || '/reyohoho'
const MAX_PRERENDER_ENTRIES = Number(import.meta.env.VITE_SSG_MAX_PAGES || 2000)

const CYRILLIC_TO_LATIN_MAP = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya'
}

const normalizeBasePath = (value) => {
  const normalized = `/${String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')}`

  return normalized === '/' ? '' : normalized
}

const BASE_PATH = normalizeBasePath(SITE_BASE_PATH)

const hasLatinLetters = (value) => /[a-z]/i.test(String(value || ''))

const transliterateCyrillic = (value) =>
  String(value || '')
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('')

const sanitizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

const resolveSlugSource = (movie = {}) => {
  const originalTitle = String(movie?.name_original || movie?.name_en || '').trim()
  const localizedTitle = String(movie?.title || movie?.name_ru || '').trim()

  if (hasLatinLetters(originalTitle)) return originalTitle
  return localizedTitle || originalTitle
}

const toSlug = (valueOrMovie) => {
  if (valueOrMovie && typeof valueOrMovie === 'object') {
    return sanitizeSlug(transliterateCyrillic(resolveSlugSource(valueOrMovie)))
  }

  return sanitizeSlug(transliterateCyrillic(valueOrMovie))
}

const normalizeMovie = (movie) => {
  const kpId = String(movie?.kp_id || movie?.kinopoisk_id || '').trim()
  const title = String(movie?.title || movie?.name_ru || movie?.name_original || '').trim()

  if (!kpId || !title) return null

  const slug = String(movie?.slug || toSlug(movie)).trim()
  const year = movie?.year ? String(movie.year).trim() : ''
  const description = String(movie?.description || FALLBACK_DESCRIPTION).trim()
  const poster = String(movie?.poster || movie?.poster_url || '').trim()
  const updatedAt = String(movie?.updatedAt || movie?.updated_at || '').trim()
  const nameOriginal = String(movie?.name_original || movie?.name_en || '').trim()

  return {
    kp_id: kpId,
    slug,
    title,
    year,
    description,
    poster,
    updatedAt,
    name_original: nameOriginal
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
  `${SITE_ORIGIN}${BASE_PATH}${buildMoviePath(kpId, slug)}`

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
  const slug = String(
    movieLike?.slug ||
      fallbackEntry?.slug ||
      toSlug({
        title: baseTitle,
        name_ru: movieLike?.name_ru,
        name_original: movieLike?.name_original || fallbackEntry?.name_original,
        name_en: movieLike?.name_en
      })
  ).trim()
  const title = baseTitle ? `${baseTitle}${year ? ` (${year})` : ''} смотреть онлайн - ${SITE_NAME}` : SITE_NAME

  return {
    title,
    description,
    poster,
    slug,
    canonicalUrl: kpId ? buildMovieCanonicalUrl(kpId, slug) : `${SITE_ORIGIN}${BASE_PATH}/`,
    siteName: SITE_NAME,
    type: 'video.movie'
  }
}

export const getAllMovieSeoEntries = () => normalizedMovies
export const getPrerenderMovieSeoEntries = () => normalizedMovies.slice(0, MAX_PRERENDER_ENTRIES)
