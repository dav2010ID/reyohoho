import movies from '@/data/movies.json'
import { getCanonicalSlugCandidate, getTrimmedString, hasLatinLetters } from './movieSlug'

const FALLBACK_DESCRIPTION =
  'ReYohoho - online movie and TV streaming with collections, ratings, and simple navigation.'
const SITE_NAME = 'ReYohoho'
const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || 'https://dav2010id.github.io'
const SITE_BASE_PATH = import.meta.env.VITE_BASE_URL || '/reyohoho'
const MAX_PRERENDER_ENTRIES = Number(import.meta.env.VITE_SSG_MAX_PAGES || 2000)
const runtimeMoviesByKpId = new Map()

const normalizeBasePath = (value) => {
  const normalized = `/${String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')}`

  return normalized === '/' ? '' : normalized
}

const BASE_PATH = normalizeBasePath(SITE_BASE_PATH)

const normalizeMovie = (movie) => {
  const kpId = String(movie?.kp_id || movie?.kinopoisk_id || '').trim()
  const localizedTitle = getTrimmedString(
    movie?.title,
    movie?.name_ru,
    movie?.raw_data?.name_ru,
    movie?.raw_data?.nameRu
  )
  const nameOriginal = getTrimmedString(
    movie?.name_original,
    movie?.name_en,
    movie?.raw_data?.name_original,
    movie?.raw_data?.name_en,
    movie?.raw_data?.Name_original
  )
  const title = localizedTitle || nameOriginal

  if (!kpId || !title) return null

  const slug = getCanonicalSlugCandidate(movie)
  const year = movie?.year ? String(movie.year).trim() : ''
  const description = String(movie?.description || FALLBACK_DESCRIPTION).trim()
  const poster = String(movie?.poster || movie?.poster_url || '').trim()
  const updatedAt = String(movie?.updatedAt || movie?.updated_at || '').trim()

  return {
    kp_id: kpId,
    slug,
    title,
    name_ru: localizedTitle,
    year,
    description,
    poster,
    updatedAt,
    name_original: nameOriginal
  }
}

const normalizedMovies = Array.isArray(movies) ? movies.map(normalizeMovie).filter(Boolean) : []
const moviesByKpId = new Map(normalizedMovies.map((movie) => [String(movie.kp_id), movie]))

const mergeMovieSeoEntries = (existing = {}, incoming = {}) => {
  const kpId = String(incoming?.kp_id || existing?.kp_id || '').trim()

  return {
    kp_id: kpId,
    title: getTrimmedString(existing?.title, incoming?.title),
    name_ru: getTrimmedString(incoming?.name_ru, existing?.name_ru, existing?.title, incoming?.title),
    name_original: getTrimmedString(incoming?.name_original, existing?.name_original),
    year: getTrimmedString(incoming?.year, existing?.year),
    description: getTrimmedString(incoming?.description, existing?.description, FALLBACK_DESCRIPTION),
    poster: getTrimmedString(incoming?.poster, existing?.poster),
    updatedAt: getTrimmedString(incoming?.updatedAt, existing?.updatedAt),
    slug: getTrimmedString(
      getCanonicalSlugCandidate(incoming, existing),
      incoming?.slug,
      existing?.slug
    )
  }
}

const hasCanonicalOriginalTitle = (movieLike = {}, fallbackEntry = null) =>
  hasLatinLetters(
    getTrimmedString(
      movieLike?.name_original,
      movieLike?.name_en,
      movieLike?.raw_data?.name_original,
      movieLike?.raw_data?.name_en,
      movieLike?.raw_data?.Name_original,
      fallbackEntry?.name_original
    )
  )

export const getMovieSeoEntry = (kpId) =>
  runtimeMoviesByKpId.get(String(kpId)) || moviesByKpId.get(String(kpId)) || null

export const registerMovieSeoEntry = (movieLike = {}) => {
  const normalizedMovie = normalizeMovie(movieLike)
  if (!normalizedMovie) return null

  const existingEntry = getMovieSeoEntry(normalizedMovie.kp_id)
  const mergedEntry = existingEntry
    ? mergeMovieSeoEntries(existingEntry, normalizedMovie)
    : normalizedMovie

  runtimeMoviesByKpId.set(mergedEntry.kp_id, mergedEntry)
  return mergedEntry
}

export const registerMovieSeoEntries = (moviesList = []) =>
  Array.isArray(moviesList) ? moviesList.map(registerMovieSeoEntry).filter(Boolean) : []

export const needsMovieSeoEnrichment = (movieLike = {}, kpIdOverride = null) => {
  const kpId = String(movieLike?.kinopoisk_id || movieLike?.kp_id || kpIdOverride || '').trim()
  if (!kpId) return false

  return !hasCanonicalOriginalTitle(movieLike, getMovieSeoEntry(kpId))
}

export const getMovieSeoSlug = (movieLike = {}, kpIdOverride = null) => {
  const kpId = String(movieLike?.kinopoisk_id || movieLike?.kp_id || kpIdOverride || '').trim()
  const fallbackEntry = kpId ? getMovieSeoEntry(kpId) : null

  return String(getCanonicalSlugCandidate(movieLike, fallbackEntry)).trim()
}

export const buildMoviePath = (kpId, slug = '') => {
  const normalizedKpId = String(kpId || '').trim()
  const normalizedSlug = String(slug || '').trim()

  if (!normalizedKpId) return '/movie'
  return normalizedSlug ? `/movie/${normalizedKpId}/${normalizedSlug}` : `/movie/${normalizedKpId}`
}

export const getMovieSeoPath = (movieLike = {}, kpIdOverride = null) => {
  const kpId = String(movieLike?.kinopoisk_id || movieLike?.kp_id || kpIdOverride || '').trim()
  return buildMoviePath(kpId, getMovieSeoSlug(movieLike, kpIdOverride))
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
  const slug = getMovieSeoSlug(
    {
      ...movieLike,
      title: baseTitle,
      name_original: movieLike?.name_original || fallbackEntry?.name_original
    },
    kpId
  )
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
