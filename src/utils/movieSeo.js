import { normalizeBasePath } from './basePath'
import movies from '../data/movies.json'
import {
  buildFallbackSlug,
  getMovieIdentifier,
  getTrimmedString,
  resolveCanonicalMovieIdentity
} from './movieSlug'

const FALLBACK_DESCRIPTION =
  'ReYohoho - online movie and TV streaming with collections, ratings, and simple navigation.'
const SITE_NAME = 'ReYohoho'
const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || 'https://dav2010id.github.io'
const SITE_BASE_PATH = import.meta.env.VITE_BASE_URL || '/reyohoho'
const runtimeMoviesByKpId = new Map()

const BASE_PATH = normalizeBasePath(SITE_BASE_PATH)

const normalizeMovie = (movie) => {
  const identity = resolveCanonicalMovieIdentity(movie)
  const kpId = identity.kpId
  const title = identity.localizedTitle || identity.originalTitle

  if (!kpId || !title) return null

  const year = movie?.year ? String(movie.year).trim() : ''
  const description = String(movie?.description || FALLBACK_DESCRIPTION).trim()
  const poster = String(movie?.poster || movie?.poster_url || '').trim()
  const updatedAt = String(movie?.updatedAt || movie?.updated_at || '').trim()

  return {
    kp_id: kpId,
    slug: identity.slug,
    title,
    name_ru: identity.localizedTitle,
    year,
    description,
    poster,
    updatedAt,
    name_original: identity.originalTitle
  }
}

const normalizedMovies = Array.isArray(movies) ? movies.map(normalizeMovie).filter(Boolean) : []
const moviesByKpId = new Map(normalizedMovies.map((movie) => [movie.kp_id, movie]))

const mergeMovieSeoEntries = (existing = {}, incoming = {}) => {
  const kpId = String(incoming?.kp_id || existing?.kp_id || '').trim()

  return {
    kp_id: kpId,
    title: getTrimmedString(incoming?.title, existing?.title),
    name_ru: getTrimmedString(incoming?.name_ru, existing?.name_ru, incoming?.title, existing?.title),
    name_original: getTrimmedString(incoming?.name_original, existing?.name_original),
    year: getTrimmedString(incoming?.year, existing?.year),
    description: getTrimmedString(incoming?.description, existing?.description, FALLBACK_DESCRIPTION),
    poster: getTrimmedString(incoming?.poster, existing?.poster),
    updatedAt: getTrimmedString(incoming?.updatedAt, existing?.updatedAt),
    slug: resolveCanonicalMovieIdentity(incoming, existing, kpId).slug
  }
}

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
  const kpId = getMovieIdentifier(movieLike, kpIdOverride)
  if (!kpId) return false

  const fallbackEntry = getMovieSeoEntry(kpId)
  const identity = resolveCanonicalMovieIdentity(movieLike, fallbackEntry, kpId)

  return !fallbackEntry || identity.slug === buildFallbackSlug(kpId) || !fallbackEntry.name_original
}

export const getMovieSeoSlug = (movieLike = {}, kpIdOverride = null) => {
  const kpId = getMovieIdentifier(movieLike, kpIdOverride)
  const fallbackEntry = kpId ? getMovieSeoEntry(kpId) : null

  return resolveCanonicalMovieIdentity(movieLike, fallbackEntry, kpId).slug
}

export const buildMoviePath = (kpId, slug = '') => {
  const normalizedKpId = String(kpId || '').trim()
  const normalizedSlug = String(slug || '').trim()

  if (!normalizedKpId) return '/movie'
  return normalizedSlug ? `/movie/${normalizedKpId}/${normalizedSlug}` : `/movie/${normalizedKpId}`
}

export const getMovieSeoPath = (movieLike = {}, kpIdOverride = null) => {
  const kpId = getMovieIdentifier(movieLike, kpIdOverride)
  return buildMoviePath(kpId, getMovieSeoSlug(movieLike, kpIdOverride))
}

export const buildMovieCanonicalUrl = (kpId, slug = '') =>
  `${SITE_ORIGIN}${BASE_PATH}${buildMoviePath(kpId, slug)}`

export const buildMovieSeo = (movieLike = {}, kpIdOverride = null) => {
  const fallbackEntry = kpIdOverride ? getMovieSeoEntry(kpIdOverride) : null
  const identity = resolveCanonicalMovieIdentity(movieLike, fallbackEntry, kpIdOverride)
  const kpId = identity.kpId
  const baseTitle = String(movieLike?.title || movieLike?.name_ru || fallbackEntry?.title || identity.preferredTitle || '').trim()
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
  const slug = identity.slug
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

export const getPrerenderMovieSeoEntries = () => normalizedMovies.slice()
