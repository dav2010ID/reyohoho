import { ref } from 'vue'
import { isRequestCanceled } from '@/utils/requestCancellation'

// Accept both legacy flat responses and the backend's nested reply tree.
export const flattenComments = (items) => {
  const result = new Map()
  const pending = [...(Array.isArray(items) ? items : [])]
  while (pending.length) {
    const item = pending.pop()
    if (!item || result.has(item.id)) continue
    result.set(item.id, item)
    if (Array.isArray(item.replies)) pending.push(...item.replies)
  }
  return [...result.values()].reverse()
}

export const useCommentsData = ({ movieId, fetchComments }) => {
  const comments = ref([])
  const commentsLoading = ref(false)
  const commentsLoadError = ref('')
  const commentsLoaded = ref(false)
  let activeController = null

  const loadCommentsData = async () => {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    commentsLoaded.value = false
    commentsLoading.value = true
    commentsLoadError.value = ''
    try {
      const loaded = await fetchComments(movieId(), { signal: controller.signal })
      if (activeController !== controller || controller.signal.aborted) return null
      commentsLoaded.value = true
      comments.value = flattenComments(loaded)
      return true
    } catch (error) {
      if (activeController !== controller || controller.signal.aborted || isRequestCanceled(error))
        return null
      commentsLoadError.value = 'Не удалось загрузить комментарии.'
      return false
    } finally {
      if (activeController === controller) {
        activeController = null
        commentsLoading.value = false
      }
    }
  }

  const cancelCommentsLoad = () => {
    activeController?.abort()
    activeController = null
    commentsLoading.value = false
  }

  return {
    comments,
    commentsLoading,
    commentsLoaded,
    commentsLoadError,
    loadCommentsData,
    cancelCommentsLoad
  }
}
