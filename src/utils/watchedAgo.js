const MONTHS = [
  'янв.',
  'февр.',
  'марта',
  'апр.',
  'мая',
  'июня',
  'июля',
  'авг.',
  'сент.',
  'окт.',
  'нояб.',
  'дек.'
]

const plural = (n, one, few, many) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// "смотрели сегодня", "вчера", "3 дня назад", "12 нояб." — from a history entry's addedAt.
export const formatWatchedAgo = (value, now = new Date()) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // A clock a little ahead of this device still reads as today.
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (days <= 0) return 'смотрели сегодня'
  if (days === 1) return 'смотрели вчера'
  if (days < 7) return `смотрели ${days} ${plural(days, 'день', 'дня', 'дней')} назад`
  return `смотрели ${date.getDate()} ${MONTHS[date.getMonth()]}`
}
