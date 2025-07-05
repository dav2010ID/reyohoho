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
            :class="{ active: sortBy === 'date' }"
            @click="setSortBy('date')"
            title="Сортировать по дате"
          >
            <i class="fas fa-clock"></i>
            По дате
          </button>
          <button
            class="sort-button"
            :class="{ active: sortBy === 'rating' }"
            @click="setSortBy('rating')"
            title="Сортировать по рейтингу"
          >
            <i class="fas fa-thumbs-up"></i>
            По рейтингу
          </button>
        </div>
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
              class="emoji-button-inline spoiler-button"
              :disabled="currentUser && currentUser.allow_comments !== 1"
              @click="insertSpoiler"
              title="Добавить спойлер"
            >
              <i class="fas fa-eye-slash"></i>
            </button>
            <button
              type="button"
              class="emoji-button-inline link-button"
              @click="insertLink"
              title="Добавить ссылку"
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

      <div class="comments-list">
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
import { ref, onMounted, nextTick, computed } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { getComments, createComment, updateComment, deleteComment, rateComment } from '@/api/movies'
import CommentThread from './CommentThread.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import ImagePicker from '@/components/ImagePicker.vue'
import LinkModal from '@/components/LinkModal.vue'
import { useCommentActions } from '@/composables/useCommentActions'
import { getCommentWordForm } from '@/utils/textUtils'
import { useMainStore } from '@/store/main'

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
    const comments = ref([])
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
              const ratingDiff = (b.rating || 0) - (a.rating || 0)
              if (ratingDiff !== 0) return ratingDiff
              return a.id - b.id
            }
            return a.id - b.id
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
      if (sortBy.value === newSortBy) return
      sortBy.value = newSortBy
      mainStore.setCommentsSortBy(newSortBy)
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

      const contentWithoutEmptyTags = newComment.value
        .replace(/\[spoiler\]\s*\[\/spoiler\]/g, '')
        .replace(/\[img\]\s*\[\/img\]/g, '')
        .replace(/\[link=[^\]]+\]\s*\[\/link\]/g, '')
        .trim()

      if (!contentWithoutEmptyTags) {
        notificationRef.value.showNotification('Комментарий не может быть пустым')
        return
      }

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

    return {
      comments,
      groupedComments,
      displayedComments,
      hasMoreComments,
      remainingCommentsCount,
      showMoreComments,
      sortBy,
      setSortBy,
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
      closeLinkModal
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
  border-color: var(--accent-color);
}

.comment-textarea:disabled {
  background: #1a1a1a;
  color: #666;
  cursor: not-allowed;
  border-color: #333;
}

.submit-button {
  padding: 0.25rem 0.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.8rem;
}

.submit-button:hover:not(:disabled) {
  background: var(--accent-hover);
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
  border-left: 2px solid var(--accent-transparent);
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
  border-left: 2px solid var(--accent-semi-transparent);
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
  color: var(--accent-color);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.auth-link:hover {
  color: var(--accent-hover);
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
  border-color: var(--accent-color);
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
  color: var(--accent-color);
  margin-bottom: 0.25rem;
  transition: all 0.3s ease;
}

.spoiler-warning:hover .spoiler-content i {
  transform: scale(1.05);
  color: var(--accent-hover);
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
  background: var(--accent-transparent);
  color: var(--accent-color);
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--accent-semi-transparent);
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
  gap: 1rem;
}

.comments-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.comments-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-button {
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
  position: relative;
}

.sort-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  color: var(--accent-color);
  transform: translateY(-1px);
}

.sort-button i {
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.sort-button:hover i {
  opacity: 1;
}

.sort-button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.sort-button.active:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: white;
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
  margin-left: 0.25rem;
}

.emoji-button-inline:hover {
  color: #fff;
}

