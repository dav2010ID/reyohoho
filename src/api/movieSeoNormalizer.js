import * as kinobd from '@/api/movies.kinobd'
import {
  getMovieSeoSlug,
  needsMovieSeoEnrichment,
  registerMovieSeoEntry
} from '@/utils/movieSeo'

const SEO_ENRICHMENT_BATCH_SIZE = 5
const seoEnrichmentPromises = new Map()

const mergeRawData = (item, seoEntry) => {
  if (!seoEntry) return item?.raw_data

  return {
    name_ru: seoEntry.name_ru || seoEntry.title || '',
    name_en: seoEntry.name_original || '',
    name_original: seoEntry.name_original || '',
    Name_original: seoEntry.name_original || '',
    ...(item?.raw_data || {})
  }
}

export const normalizeMovieListEntry = (item, seoEntry = null) => {
  if (!item || typeof item !== 'object') return item

  const kpId = String(item.kp_id || item.kinopoisk_id || item.id || '').trim()
  if (!kpId) return item

  const registeredEntry = registerMovieSeoEntry(item)
  const canonicalEntry = seoEntry || registeredEntry
  const rawData = mergeRawData(item, canonicalEntry)
  const movieForSeo = {
    ...item,
    ...canonicalEntry,
    kp_id: kpId,
    raw_data: rawData
  }

  return {
    ...item,
    kp_id: kpId,
    name_original: canonicalEntry?.name_original || item?.name_original || '',
    raw_data: rawData,
    slug: getMovieSeoSlug(movieForSeo, kpId)
  }
}

const getMovieSeoEnrichment = async (kpId) => {
  if (!seoEnrichmentPromises.has(kpId)) {
    const enrichmentPromise = kinobd
      .getMovieSeoByKpId(kpId)
      .then((movie) => (movie ? registerMovieSeoEntry(movie) : null))
      .catch(() => null)

    seoEnrichmentPromises.set(kpId, enrichmentPromise)
  }

  return seoEnrichmentPromises.get(kpId)
}

export const normalizeMovieListResponse = async (data, { enrichMissingSeo = false } = {}) => {
  if (!Array.isArray(data)) return data

  const normalizedItems = data.map((item) => normalizeMovieListEntry(item))
  if (!enrichMissingSeo) return normalizedItems

  const missingKpIds = [
    ...new Set(
      normalizedItems
        .filter((item) => needsMovieSeoEnrichment(item))
        .map((item) => String(item.kp_id || '').trim())
        .filter(Boolean)
    )
  ]

  if (!missingKpIds.length) return normalizedItems

  const enrichedEntries = new Map()

  for (let index = 0; index < missingKpIds.length; index += SEO_ENRICHMENT_BATCH_SIZE) {
    const chunk = missingKpIds.slice(index, index + SEO_ENRICHMENT_BATCH_SIZE)
    const entries = await Promise.all(chunk.map(getMovieSeoEnrichment))

    for (const entry of entries) {
      if (entry?.kp_id) enrichedEntries.set(entry.kp_id, entry)
    }
  }

  return normalizedItems.map((item) =>
    normalizeMovieListEntry(item, enrichedEntries.get(String(item?.kp_id || '').trim()) || null)
  )
}
