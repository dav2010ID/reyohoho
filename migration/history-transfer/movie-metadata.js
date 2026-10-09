// Only card fields are shared between browser imports and cloud storage.
export const CARD_FIELDS = [
  'title',
  'poster',
  'year',
  'type',
  'slug',
  'rating_kp',
  'rating_imdb',
  'rating',
  'ratings_checked'
]
export const hasCardValue = (value) =>
  (typeof value === 'string' && Boolean(value.trim())) ||
  (typeof value === 'number' && Number.isFinite(value) && value > 0)

export const needsCardMetadata = (item) =>
  ['title', 'poster', 'year', 'type'].some((key) => !hasCardValue(item?.[key]))

export function fillCardMetadata(item, source) {
  const result = { ...item }
  for (const key of CARD_FIELDS) {
    if (!hasCardValue(result[key]) && hasCardValue(source?.[key])) result[key] = source[key]
  }
  return result
}
