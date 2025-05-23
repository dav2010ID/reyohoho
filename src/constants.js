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

export const handleApiError = (error) => {
  if (error.code === 'ECONNABORTED') {
    return {
      message: 'Ошибка: сервер не отвечает (таймаут)',
      code: 408
    }
  } else if (error.response) {
    if (error.response.status >= 500) {
      return {
        message: 'Ошибка на сервере. Пожалуйста, попробуйте позже',
        code: error.response.status
      }
    }

    switch (error.response.status) {
      case 403:
        return {
          message: 'Упс, недоступно по требованию правообладателя',
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
