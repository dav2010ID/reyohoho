const PRODUCTION_STATUS_LABELS = Object.freeze({
  ANNOUNCED: 'Анонсирован',
  PRE_PRODUCTION: 'Подготовка к производству',
  FILMING: 'Съёмки',
  POST_PRODUCTION: 'Постпродакшн',
  ONGOING: 'Выходит',
  RELEASED: 'Вышел',
  COMPLETED: 'Завершён'
})

const EMPTY_STATUS_VALUES = new Set(['none', 'null', 'undefined'])

export const formatProductionStatus = (value) => {
  const status = String(value ?? '').trim()
  if (!status || EMPTY_STATUS_VALUES.has(status.toLowerCase())) return ''

  return PRODUCTION_STATUS_LABELS[status.toUpperCase()] || status
}
