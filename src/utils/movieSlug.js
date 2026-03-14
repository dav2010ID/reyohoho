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

export const resolveSlugSource = (movie = {}) => {
  const originalTitle = getTrimmedString(
    movie?.name_original,
    movie?.name_en,
    movie?.raw_data?.name_original,
    movie?.raw_data?.name_en,
    movie?.raw_data?.Name_original
  )
  const localizedTitle = getTrimmedString(
    movie?.name_russian,
    movie?.title,
    movie?.name_ru,
    movie?.raw_data?.name_ru,
    movie?.raw_data?.nameRu
  )

  if (hasLatinLetters(originalTitle)) return originalTitle
  return localizedTitle || originalTitle
}

export const toSlug = (valueOrMovie) => {
  if (valueOrMovie && typeof valueOrMovie === 'object') {
    return sanitizeSlug(transliterateCyrillic(resolveSlugSource(valueOrMovie)))
  }

  return sanitizeSlug(transliterateCyrillic(valueOrMovie))
}

export const getCanonicalSlugCandidate = (movieLike = {}, fallbackEntry = null) =>
  getTrimmedString(
    toSlug({
      name_original:
        movieLike?.name_original ||
        movieLike?.name_en ||
        movieLike?.raw_data?.name_original ||
        movieLike?.raw_data?.name_en ||
        movieLike?.raw_data?.Name_original ||
        fallbackEntry?.name_original,
      name_en:
        movieLike?.name_en ||
        movieLike?.raw_data?.name_en ||
        movieLike?.raw_data?.Name_original ||
        fallbackEntry?.name_original,
      title:
        movieLike?.name_russian ||
        movieLike?.title ||
        movieLike?.name_ru ||
        movieLike?.raw_data?.name_ru ||
        movieLike?.raw_data?.nameRu ||
        fallbackEntry?.title,
      name_ru:
        movieLike?.name_ru ||
        movieLike?.name_russian ||
        movieLike?.raw_data?.name_ru ||
        movieLike?.raw_data?.nameRu ||
        fallbackEntry?.title
    }),
    movieLike?.slug,
    movieLike?.seo_slug,
    movieLike?.raw_data?.slug,
    fallbackEntry?.slug
  )
