<template>
  <div class="comment-item" :data-comment-id="comment?.id">
    <div class="comment-header">
      <div class="user-info">
        <router-link
          :to="{ path: `/lists/${comment?.user_id}` }"
          target="_blank"
          rel="noopener noreferrer"
          class="user-avatar-link"
        >
          <div class="user-avatar">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="comment?.username || 'Аноним'"
              @error="handleAvatarError"
              onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div
              v-else
              class="avatar-placeholder"
              :style="{ display: avatarUrl ? 'none' : 'flex' }"
            >
              {{ getInitials(comment?.username || 'Аноним') }}
            </div>
          </div>
        </router-link>
        <div class="user-details">
          <router-link
            :to="{ path: `/lists/${comment?.user_id}` }"
            target="_blank"
            rel="noopener noreferrer"
            class="username-link"
          >
            <span class="username">{{ comment?.username || 'Аноним' }}</span>
          </router-link>
          <span v-if="comment?.user_movie_rating" class="user-rating">
            <i class="fas fa-star"></i>
            {{ comment.user_movie_rating }}
          </span>
          <span
            class="date"
            :title="
              isCommentEdited
                ? `Создано: ${formatDate(comment?.created_at)}\nИзменено: ${formatDate(comment?.updated_at)}`
                : `Создано: ${formatDate(comment?.created_at)}`
            "
          >
            {{ formatRelativeTime(comment?.created_at) }}
            <i
              v-if="isCommentEdited"
              class="fas fa-pencil-alt edit-icon"
              :title="
                isCommentEdited
                  ? `Создано: ${formatDate(comment?.created_at)}\nИзменено: ${formatDate(comment?.updated_at)}`
                  : `Создано: ${formatDate(comment?.created_at)}`
              "
            ></i>
          </span>
        </div>
      </div>
    </div>

    <div class="comment-content">
      <div
        v-if="!comment?.is_deleted && isCommentHidden && !showHiddenComment"
        class="hidden-comment-warning"
      >
        <p
          v-if="hiddenCommentReason === 'lowRating'"
          class="warning-text"
          @click="showHiddenComment = true"
        >
          <i class="fas fa-eye-slash"></i>
          Комментарий скрыт из-за низкого рейтинга. Нажмите, чтобы показать.
        </p>
      </div>

      <div v-else>
        <div v-if="comment?.is_deleted" class="deleted-comment">
          <p class="deleted-message">
            <i class="fas fa-trash"></i>
            комментарий удалён
          </p>
        </div>

        <div v-else>
          <div v-if="isEditing" class="edit-form">
            <div class="edit-textarea-container">
              <textarea
                ref="editTextarea"
                v-model="editContent"
                class="edit-textarea"
                rows="3"
                maxlength="1500"
                @keydown="handleEditKeydown"
                @input="autoResizeEdit"
              ></textarea>
            </div>
            <div class="edit-footer">
              <div class="edit-actions">
                <button @click="cancelEdit" class="cancel-button">Отмена</button>
                <button
                  @click="saveEdit"
                  class="save-button"
                  :disabled="!editContent.trim() || editContent.length > 1500"
                >
                  Сохранить
                </button>
              </div>
              <div class="character-counter-container">
                <div
                  class="character-counter-inline"
                  :class="{
                    'near-limit': editContent.length > 1400,
                    'at-limit': editContent.length >= 1500
                  }"
                >
                  {{ editContent.length }}/1500
                </div>
                <button
                  type="button"
                  class="emoji-button-inline"
                  @mouseenter="handleButtonMouseEnter"
                  @mouseleave="handleButtonMouseLeave"
                  :class="{ active: showEmojiPicker }"
                >
                  😊
                </button>
                <button
                  type="button"
                  class="emoji-button-inline"
                  :class="{ active: showImagePicker }"
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
                  @click="insertSpoilerEdit"
                  title="Добавить спойлер"
                >
                  <i class="fas fa-eye-slash"></i>
                </button>
                <button
                  type="button"
                  class="emoji-button-inline link-button"
                  @click="insertLinkEdit"
                  title="Добавить ссылку"
                >
                  <i class="fas fa-link"></i>
                </button>
                <EmojiPicker
                  :is-visible="showEmojiPicker"
                  @emoji-selected="insertEmojiEdit"
                  @mouse-enter="handleEmojiMouseEnter"
                  @mouse-leave="handleEmojiMouseLeave"
                  @close="closeEmojiPicker"
                />
                <ImagePicker
                  :is-visible="showImagePicker"
                  :current-user="currentUser"
                  @image-selected="insertImageEdit"
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
          </div>
          <div v-else class="comment-text-container">
            <p
              class="comment-text"
              :class="{ truncated: isLongComment && !isExpanded }"
              v-html="formattedContent"
            ></p>
            <button v-if="isLongComment" @click="toggleExpanded" class="expand-button">
              {{ isExpanded ? 'Свернуть' : 'Развернуть' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="comment-footer">
      <div class="comment-actions">
        <div class="rating-buttons">
          <button
            v-if="!isCommentOwner && !comment?.is_deleted"
            @click="rateComment(1)"
            class="rating-button"
            :class="{ 'rated-up': userRating === 1 }"
          >
            <i class="fas fa-thumbs-up"></i>
          </button>
          <span
            class="rating-count"
            :class="{
              'rating-positive': userRating === 1,
              'rating-negative': userRating === -1
            }"
            >{{ comment?.rating || 0 }}</span
          >
          <button
            v-if="!isCommentOwner && !comment?.is_deleted"
            @click="rateComment(-1)"
            class="rating-button"
            :class="{ 'rated-down': userRating === -1 }"
          >
            <i class="fas fa-thumbs-down"></i>
          </button>
        </div>

        <div class="action-buttons">
          <button
            v-if="!currentUser || currentUser.allow_comments === 1"
            @click="$emit('reply', comment)"
            class="action-button reply-button"
          >
            <i class="fas fa-reply"></i>
          </button>

          <button
            v-if="
              isCommentOwner &&
              !comment?.is_deleted &&
              !isEditing &&
              currentUser?.allow_comments === 1
            "
            @click="startEdit"
            class="action-button edit-button"
          >
            <i class="fas fa-edit"></i>
          </button>

          <button
            v-if="canDeleteComment && !comment?.is_deleted"
            @click="confirmDelete"
            class="action-button delete-button"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { getBaseURL } from '@/api/axios'
import { useRouter } from 'vue-router'
import EmojiPicker from '@/components/EmojiPicker.vue'
import ImagePicker from '@/components/ImagePicker.vue'
import LinkModal from '@/components/LinkModal.vue'
import { useCommentActions } from '@/composables/useCommentActions'
import { useCommentFormatting } from '@/composables/useCommentFormatting'
import { formatDate, formatRelativeTime } from '@/utils/dateUtils'
import { getInitials } from '@/utils/textUtils'

export default {
  name: 'CommentItem',
  components: {
    EmojiPicker,
    ImagePicker,
    LinkModal
  },
  props: {
    comment: {
      type: Object,
      required: true,
      default: () => ({
        username: 'Аноним',
        user_avatar: null,
        content: '',
        created_at: new Date().toISOString(),
        rating: 0,
        replies: []
      })
    },
    currentUser: {
      type: Object,
      required: true,
      default: () => ({})
    },
    editingCommentId: {
      type: Number,
      default: null
    }
  },
  emits: ['reply', 'start-edit', 'cancel-edit', 'edit', 'delete', 'rate'],
  setup(props, { emit }) {
    const router = useRouter()
    const isEditing = computed(() => {
      return props.editingCommentId === props.comment?.id
    })
    const editContent = ref(props.comment?.content || '')
    const userRating = ref(props.comment?.user_rating || 0)
    const avatarUrl = ref(null)
    const editTextarea = ref(null)

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

    const { formatContentWithTruncation } = useCommentFormatting()

    onMounted(async () => {
      if (props.comment?.user_avatar) {
        const baseURL = await getBaseURL()
        avatarUrl.value = `${baseURL}${props.comment.user_avatar}`
      }
    })

    const isCommentOwner = computed(() => {
      return props.currentUser && props.comment?.user_id === props.currentUser.id
    })

    const canDeleteComment = computed(() => {
      return (
        (props.currentUser && props.comment?.user_id === props.currentUser.id) ||
        (props.currentUser && props.currentUser.is_admin === 1)
      )
    })

    const isCommentEdited = computed(() => {
      return props.comment?.updated_at && props.comment?.updated_at !== props.comment?.created_at
    })

    const shouldHideComment = computed(() => {
      if (props.comment?.is_deleted) return false
      return (props.comment?.rating || 0) <= -3
    })

    const isCommentHidden = computed(() => shouldHideComment.value)
    const showHiddenComment = ref(false)

    const hiddenCommentReason = computed(() => {
      if (props.comment?.is_deleted) return null
      if ((props.comment?.rating || 0) <= -3) {
        return 'lowRating'
      }
      return null
    })

    const startEdit = () => {
      emit('start-edit', props.comment?.id)
      editContent.value = props.comment?.content || ''
      nextTick(() => {
        if (editTextarea.value) {
          editTextarea.value.focus()
          autoResize({ target: editTextarea.value })
        }
      })
    }

    const cancelEdit = () => {
      emit('cancel-edit')
      editContent.value = props.comment?.content || ''
    }

    const saveEdit = () => {
      if (editContent.value.trim()) {
        emit('edit', props.comment?.id, editContent.value.trim())
      }
    }

    const confirmDelete = () => {
      if (confirm('Вы уверены, что хотите удалить этот комментарий?')) {
        emit('delete', props.comment?.id)
      }
    }

    const rateComment = (rating) => {
      if (userRating.value === rating) {
        userRating.value = 0
        emit('rate', props.comment?.id, rating)
      } else {
        userRating.value = rating
        emit('rate', props.comment?.id, rating)
      }
    }

    const handleEditKeydown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        saveEdit()
      }
    }

    const isLongComment = computed(() => props.comment?.content?.length > 300)
    const isExpanded = ref(false)

    const formattedContent = computed(() => {
      return formatContentWithTruncation(props.comment?.content, 300, isExpanded.value)
    })

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value
    }

    const handleAvatarError = () => {
      console.log('Avatar load error, falling back to initials')
      avatarUrl.value = null
      nextTick(() => {
        const avatarPlaceholder = document.querySelector('.avatar-placeholder')
        if (avatarPlaceholder) {
          avatarPlaceholder.style.display = 'flex'
        }
      })
    }

    const openLogin = () => {
      router.push('/login')
    }

    const insertEmojiEdit = (emoji) => {
      insertEmojiUniversal(emoji, editTextarea, editContent, (value) => {
        editContent.value = value
      })
    }

    const insertImageEdit = (imageUrl) => {
      insertImageUniversal(imageUrl, editTextarea, editContent, (value) => {
        editContent.value = value
      })
    }

    const insertSpoilerEdit = () => {
      insertSpoilerUniversal(editTextarea, editContent, (value) => {
        editContent.value = value
      })
    }

    const insertLinkEdit = () => {
      insertLinkUniversal(editTextarea, editContent, (value) => {
        editContent.value = value
      })
    }

    const insertLinkFromModal = (linkData) => {
      insertLinkFromModalUniversal(linkData, editTextarea, editContent, (value) => {
        editContent.value = value
      })
    }

    const autoResizeEdit = (event) => {
      autoResize(event)
    }

    watch(editContent, () => {
      if (isEditing.value && editTextarea.value) {
        nextTick(() => {
          autoResizeEdit({ target: editTextarea.value })
        })
      }
    })

    return {
      isEditing,
      editContent,
      userRating,
      isCommentOwner,
      canDeleteComment,
      isCommentEdited,
      formatDate,
      formatRelativeTime,
      startEdit,
      cancelEdit,
      saveEdit,
      confirmDelete,
      rateComment,
      avatarUrl,
      getInitials,
      handleEditKeydown,
      isCommentHidden,
      showHiddenComment,
      hiddenCommentReason,
      isLongComment,
      isExpanded,
      formattedContent,
      toggleExpanded,
      autoResizeEdit,
      editTextarea,
      showEmojiPicker,
      showImagePicker,
      insertEmojiEdit,
      insertImageEdit,
      insertSpoilerEdit,
      insertLinkEdit,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      handleImageMouseEnter,
      handleImageMouseLeave,
      closeEmojiPicker,
      closeImagePicker,
      handleButtonMouseEnter,
      handleButtonMouseLeave,
      handleImageButtonMouseEnter,
      handleAvatarError,
      openLogin,
      showLinkModal,
      selectedTextForLink,
      insertLinkFromModal,
      closeLinkModal
    }
  }
}
</script>

