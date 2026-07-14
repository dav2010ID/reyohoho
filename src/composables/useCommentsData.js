import { ref } from 'vue'
import { isRequestCanceled } from '@/utils/requestCancellation'

export const useCommentsData = ({ movieId, fetchComments }) => {
  const comments = ref([])
  const commentsLoading = ref(false)
  const commentsLoadError = ref('')
  let activeController = null

  const loadCommentsData = async () => {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    commentsLoading.value = true
    commentsLoadError.value = ''
    try {
      comments.value = (await fetchComments(movieId(), { signal: controller.signal })) || []
      return true
    } catch (error) {
      if (isRequestCanceled(error)) return null
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
    commentsLoadError,
    loadCommentsData,
    cancelCommentsLoad
  }
}
