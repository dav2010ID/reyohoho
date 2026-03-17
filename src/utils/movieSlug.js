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

export const getTrimmedString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim()
    if (normalized) return normalized
  }

  return ''
}

export const hasLatinLetters = (value) => /[a-z]/i.test(String(value || ''))

export const transliterateCyrillic = (value) =>
  String(value || '')
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('')

export const sanitizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

export const getMovieIdentifier = (movieLike = {}, kpIdOverride = null) =>
  getTrimmedString(kpIdOverride, movieLike?.kinopoisk_id, movieLike?.kp_id, movieLike?.id_kp)

export const extractOriginalTitle = (movieLike = {}, fallbackEntry = null) =>
  getTrimmedString(
    movieLike?.name_original,
    movieLike?.name_en,
    movieLike?.raw_data?.name_original,
    movieLike?.raw_data?.name_en,
    movieLike?.raw_data?.Name_original,
    fallbackEntry?.name_original
  )

export const extractLocalizedTitle = (movieLike = {}, fallbackEntry = null) =>
  getTrimmedString(
    movieLike?.name_russian,
    movieLike?.title,
    movieLike?.name_ru,
    movieLike?.raw_data?.name_ru,
    movieLike?.raw_data?.nameRu,
    fallbackEntry?.name_ru,
    fallbackEntry?.title
  )

export const resolveCanonicalMovieTitles = (movieLike = {}, fallbackEntry = null) => {
  const localizedTitle = extractLocalizedTitle(movieLike, fallbackEntry)
  const originalTitle = extractOriginalTitle(movieLike, fallbackEntry)
  const hasLatinOriginalTitle = hasLatinLetters(originalTitle)
  const preferredTitle = hasLatinOriginalTitle ? originalTitle : localizedTitle || originalTitle

  return {
    localizedTitle,
    originalTitle,
    preferredTitle,
    hasLatinOriginalTitle
  }
}

export const buildFallbackSlug = (kpId) => {
  const normalizedKpId = String(kpId || '').trim()
  return normalizedKpId ? `movie-${normalizedKpId}` : ''
}

export const toSlug = (value) => sanitizeSlug(transliterateCyrillic(value))

const getExistingSlugCandidate = (movieLike = {}, fallbackEntry = null) =>
  getTrimmedString(
    sanitizeSlug(movieLike?.slug),
    sanitizeSlug(movieLike?.seo_slug),
    sanitizeSlug(movieLike?.raw_data?.slug),
    sanitizeSlug(fallbackEntry?.slug)
  )

export const resolveCanonicalMovieIdentity = (
  movieLike = {},
  fallbackEntry = null,
  kpIdOverride = null
) => {
  const kpId = getMovieIdentifier(movieLike, kpIdOverride)
  const titles = resolveCanonicalMovieTitles(movieLike, fallbackEntry)
  const generatedSlug = toSlug(titles.preferredTitle)
  const existingSlug = getExistingSlugCandidate(movieLike, fallbackEntry)

  return {
    kpId,
    localizedTitle: titles.localizedTitle,
    originalTitle: titles.originalTitle,
    preferredTitle: titles.preferredTitle,
    hasLatinOriginalTitle: titles.hasLatinOriginalTitle,
    slug: generatedSlug || existingSlug || buildFallbackSlug(kpId)
  }
}

export const getCanonicalSlugCandidate = (
  movieLike = {},
  fallbackEntry = null,
  kpIdOverride = null
) => resolveCanonicalMovieIdentity(movieLike, fallbackEntry, kpIdOverride).slug
