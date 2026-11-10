export const TYPES_ENUM = {
  FILM: 'Фильм',
  TV_SERIES: 'Сериал',
  VIDEO: 'Видео',
  TV_SHOW: 'ТВ-шоу',
  MINI_SERIES: 'Мини-сериал',
  ANIME: 'Аниме'
}

export const USER_LIST_TYPES_ENUM = {
  FAVORITE: 'favorite',
  LATER: 'later',
  WATCHING: 'watching',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  HISTORY: 'history',
  RATED: 'rated'
}

export const DEFAULT_ACTIVE_TIME = '24h'

export const handleApiError = (error) => {
  if (error.code === 'ECONNABORTED' || error.name === 'TimeoutError') {
    return {
      message: 'Ошибка: сервер не отвечает (таймаут)',
      code: 408
    }
  } else if (error.response) {
    const headers = error.response.headers
    const raw = headers?.get?.('Retry-After') ?? headers?.['retry-after']
    const seconds = raw ? (Number.isFinite(Number(raw)) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000)) : 0
    const retry = seconds > 0 ? ` Повторите через ${seconds} с.` : ' Попробуйте позже.'

    if (error.response.status >= 500) {
      return {
        message: 'Ошибка на сервере.' + retry,
        code: error.response.status
      }
    }

    switch (error.response.status) {
      case 429:
        return { message: 'Слишком много запросов.' + retry, code: 429 }
      case 403:
        return {
          message: 'Сервер отказал в доступе',
          code: 403
        }
      case 404:
        return {
          message: 'Данные не найдены',
          code: 404
        }
      case 401:
        return {
          message: 'Не авторизован, попробуйте перезайти',
          code: 401
        }
      default:
        return {
          message: `Произошла неизвестная ошибка. Ошибка: ${error.response.data?.status ?? error.response.status}`,
          code: error.response.status
        }
    }
  } else {
    return {
      message: `Ошибка: ${error.message}`,
      code: null
    }
  }
}
