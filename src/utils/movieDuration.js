export const formatMovieDuration = (value) => {
  const minutes = typeof value === 'string' ? Number(value.trim()) : value
  if (!Number.isFinite(minutes) || minutes <= 0) return ''

  const roundedMinutes = Math.round(minutes)
  const hours = Math.floor(roundedMinutes / 60)
  const remainingMinutes = roundedMinutes % 60
  return `${hours} ч. ${remainingMinutes} мин.`
}
