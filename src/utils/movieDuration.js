export const formatMovieDuration = (value) => {
  const minutes = typeof value === 'string' ? Number(value.trim()) : value
  if (!Number.isFinite(minutes) || minutes <= 0) return ''

  const roundedMinutes = Math.round(minutes)
  const hours = Math.floor(roundedMinutes / 60)
  const remainingMinutes = roundedMinutes % 60
  if (hours === 0) return `${remainingMinutes} мин.`
  if (remainingMinutes === 0) return `${hours} ч.`
  return `${hours} ч. ${remainingMinutes} мин.`
}
