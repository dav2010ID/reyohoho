<template>
  <div class="comments-section">
    <div v-if="!showComments" class="spoiler-warning" @click="showComments = true">
      <div class="spoiler-content">
        <i class="fas fa-eye-slash"></i>
        <h3>Комментарии скрыты</h3>
        <p>Комментарии могут содержать спойлеры. Нажмите, чтобы показать.</p>
        <div class="comments-count" :class="{ 'no-comments': totalCommentsCount === 0 }">
          <template v-if="totalCommentsCount === 0"> Комментариев пока нет </template>
          <template v-else>
            {{ totalCommentsCount }}
            {{ getCommentWordForm(totalCommentsCount) }}
          </template>
        </div>
      </div>
    </div>

    <div v-else class="comments-container">
      <div class="comments-header">
        <div class="comments-controls">
          <button
            class="sort-button"
            title="Сортировать по дате"
            :class="{ active: sortBy === 'date' }"
            @click="setSortBy('date')"
          >
            <i class="fas fa-clock"></i>
            По дате
            <i
              v-if="sortBy === 'date'"
              class="fas"
              :class="sortDirection === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'"
            ></i>
          </button>
          <button
            class="sort-button"
            title="Сортировать по рейтингу"
            :class="{ active: sortBy === 'rating' }"
            @click="setSortBy('rating')"
          >
            <i class="fas fa-thumbs-up"></i>
            По рейтингу
            <i
              v-if="sortBy === 'rating'"
              class="fas"
              :class="sortDirection === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'"
            ></i>
          </button>
        </div>
        <button class="hide-comments-btn" @click="showComments = false">
          <i class="fas fa-eye-slash"></i>
          Скрыть комментарии
        </button>
      </div>

      <div v-if="commentsLoading" class="comments-state" role="status" aria-live="polite">
        Загрузка комментариев…
      </div>
      <div v-else-if="commentsLoadError" class="comments-state comments-state--error" role="alert">
        <p>{{ commentsLoadError }}</p>
        <button type="button" class="comments-retry-btn" @click="loadComments">Повторить</button>
      </div>

      <form v-if="!commentsLoading && !commentsLoadError" class="comment-form" @submit.prevent="submitComment">
        <div class="textarea-container">
          <textarea
            ref="commentTextarea"
            v-model="newComment"
            class="comment-textarea"
            :placeholder="getCommentPlaceholder"
            :disabled="currentUser && currentUser.allow_comments !== 1"
            rows="3"
            maxlength="1500"
            @input="autoResize"
            @keydown="handleCommentKeydown"
          ></textarea>
        </div>
        <div class="comment-footer">
          <div class="comment-actions">
            <button
              class="submit-button"
              type="submit"
              :disabled="
                !newComment.trim() ||
                newComment.length > 1500 ||
                (currentUser && currentUser.allow_comments !== 1)
              "
            >
              Отправить
            </button>
          </div>
          <div class="character-counter-container">
            <div
              class="character-counter-inline"
              :class="{
                'near-limit': newComment.length > 1400,
                'at-limit': newComment.length >= 1500
              }"
            >
              {{ newComment.length }}/1500
            </div>
            <button
              type="button"
              class="emoji-button-inline"
              :class="{ active: showEmojiPicker }"
              :disabled="currentUser && currentUser.allow_comments !== 1"
              @mouseenter="handleButtonMouseEnter"
              @mouseleave="handleButtonMouseLeave"
            >
              😊
            </button>
            <button
              type="button"
              class="emoji-button-inline"
              :class="{ active: showImagePicker }"
              :disabled="currentUser && currentUser.allow_comments !== 1"
              @mouseenter="handleImageButtonMouseEnter"
              @mouseleave="handleButtonMouseLeave"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="seven-tv-icon"
              >
                <g id="logo">
                  <path
                    d="M20.7465 5.48825L21.9799 3.33745L22.646 2.20024L21.4125 0.0494437V0H14.8259L17.2928 4.3016L17.9836 5.48825H20.7465Z"
                  />
                  <path
                    d="M7.15395 19.9258L14.5546 7.02104L15.4673 5.43884L13.0004 1.13724L12.3097 0.0247596H1.8995L0.666057 2.17556L0 3.31276L1.23344 5.46356V5.51301H9.12745L2.96025 16.267L2.09685 17.7998L3.33029 19.9506V20H7.15395"
                  />
                  <path
                    d="M17.4655 19.9257H21.2398L26.1736 11.3225L27.037 9.83924L25.8036 7.68844V7.63899H22.0046L19.5377 11.9406L19.365 12.262L16.8981 7.96038L16.7255 7.63899L14.2586 11.9406L13.5679 13.1272L17.2682 19.5796L17.4655 19.9257Z"
                  />
                </g>
              </svg>
            </button>
            <button
              type="button"
              title="Добавить спойлер"
              class="emoji-button-inline spoiler-button"
              :disabled="currentUser && currentUser.allow_comments !== 1"
              @click="insertSpoiler"
            >
              <i class="fas fa-eye-slash"></i>
            </button>
            <button
              type="button"
              title="Добавить ссылку"
              class="emoji-button-inline link-button"
              @click="insertLink"
            >
              <i class="fas fa-link"></i>
            </button>
            <EmojiPicker
              :is-visible="showEmojiPicker && canComment"
              @emoji-selected="insertEmoji"
              @mouse-enter="handleEmojiMouseEnter"
              @mouse-leave="handleEmojiMouseLeave"
              @close="closeEmojiPicker"
            />
            <ImagePicker
              :is-visible="showImagePicker && canComment"
              :current-user="currentUser"
              @image-selected="insertImage"
              @mouse-enter="handleImageMouseEnter"
              @mouse-leave="handleImageMouseLeave"
              @close="closeImagePicker"
              @login-required="openLogin"
            />
            <LinkModal
              :is-visible="showLinkModal"
              :selected-text="selectedTextForLink"
              @close="closeLinkModal"
              @submit="insertLinkFromModal"
            />
          </div>
        </div>
      </form>

      <div v-if="!commentsLoading && !commentsLoadError" class="comments-list">
        <template v-for="comment in displayedComments" :key="comment.id">
          <CommentThread
            :comment="comment"
            :current-user="currentUser"
            :reply-to="replyTo"
            :reply-content="replyContent"
            :editing-comment-id="editingCommentId"
            :is-first-comment="false"
            @reply="handleReply"
            @start-edit="handleStartEdit"
            @cancel-edit="handleCancelEdit"
            @edit="handleEdit"
            @delete="handleDelete"
            @rate="handleRate"
            @submit-reply="submitReply"
            @cancel-reply="replyTo = null"
            @update-reply-content="replyContent = $event"
            @reply-keydown="handleReplyKeydown"
          />
        </template>
        <div v-if="hasMoreComments" class="show-more-comments">
          <button class="show-more-btn" @click="showMoreComments">
            Показать еще {{ remainingCommentsCount }}
            {{ getCommentWordForm(remainingCommentsCount) }}
          </button>
        </div>
      </div>
    </div>

    <Notification ref="notificationRef" />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { getComments, createComment, updateComment, deleteComment, rateComment } from '@/api/movies'
