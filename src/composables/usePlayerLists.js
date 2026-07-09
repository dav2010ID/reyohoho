import { addToList, delFromList } from '@/api/user'
import { handleApiError, USER_LIST_TYPES_ENUM } from '@/constants'

export function usePlayerLists({ authStore, emit, kpId, movieInfo, notificationRef, openLogin }) {
  const getListStatus = (listType) => {
    const statusMap = {
      [USER_LIST_TYPES_ENUM.FAVORITE]: movieInfo.value?.lists?.isFavorite || false,
      [USER_LIST_TYPES_ENUM.HISTORY]: movieInfo.value?.lists?.isHistory || false,
      [USER_LIST_TYPES_ENUM.LATER]: movieInfo.value?.lists?.isLater || false,
      [USER_LIST_TYPES_ENUM.COMPLETED]: movieInfo.value?.lists?.isCompleted || false,
      [USER_LIST_TYPES_ENUM.ABANDONED]: movieInfo.value?.lists?.isAbandoned || false,
      [USER_LIST_TYPES_ENUM.WATCHING]: movieInfo.value?.lists?.isWatching || false
    }

    return statusMap[listType] ?? false
  }

  const toggleList = async (type) => {
    if (!authStore.token) {
      notificationRef.value.showNotification(
        'Необходимо <a class="auth-link">авторизоваться</a>',
        5000,
        { onClick: openLogin }
      )
      return
    }

    let hasError = false
    try {
      const listNames = {
        [USER_LIST_TYPES_ENUM.FAVORITE]: 'избранное',
        [USER_LIST_TYPES_ENUM.HISTORY]: 'историю',
        [USER_LIST_TYPES_ENUM.LATER]: 'список "Смотреть позже"',
        [USER_LIST_TYPES_ENUM.COMPLETED]: 'список "Просмотрено"',
        [USER_LIST_TYPES_ENUM.ABANDONED]: 'список "Брошено"',
        [USER_LIST_TYPES_ENUM.WATCHING]: 'список "Смотрю"'
      }

      if (getListStatus(type)) {
        await delFromList(kpId.value, type)
        notificationRef.value.showNotification(`Удалено из ${listNames[type]}`)
      } else {
        await addToList(kpId.value, type, movieInfo.value)
        notificationRef.value.showNotification(`Добавлено в ${listNames[type]}`)
      }
    } catch (error) {
      hasError = true
      const { message, code } = handleApiError(error)
      notificationRef.value.showNotification(`${message} ${code}`)
    }

    if (!hasError) {
      emit('update:movieInfo')
    }
  }

  return {
    getListStatus,
    toggleList
  }
}
