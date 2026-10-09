import { addToList, delFromList, getMovieListStatus } from '@/api/user'
import { watch } from 'vue'
import { handleApiError, USER_LIST_TYPES_ENUM } from '@/constants'

const statusKeys = {
  [USER_LIST_TYPES_ENUM.FAVORITE]: 'isFavorite',
  [USER_LIST_TYPES_ENUM.HISTORY]: 'isHistory',
  [USER_LIST_TYPES_ENUM.LATER]: 'isLater',
  [USER_LIST_TYPES_ENUM.COMPLETED]: 'isCompleted',
  [USER_LIST_TYPES_ENUM.ABANDONED]: 'isAbandoned',
  [USER_LIST_TYPES_ENUM.WATCHING]: 'isWatching'
}
const listNames = {
  [USER_LIST_TYPES_ENUM.FAVORITE]: 'избранное',
  [USER_LIST_TYPES_ENUM.HISTORY]: 'историю',
  [USER_LIST_TYPES_ENUM.LATER]: 'список "Смотреть позже"',
  [USER_LIST_TYPES_ENUM.COMPLETED]: 'список "Просмотрено"',
  [USER_LIST_TYPES_ENUM.ABANDONED]: 'список "Брошено"',
  [USER_LIST_TYPES_ENUM.WATCHING]: 'список "Смотрю"'
}

// The movie page owns this state; all player/mobile buttons use the same handler.
export function usePlayerLists({
  authStore,
  kpId,
  movieInfo,
  notificationRef,
  openLogin,
  onChanged
}) {
  const pending = new Set()
  const getListStatus = (type) => Boolean(movieInfo.value?.lists?.[statusKeys[type]])
  let loadedState = null
  const loadStatus = () => {
    const movie = movieInfo.value
    const token = authStore.token
    const id = kpId.value
    if (loadedState?.movie === movie && loadedState?.token === token && loadedState?.id === id)
      return loadedState.promise
    const state = { movie, token, id }
    loadedState = state
    if (!movie) {
      state.promise = Promise.resolve(true)
      return state.promise
    }
    if (!token) {
      movie.lists = {
        ...movie.lists,
        ...Object.fromEntries(Object.values(statusKeys).map((key) => [key, false]))
      }
      state.promise = Promise.resolve(true)
      return state.promise
    }
    state.promise = (async () => {
      try {
        const status = await getMovieListStatus(id)
        if (
          loadedState !== state ||
          movieInfo.value !== movie ||
          authStore.token !== token ||
          kpId.value !== id
        )
          return false
        movie.lists = {
          ...movie.lists,
          ...Object.fromEntries(
            Object.entries(statusKeys)
              .filter(([type]) => typeof status?.[type] === 'boolean')
              .map(([type, key]) => [key, status[type]])
          )
        }
        return true
      } catch {
        if (loadedState === state) loadedState = null
        return false
      }
    })()
    return state.promise
  }
  watch(
    [() => authStore.token, kpId, movieInfo],
    (_value, previous) => {
      if (previous?.length && previous[0] !== authStore.token && movieInfo.value) {
        movieInfo.value.lists = {
          ...movieInfo.value.lists,
          ...Object.fromEntries(Object.values(statusKeys).map((key) => [key, false]))
        }
      }
      void loadStatus()
    },
    { immediate: true }
  )

  const toggleList = async (type) => {
    if (!authStore.token) {
      notificationRef.value?.showNotification(
        'Необходимо <a class="auth-link">авторизоваться</a>',
        5000,
        { onClick: openLogin }
      )
      return false
    }
    if (!statusKeys[type] || !movieInfo.value || !kpId.value) return false

    const id = kpId.value
    const token = authStore.token
    const movie = movieInfo.value
    const key = JSON.stringify([token, id, type])
    if (pending.has(key)) return false
    pending.add(key)
    const isCurrent = () =>
      kpId.value === id && authStore.token === token && movieInfo.value === movie

    try {
      // Never turn an unknown server status into a duplicate add on the first click.
      if (!(await loadStatus()) || !isCurrent()) {
        if (isCurrent())
          notificationRef.value?.showNotification(
            'Не удалось проверить списки. Попробуйте ещё раз.'
          )
        return false
      }
      const active = !getListStatus(type)
      if (active) await addToList(id, type, movie)
      else await delFromList(id, type)
      if (!isCurrent()) return false

      // Do not refetch the card: toggling infoLoading would destroy the iframe.
      movie.lists = { ...movie.lists, [statusKeys[type]]: active }
      notificationRef.value?.showNotification(
        `${active ? 'Добавлено в' : 'Удалено из'} ${listNames[type]}`
      )
      onChanged?.()
      return true
    } catch (error) {
      if (isCurrent()) {
        const { message, code } = handleApiError(error)
        notificationRef.value?.showNotification(`${message} ${code}`)
      }
      return false
    } finally {
      pending.delete(key)
    }
  }

  return { getListStatus, toggleList, loadStatus }
}
