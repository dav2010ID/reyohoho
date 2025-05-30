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
        <button class="hide-comments-btn" @click="showComments = false">
          <i class="fas fa-eye-slash"></i>
          Скрыть комментарии
        </button>
      </div>

      <form class="comment-form" @submit.prevent="submitComment">
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
            <EmojiPicker
              :is-visible="showEmojiPicker && canComment"
              @emoji-selected="insertEmoji"
              @mouse-enter="handleEmojiMouseEnter"
              @mouse-leave="handleEmojiMouseLeave"
              @close="closeEmojiPicker"
            />
          </div>
        </div>
      </form>

      <div class="comments-list">
        <template v-for="comment in groupedComments" :key="comment.id">
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
      </div>
    </div>

    <Notification ref="notificationRef" />
  </div>
</template>

<script>
import { ref, onMounted, nextTick, computed, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { getComments, createComment, updateComment, deleteComment, rateComment } from '@/api/movies'
import CommentThread from './CommentThread.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'

export default {
  name: 'Comments',
  components: {
    CommentThread,
    Notification,
    EmojiPicker
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
    const comments = ref([])
    const newComment = ref('')
    const replyTo = ref(null)
    const replyContent = ref('')
    const editingCommentId = ref(null)
    const currentUser = ref(authStore.user)
    const notificationRef = ref(null)
    const commentTextarea = ref(null)
    const showComments = ref(false)
    const showEmojiPicker = ref(false)
    const isEmojiHovered = ref(false)
    const isButtonHovered = ref(false)
    const isInsertingEmoji = ref(false)

    const groupedComments = computed(() => {
      const buildCommentTree = (parentId = null) => {
        return comments.value
          .filter((comment) => comment.parent_id === parentId)
          .sort((a, b) => a.id - b.id)
          .map((comment) => ({
            ...comment,
            replies: buildCommentTree(comment.id)
          }))
          .filter((comment) => {
            return !comment.is_deleted || (comment.replies && comment.replies.length > 0)
          })
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

    const getCommentWordForm = (count) => {
      if (count === 1) return 'комментарий'
      if (count >= 2 && count <= 4) return 'комментария'
      return 'комментариев'
    }

    const loadComments = async () => {
      try {
        const response = await getComments(props.movieId)
        comments.value = response
      } catch (error) {
        console.error('Failed to load comments:', error)
        notificationRef.value.showNotification(
          'Ошибка при загрузке комментариев. Попробуйте обновить страницу.'
        )
      }
    }

    const submitComment = async () => {
      if (isInsertingEmoji.value) return

      if (!authStore.token) {
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notificationRef.value.showNotification('У вас нет прав на создание комментариев')
        return
      }

      if (!newComment.value.trim()) return

      if (newComment.value.length > 1500) {
        notificationRef.value.showNotification(
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
        notificationRef.value.showNotification(
          'Ошибка при создании комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleReply = (comment) => {
      if (!authStore.token) {
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
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
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notificationRef.value.showNotification('У вас нет прав на создание комментариев')
        return
      }

      if (!replyContent.value.trim() || !replyTo.value) return

      if (replyContent.value.length > 1500) {
        notificationRef.value.showNotification('Ответ слишком длинный. Максимум 1500 символов.')
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
        notificationRef.value.showNotification('Ошибка при отправке ответа. Попробуйте еще раз.')
      }
    }

    const handleEdit = async (commentId, newContent) => {
      if (!authStore.token) {
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
        return
      }

      if (currentUser.value && currentUser.value.allow_comments !== 1) {
        notificationRef.value.showNotification('У вас нет прав на редактирование комментариев')
        return
      }

      if (newContent.length > 1500) {
        notificationRef.value.showNotification(
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
        notificationRef.value.showNotification(
          'Ошибка при редактировании комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleDelete = async (commentId) => {
      if (!authStore.token) {
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
        return
      }

      try {
        await deleteComment(commentId)
        await loadComments()
      } catch (error) {
        console.error('Failed to delete comment:', error)
        notificationRef.value.showNotification(
          'Ошибка при удалении комментария. Попробуйте еще раз.'
        )
      }
    }

    const handleRate = async (commentId, rating) => {
      if (!authStore.token) {
        notificationRef.value.showNotification(
          'Необходимо <a class="auth-link">авторизоваться</a>',
          5000,
          { onClick: openLogin }
        )
        return
      }

      try {
        await rateComment(commentId, rating)
        await loadComments()
      } catch (error) {
        console.error('Failed to rate comment:', error)
        notificationRef.value.showNotification('Ошибка при оценке комментария. Попробуйте еще раз.')
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

    const openLogin = () => {
      router.push('/login')
    }

    const autoResize = (event) => {
      const textarea = event?.target || commentTextarea.value
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    }

    const insertEmoji = (emoji) => {
      isInsertingEmoji.value = true

      if (commentTextarea.value) {
        const start = commentTextarea.value.selectionStart
        const end = commentTextarea.value.selectionEnd
        newComment.value = newComment.value.slice(0, start) + emoji + newComment.value.slice(end)

        nextTick(() => {
          commentTextarea.value.focus()
          commentTextarea.value.setSelectionRange(start + emoji.length, start + emoji.length)
          autoResize()

          setTimeout(() => {
            isInsertingEmoji.value = false
          }, 100)
        })
      } else {
        isInsertingEmoji.value = false
      }
    }

    const handleEmojiMouseEnter = () => {
      isEmojiHovered.value = true
    }

    const handleEmojiMouseLeave = () => {
      isEmojiHovered.value = false
      setTimeout(() => {
        if (!isEmojiHovered.value && !isButtonHovered.value) {
          showEmojiPicker.value = false
        }
      }, 300)
    }

    const closeEmojiPicker = () => {
      showEmojiPicker.value = false
    }

    const handleButtonMouseLeave = () => {
      isButtonHovered.value = false
      setTimeout(() => {
        if (!isEmojiHovered.value && !isButtonHovered.value) {
          showEmojiPicker.value = false
        }
      }, 300)
    }

    const handleButtonMouseEnter = () => {
      isButtonHovered.value = true
      showEmojiPicker.value = true
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

    onBeforeUnmount(() => {})

    return {
      comments,
      groupedComments,
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
      insertEmoji,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      closeEmojiPicker,
      handleButtonMouseLeave,
      handleButtonMouseEnter,
      getCommentPlaceholder,
      canComment,
      handleStartEdit,
      handleCancelEdit
    }
  }
}
</script>

<style scoped>
.comments-section {
  margin: 0;
  padding: 20px 0;
  overflow: visible;
}

.comments-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-bottom: 1rem;
  color: #fff;
}

.comment-form {
  margin-bottom: 1.25rem;
  width: 100%;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.textarea-container {
  position: relative;
  width: 100%;
  overflow: visible;
}

.comment-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #444;
  border-radius: 0.5rem;
  background: #2a2a2a;
  color: #fff;
  resize: none;
  box-sizing: border-box;
  min-height: 3rem;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  line-height: 1.5;
  transition: height 0.1s ease;
  font-size: 0.9rem;
}

.comment-textarea:focus {
  outline: none;
  border-color: #666;
}

.comment-textarea:disabled {
  background: #1a1a1a;
  color: #666;
  cursor: not-allowed;
  border-color: #333;
}

.submit-button {
  padding: 0.25rem 0.5rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.8rem;
}

.submit-button:hover:not(:disabled) {
  background: #357abd;
}

.submit-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  overflow: visible;
}

.comment-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  overflow: visible;
}

.replies-container {
  margin-left: 2rem;
  margin-right: 1rem;
  padding-left: 1rem;
  border-left: 2px solid #444;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: calc(100% - 3rem);
  overflow: visible;
}

.reply-form {
  margin-left: 2rem;
  margin-right: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 0.5rem;
  border-left: 2px solid #444;
  width: calc(100% - 3rem);
  overflow: visible;
}

.reply-form.nested {
  margin-left: 0;
  background: #333;
  border-left: none;
  width: 100%;
  overflow: visible;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.cancel-reply {
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.cancel-reply:hover {
  color: #fff;
}

.auth-link {
  color: #4caf50;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.auth-link:hover {
  color: #66bb6a;
}

.spoiler-warning {
  background: linear-gradient(135deg, #1a1a1b 0%, #2d2d2e 100%);
  border: 1px solid #343536;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.spoiler-warning:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    45deg,
    transparent 49%,
    rgba(255, 255, 255, 0.03) 50%,
    transparent 51%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.spoiler-warning:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border-color: #4caf50;
}

.spoiler-warning:hover:before {
  opacity: 1;
}

.spoiler-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  z-index: 1;
  gap: 0.5rem;
}

.spoiler-content i {
  font-size: 1.5rem;
  color: #4caf50;
  margin-bottom: 0.25rem;
  transition: all 0.3s ease;
}

.spoiler-warning:hover .spoiler-content i {
  transform: scale(1.05);
  color: #66bb6a;
}

.spoiler-content h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.spoiler-content p {
  font-size: 0.875rem;
  color: #999;
  margin: 0;
  line-height: 1.4;
}

.comments-count {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(76, 175, 80, 0.3);
  transition: all 0.3s ease;
}

.comments-count.no-comments {
  background: rgba(128, 128, 128, 0.2);
  color: #808080;
  border: 1px solid rgba(128, 128, 128, 0.3);
}

.spoiler-warning:hover .comments-count.no-comments {
  background: rgba(128, 128, 128, 0.3);
  border-color: rgba(128, 128, 128, 0.5);
  color: #999;
}

.comments-container {
  margin-bottom: 1rem;
  overflow: visible;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
}

.comments-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.hide-comments-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  color: #999;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.hide-comments-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: translateY(-1px);
}

.character-counter-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 10;
  overflow: visible;
}

.character-counter-inline {
  font-size: 0.75rem;
  color: #999;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.character-counter-inline.near-limit {
  color: #ffd700;
}

.character-counter-inline.at-limit {
  color: #ff0000;
}

.comment-footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 0.5rem;
  gap: 1rem;
  overflow: visible;
  position: relative;
  z-index: 5;
}

.comment-actions {
  display: flex;
  gap: 0.5rem;
  position: relative;
  overflow: visible;
}

.emoji-button-inline {
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #999;
  transition: color 0.2s ease;
}

.emoji-button-inline:hover {
  color: #fff;
}

.emoji-button-inline.active {
  color: #4caf50;
}

.emoji-button-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.comment-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #444;
}

.comment-form-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}
</style>
