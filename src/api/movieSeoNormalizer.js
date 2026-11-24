import {
  getMovieSeoEntry,
  getMovieSeoSlug,
  needsMovieSeoEnrichment,
  registerMovieSeoEntry
} from '@/utils/movieSeo'

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

  const existingEntry = getMovieSeoEntry(kpId)
  const registeredEntry = needsMovieSeoEnrichment(item, kpId) ? existingEntry : registerMovieSeoEntry(item)
  const canonicalEntry = seoEntry || registeredEntry || existingEntry
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

// Cards carry their own SEO fields (slug, original title); the static catalogue
// fills the rest. No extra provider is queried for list entries.
export const normalizeMovieListResponse = async (data) =>
  Array.isArray(data) ? data.map((item) => normalizeMovieListEntry(item)) : data