import CommentThread from './CommentThread.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import ImagePicker from '@/components/ImagePicker.vue'
import LinkModal from '@/components/LinkModal.vue'
import { useCommentActions } from '@/composables/useCommentActions'
import { useNotificationService } from '@/composables/useNotificationService'
import { getCommentWordForm } from '@/utils/textUtils'
import { useMainStore } from '@/store/main'
import { useCommentsData } from '@/composables/useCommentsData'

export default {
  name: 'Comments',
  components: {
    CommentThread,
    Notification,
    EmojiPicker,
    ImagePicker,
    LinkModal
  },
  props: {
    movieId: {
      type: [String, Number],
      required: true
    }
  },
  setup(props) {
    const authStore = useAuthStore()
    const router = useRouter()
    const mainStore = useMainStore()
    const {
      comments,
      commentsLoading,
      commentsLoadError,
      loadCommentsData,
      cancelCommentsLoad
    } = useCommentsData({ movieId: () => props.movieId, fetchComments: getComments })
    const newComment = ref('')
    const replyTo = ref(null)
    const replyContent = ref('')
    const editingCommentId = ref(null)
    const currentUser = ref(authStore.user)
    const notificationRef = ref(null)
    const commentTextarea = ref(null)
    const showComments = ref(mainStore.isAutoShowComments)
    const isInsertingEmoji = ref(false)
    const displayedCommentsCount = ref(3)
    const sortBy = ref(mainStore.commentsSortBy)
    const sortDirection = ref(sortBy.value === 'date' ? 'asc' : 'desc')
    const openLogin = () => {
      router.push('/login')
    }
    const { notify, notifyAuthRequired } = useNotificationService(notificationRef, openLogin)

    const {
      showEmojiPicker,
      showImagePicker,
      showLinkModal,
      selectedTextForLink,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      handleImageMouseEnter,
      handleImageMouseLeave,
      handleButtonMouseEnter,
      handleImageButtonMouseEnter,
      handleButtonMouseLeave,
      closeEmojiPicker,
      closeImagePicker,
      closeLinkModal,
      insertEmojiUniversal,
      insertImageUniversal,
      insertLinkUniversal,
      insertLinkFromModalUniversal,
      insertSpoilerUniversal,
      autoResize
    } = useCommentActions()

    const groupedComments = computed(() => {
      const buildCommentTree = (parentId = null) => {
        const filteredComments = comments.value
          .filter((comment) => comment.parent_id === parentId)
          .filter((comment) => {
            return !comment.is_deleted || (comment.replies && comment.replies.length > 0)
          })

        let sortedComments
        if (parentId === null) {
          sortedComments = filteredComments.sort((a, b) => {
            if (sortBy.value === 'rating') {
              const ratingA = a.rating || 0
              const ratingB = b.rating || 0
              if (ratingA !== ratingB) {
                return sortDirection.value === 'asc' ? ratingA - ratingB : ratingB - ratingA
              }
              return a.id - b.id
            }

            return sortDirection.value === 'asc' ? a.id - b.id : b.id - a.id
          })
        } else {
          sortedComments = filteredComments.sort((a, b) => a.id - b.id)
        }

        return sortedComments.map((comment) => ({
          ...comment,
          replies: buildCommentTree(comment.id)
        }))
      }

      return buildCommentTree()
    })

    const totalCommentsCount = computed(() => {
      const countCommentsRecursively = (commentsList) => {
        return commentsList.reduce((total, comment) => {
          return total + 1 + countCommentsRecursively(comment.replies || [])
        }, 0)
      }

      return countCommentsRecursively(groupedComments.value)
    })

    const displayedComments = computed(() => {
      return groupedComments.value.slice(0, displayedCommentsCount.value)
    })

    const hasMoreComments = computed(() => {
      return groupedComments.value.length > displayedCommentsCount.value
    })

    const remainingCommentsCount = computed(() => {
      return groupedComments.value.length - displayedCommentsCount.value
    })

    const showMoreComments = () => {
      displayedCommentsCount.value = groupedComments.value.length
    }

    const setSortBy = (newSortBy) => {
      if (sortBy.value === newSortBy) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      } else {
        sortBy.value = newSortBy
        sortDirection.value = newSortBy === 'date' ? 'asc' : 'desc'
        mainStore.setCommentsSortBy(newSortBy)
      }
    }

    const loadComments = async () => {
      const loaded = await loadCommentsData()
      if (loaded === false) {
        notify(
          'Ошибка при загрузке комментариев. Попробуйте обновить страницу.'
        )
      }
    }

    const submitComment = async () => {
      if (isInsertingEmoji.value) return

      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notify('У вас нет прав на создание комментариев')
        return
      }

      const contentWithoutEmptyTags = newComment.value
        .replace(/\[spoiler\]\s*\[\/spoiler\]/g, '')
        .replace(/\[img\]\s*\[\/img\]/g, '')
        .replace(/\[link=[^\]]+\]\s*\[\/link\]/g, '')
        .trim()

      if (!contentWithoutEmptyTags) {
        notify('Комментарий не может быть пустым')
        return
      }

      if (newComment.value.length > 1500) {
        notify(
          'Комментарий слишком длинный. Максимум 1500 символов.'
        )
        return
      }

      try {
        await createComment(props.movieId, newComment.value.trim())
        newComment.value = ''
        await loadComments()

        showComments.value = true

        nextTick(() => {
          if (commentTextarea.value) {
            commentTextarea.value.focus()
            commentTextarea.value.style.height = 'auto'
          }

          setTimeout(() => {
            const allComments = document.querySelectorAll('.comment-item[data-comment-id]')
            if (allComments.length > 0) {
              const commentIds = Array.from(allComments)
                .map((comment) => parseInt(comment.getAttribute('data-comment-id')))
                .filter((id) => !isNaN(id))

              if (commentIds.length > 0) {
                const maxId = Math.max(...commentIds)
                const newComment = document.querySelector(`[data-comment-id="${maxId}"]`)

                if (newComment) {
                  newComment.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                  })
                }
              }
            }
          }, 300)
        })
      } catch (error) {
        console.error('Failed to create comment:', error)
        notify(
          'Ошибка при создании комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleReply = (comment) => {
      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      editingCommentId.value = null

      replyTo.value = comment
      replyContent.value = ''
      nextTick(() => {
        const replyForm = document.querySelector('.reply-form')
        if (replyForm) {
          replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }

    const submitReply = async () => {
      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notify('У вас нет прав на создание комментариев')
        return
      }

      if (!replyContent.value.trim() || !replyTo.value) return

      if (replyContent.value.length > 1500) {
        notify('Ответ слишком длинный. Максимум 1500 символов.')
        return
      }

      try {
        await createComment(props.movieId, replyContent.value.trim(), replyTo.value.id)
        const parentCommentId = replyTo.value.id

        await loadComments()
        replyContent.value = ''
        replyTo.value = null

        nextTick(() => {
          setTimeout(() => {
            const parentComment = document.querySelector(`[data-comment-id="${parentCommentId}"]`)
            if (parentComment) {
              const repliesContainer = parentComment.querySelector('.replies-content')
              if (repliesContainer) {
                const replyComments = repliesContainer.querySelectorAll(
                  '.comment-item[data-comment-id]'
                )
                if (replyComments.length > 0) {
                  const replyIds = Array.from(replyComments)
                    .map((comment) => parseInt(comment.getAttribute('data-comment-id')))
                    .filter((id) => !isNaN(id))

                  if (replyIds.length > 0) {
                    const maxReplyId = Math.max(...replyIds)
                    const newReply = document.querySelector(`[data-comment-id="${maxReplyId}"]`)

                    if (newReply) {
                      newReply.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                      })
                    }
                  }
                }
              }
            }
          }, 300)
        })
      } catch (error) {
        console.error('Error submitting reply:', error)
        notify('Ошибка при отправке ответа. Попробуйте еще раз.')
      }
    }

    const handleEdit = async (commentId, newContent) => {
      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notify('У вас нет прав на редактирование комментариев')
        return
      }

      if (newContent.length > 1500) {
        notify(
          'Комментарий слишком длинный. Максимум 1500 символов.'
        )
        return
      }

      try {
        await updateComment(commentId, newContent.trim())
        await loadComments()
        editingCommentId.value = null
      } catch (error) {
        console.error('Failed to update comment:', error)
        notify(
          'Ошибка при редактировании комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleDelete = async (commentId) => {
      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      try {
        await deleteComment(commentId)
        await loadComments()
      } catch (error) {
        console.error('Failed to delete comment:', error)
        notify(
          'Ошибка при удалении комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleRate = async (commentId, rating) => {
      if (!authStore.token) {
        notifyAuthRequired()
        return
      }

      try {
        await rateComment(commentId, rating)
        await loadComments()
      } catch (error) {
        console.error('Failed to rate comment:', error)
        notify('Ошибка при оценке комментария. Попробуйте еще раз.')
      }
    }

    const handleCommentKeydown = (event) => {
      if (isInsertingEmoji.value || showEmojiPicker.value) return

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submitComment()
      }
    }

    const handleReplyKeydown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submitReply()
      }
    }

    const insertEmoji = (emoji) => {
      isInsertingEmoji.value = true
      insertEmojiUniversal(emoji, commentTextarea, newComment, (value) => {
        newComment.value = value
      })
      setTimeout(() => {
        isInsertingEmoji.value = false
      }, 100)
    }

    const insertImage = (imageUrl) => {
      insertImageUniversal(imageUrl, commentTextarea, newComment, (value) => {
        newComment.value = value
      })
    }

    const insertSpoiler = () => {
      insertSpoilerUniversal(commentTextarea, newComment, (value) => {
        newComment.value = value
      })
    }

    const insertLink = () => {
      insertLinkUniversal(commentTextarea, newComment, (value) => {
        newComment.value = value
      })
    }

    const insertLinkFromModal = (linkData) => {
      insertLinkFromModalUniversal(linkData, commentTextarea, newComment, (value) => {
        newComment.value = value
      })
    }

    const getCommentPlaceholder = computed(() => {
      if (!currentUser.value) {
        return 'Войдите, чтобы оставить комментарий...'
      }
      if (currentUser.value.allow_comments !== 1) {
        return 'У вас нет прав на создание комментариев'
      }
      return 'Напишите комментарий...'
    })

    const canComment = computed(() => {
      if (!currentUser.value) return true
      return currentUser.value.allow_comments === 1
    })

    const handleStartEdit = (commentId) => {
      replyTo.value = null
      replyContent.value = ''

      editingCommentId.value = commentId
    }

    const handleCancelEdit = () => {
      editingCommentId.value = null
    }

    onMounted(() => {
      loadComments()
    })

    watch(
      () => props.movieId,
      (movieId, previousMovieId) => {
        if (movieId && previousMovieId && movieId !== previousMovieId) loadComments()
      }
    )

    onUnmounted(cancelCommentsLoad)

    return {
      comments,
      commentsLoading,
      commentsLoadError,
      loadComments,
      groupedComments,
      displayedComments,
      hasMoreComments,
      remainingCommentsCount,
      showMoreComments,
      sortBy,
      setSortBy,
      sortDirection,
      newComment,
      replyTo,
      replyContent,
      editingCommentId,
      currentUser,
      notificationRef,
      commentTextarea,
      showComments,
      submitComment,
      handleReply,
      submitReply,
      handleEdit,
      handleDelete,
      handleRate,
      handleCommentKeydown,
      handleReplyKeydown,
      autoResize,
      totalCommentsCount,
      getCommentWordForm,
      showEmojiPicker,
      showImagePicker,
      showLinkModal,
      selectedTextForLink,
      insertEmoji,
      insertImage,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      handleImageMouseEnter,
      handleImageMouseLeave,
      closeEmojiPicker,
      closeImagePicker,
      handleButtonMouseLeave,
      handleButtonMouseEnter,
      handleImageButtonMouseEnter,
      getCommentPlaceholder,
      canComment,
      handleStartEdit,
      handleCancelEdit,
      insertSpoiler,
      insertLink,
      insertLinkFromModal,
      closeLinkModal,
      openLogin
    }
  }
}
</script>

<style scoped src="./Comments.css"></style>