<style scoped>
.comment-item {
  background: #2a2a2a;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: all 0.2s ease-in-out;
  max-width: 100%;
  overflow: visible;
  word-wrap: break-word;
}

.comment-item:hover {
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-avatar-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.user-avatar-link:hover .user-avatar {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(74, 144, 226, 0.3);
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  background-color: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #fff;
  background-color: #4a90e2;
  font-weight: 600;
}

.username {
  font-weight: 600;
  color: #fff;
  font-size: 0.9rem;
}

.date {
  font-size: 0.8rem;
  color: #999;
  margin-left: 0.375rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.edit-icon {
  font-size: 0.7rem;
  color: #666;
  vertical-align: baseline;
  position: relative;
  top: 0.02em;
}

.edited-indicator {
  font-style: italic;
  color: #777;
}

.comment-content {
  margin-bottom: 0.75rem;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  word-wrap: break-word;
}

.comment-text {
  color: #fff;
  line-height: 1.5;
  font-size: 0.9rem;
  margin: 0;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: anywhere;
  width: 100%;
  max-width: 100%;
  white-space: pre-wrap;
}

.comment-text :deep(img.inline-emoji) {
  display: inline-block;
  vertical-align: middle;
  height: 2em;
  width: auto;
  margin: 0 0.3em;
  max-height: 32px;
}

.edit-form {
  position: relative;
  margin-bottom: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  z-index: 5;
}

.edit-textarea-container {
  position: relative;
  width: 100%;
  overflow: visible;
}

.edit-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #444;
  border-radius: 0.375rem;
  background: #333;
  color: #fff;
  resize: none;
  font-size: 0.9rem;
  box-sizing: border-box;
  margin: 0;
  min-height: 3rem;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  line-height: 1.5;
  transition: height 0.1s ease;
}

.edit-textarea:focus {
  outline: none;
  border-color: #666;
}

.edit-footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 0.5rem;
  gap: 1rem;
  overflow: visible;
  position: relative;
  z-index: 10;
}