.emoji-button-inline.active {
  color: var(--accent-color);
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

.seven-tv-icon {
  height: 1.2em;
  width: auto;
  vertical-align: middle;
  fill: currentColor;
}

.inline-emoji {
  display: inline-block;
  vertical-align: middle;
  height: 1.2em;
  width: auto;
  margin: 0 0.1em;
}

:deep(.spoiler-text) {
  background: rgba(64, 64, 64, 0.8);
  color: transparent;
  cursor: pointer;
  padding: 0.2em 0.6em;
  border-radius: 4px;
  transition: all 0.3s ease;
  user-select: none;
  position: relative;
  display: inline-block;
  min-width: 60px;
  text-align: center;
}

:deep(.spoiler-text:hover) {
  background: rgba(64, 64, 64, 0.9);
}

:deep(.spoiler-text::before) {
  content: 'спойлер';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-size: 0.85em;
  white-space: nowrap;
  pointer-events: none;
  font-weight: 500;
}

:deep(.spoiler-text a) {
  color: transparent !important;
  text-decoration: none !important;
  border-bottom: none !important;
  pointer-events: none !important;
}

:deep(.spoiler-text.revealed) {
  background: transparent;
  color: inherit;
  user-select: text;
  min-width: auto;
  text-align: left;
  padding: 0;
}

:deep(.spoiler-text.revealed::before) {
  display: none;
}

:deep(.spoiler-text.revealed a) {
  color: #4a90e2 !important;
  text-decoration: none !important;
  border-bottom: 1px solid transparent !important;
  transition:
    color 0.2s ease,
    border-bottom-color 0.2s ease !important;
  pointer-events: auto !important;
}

:deep(.spoiler-text.revealed a:hover) {
  color: #66a3e0 !important;
  border-bottom-color: #66a3e0 !important;
}

:deep(.spoiler-text.revealed a:visited) {
  color: #8a7ca8 !important;
}

:deep(.spoiler-text.revealed a:visited:hover) {
  color: #a393c2 !important;
  border-bottom-color: #a393c2 !important;
}

.spoiler-button {
  color: #999;
}

.spoiler-button:hover {
  color: var(--accent-hover);
}

.spoiler-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-button {
  color: #999;
}

.link-button:hover {
  color: var(--accent-hover);
}

.link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.show-more-comments {
  text-align: center;
  margin-top: 1rem;
}

.show-more-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.8rem;
  border: 1px solid var(--accent-semi-transparent);
}

.show-more-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--accent-transparent);
}

.show-more-btn:disabled {
  background: #666;
  cursor: not-allowed;
  border-color: rgba(128, 128, 128, 0.3);
}

@media (max-width: 768px) {
  .comments-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .comments-controls {
    justify-content: center;
    order: 2;
  }

  .sort-button {
    flex: 1;
    justify-content: center;
    min-height: 44px;
  }

  .hide-comments-btn {
    order: 1;
    align-self: flex-end;
    min-height: 44px;
  }

  .comment-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .character-counter-container {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .comment-actions {
    justify-content: flex-start;
  }

  .character-counter-inline {
    order: -1;
    margin-right: auto;
    margin-bottom: 0.25rem;
  }

  .emoji-button-inline {
    flex-shrink: 0;
    padding: 0.375rem 0.5rem;
    min-width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .character-counter-container {
    justify-content: flex-start;
    gap: 0.25rem;
  }

  .emoji-button-inline {
    padding: 0.25rem 0.375rem;
    min-width: 40px;
    height: 40px;
    font-size: 0.9rem;
  }

  .character-counter-inline {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    width: 100%;
    text-align: center;
  }

  .submit-button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    width: 100%;
  }

  .comment-form {
    margin-bottom: 1rem;
  }

  .comment-textarea {
    font-size: 16px;
  }
}

@media (max-width: 360px) {
  .sort-button {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }

  .hide-comments-btn {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }

  .emoji-button-inline {
    min-width: 36px;
    height: 36px;
    padding: 0.2rem 0.3rem;
    font-size: 0.8rem;
  }

  .character-counter-inline {
    font-size: 0.65rem;
  }
}

.comment-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  border-left: 2px solid var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.reply-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
