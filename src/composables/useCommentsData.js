import { ref } from 'vue'

export const useCommentsData = ({ movieId, fetchComments }) => {
  const comments = ref([])
  const commentsLoading = ref(false)
  const commentsLoadError = ref('')

  const loadCommentsData = async () => {
    commentsLoading.value = true
    commentsLoadError.value = ''
    try {
      comments.value = (await fetchComments(movieId())) || []
      return true
    } catch {
      commentsLoadError.value = 'Не удалось загрузить комментарии.'
      return false
    } finally {
      commentsLoading.value = false
    }
  }

  return {
    comments,
    commentsLoading,
    commentsLoadError,
    loadCommentsData
  }
}