.edit-actions {
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
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-button-inline:hover {
  color: #fff;
}

.emoji-button-inline.active {
  color: #4caf50;
}

.character-counter-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 15;
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
  color: #e74c3c;
}

.cancel-button {
  padding: 0.25rem 0.5rem;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
}

.cancel-button:hover {
  color: #fff;
}

.save-button {
  padding: 0.25rem 0.5rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.save-button:hover:not(:disabled) {
  background: #357abd;
}

.save-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.comment-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rating-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rating-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.25rem;
  transition: color 0.2s;
  font-size: 0.8rem;
}

.rating-button:hover {
  color: #fff;
}

.rating-button.rated-up {
  color: #2ecc71;
}

.rating-button.rated-down {
  color: #e74c3c;
}

.rating-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rating-button:disabled {
  pointer-events: none;
}

.rating-count {
  color: #999;
  font-size: 0.8rem;
  font-weight: 500;
  min-width: 1.5rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: color 0.2s ease;
}

.rating-count.rating-positive {
  color: #2ecc71;
}

.rating-count.rating-negative {
  color: #e74c3c;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.25rem;
  transition: color 0.2s;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button:hover {
  color: #fff;
}

.reply-button {
  background: none;
  border: none;
  color: #999;
}

.reply-button:hover {
  color: #4a90e2;
}

.edit-button:hover {
  color: #4a90e2;
}

.delete-button:hover {
  color: #e74c3c;
}

.username-link {
  text-decoration: none;
  color: inherit;
  transition: color 0.2s;
}

.username-link:hover {
  color: #4a90e2;
}

.hidden-comment-warning {
  background: linear-gradient(135deg, #1a1a1b 0%, #2d2d2e 100%);
  border: 1px solid #343536;
  border-radius: 6px;
  margin-bottom: 0.375rem;
  overflow: hidden;
  position: relative;
}

.warning-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin: 0;
  color: #d7dadc;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: none;
  background: none;
  width: 100%;
  text-align: center;
  position: relative;
}

.warning-text:before {
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
  transition: opacity 0.2s ease;
}

.warning-text i {
  font-size: 12px;
  color: #878a8c;
  transition: all 0.2s ease;
}

.warning-text:hover {
  background: linear-gradient(135deg, #272729 0%, #343536 100%);
  color: #ffffff;
  transform: translateY(-0.5px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.warning-text:hover:before {
  opacity: 1;
}

.warning-text:hover i {
  color: #ff6b35;
  transform: scale(1.05);
}

.warning-text:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.deleted-comment {
  background: #1a1a1b;
  border: 1px solid #343536;
  border-radius: 6px;
  margin-bottom: 0.375rem;
}

.deleted-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin: 0;
  color: #878a8c;
  font-size: 0.75rem;
  font-style: italic;
  text-align: center;
}

.deleted-message i {
  font-size: 12px;
  color: #878a8c;
}

.comment-text-container {
  position: relative;
  max-width: 100%;
  overflow: hidden;
  word-wrap: break-word;
}

.expand-button {
  background: none;
  border: none;
  color: #4caf50;
  cursor: pointer;
  padding: 0.25rem 0;
  font: inherit;
  outline: inherit;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  transition: color 0.2s ease;
}

.expand-button:hover {
  color: #66bb6a;
  text-decoration: underline;
}

.seven-tv-icon {
  height: 1.2em;
  width: auto;
  vertical-align: middle;
  fill: currentColor;
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

.spoiler-button {
  color: #999;
}

.spoiler-button:hover {
  color: #fff;
}

.spoiler-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.user-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #ffd700;
  font-size: 0.8rem;
  font-weight: 500;
}

.user-rating i {
  font-size: 0.75rem;
}

.link-button {
  color: #999;
}

.link-button:hover {
  color: #4a90e2;
}

.link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.comment-link) {
  color: #4a90e2;
  text-decoration: none;
  transition: color 0.2s ease;
  border-bottom: 1px solid transparent;
}

:deep(.comment-link:hover) {
  color: #66a3e0;
  border-bottom-color: #66a3e0;
  text-decoration: none;
}

:deep(.comment-link:visited) {
  color: #8a7ca8;
}

:deep(.comment-link:visited:hover) {
  color: #a393c2;
  border-bottom-color: #a393c2;
}

@media (max-width: 768px) {
  .edit-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .character-counter-container {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .edit-actions {
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

  .save-button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    width: auto;
    min-width: 90px;
  }

  .cancel-button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    min-width: 70px;
  }

  .edit-form {
    margin-bottom: 1rem;
  }

  .edit-textarea {
    font-size: 16px;
  }
}

@media (max-width: 360px) {
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
</style>
