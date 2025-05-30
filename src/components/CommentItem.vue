<template>
  <div class="comment-item" :data-comment-id="comment?.id">
    <div class="comment-header">
      <div class="user-info">
        <a
          :href="`/lists/${comment?.user_id}`"
          target="_blank"
          rel="noopener noreferrer"
          class="user-avatar-link"
        >
          <div class="user-avatar">
            <img v-if="avatarUrl" v-lazy="avatarUrl" :alt="comment?.username || 'Аноним'" />
            <div v-else class="avatar-placeholder">
              {{ getInitials(comment?.username || 'Аноним') }}
            </div>
          </div>
        </a>
        <div>
          <a
            :href="`/lists/${comment?.user_id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="username-link"
          >
            {{ comment?.username || 'Аноним' }}
          </a>
          <span class="date">
            {{ formatDate(comment?.created_at) }}
            <span v-if="isCommentEdited" class="edited-indicator">
              (изменено {{ formatDate(comment?.updated_at) }})
            </span>
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
                <EmojiPicker
                  :is-visible="showEmojiPicker"
                  @emoji-selected="insertEmojiEdit"
                  @mouse-enter="handleEmojiMouseEnter"
                  @mouse-leave="handleEmojiMouseLeave"
                  @close="closeEmojiPicker"
                />
              </div>
            </div>
          </div>
          <div v-else class="comment-text-container">
            <p class="comment-text" :class="{ truncated: isLongComment && !isExpanded }">
              {{ displayedText }}
            </p>
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

export default {
  name: 'CommentItem',
  components: {
    EmojiPicker
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
    const showEmojiPicker = ref(false)
    const isButtonHovered = ref(false)
    const isEmojiHovered = ref(false)

    const getInitials = (name) => {
      if (!name) return '?'
      const words = name.split(' ')
      if (words.length === 1) {
        return name.slice(0, 2).toUpperCase()
      }
      return (words[0][0] + words[words.length - 1][0]).toUpperCase()
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return ''

      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      const hour = dateStr.substring(9, 11)
      const minute = dateStr.substring(11, 13)
      const second = dateStr.substring(13, 15)

      const utcDate = new Date(
        Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        )
      )

      return utcDate.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    }

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
          autoResizeEdit({ target: editTextarea.value })
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

    const goToUserLists = () => {
      router.push(`/lists/${props.comment?.user_id}`)
    }

    const handleEditKeydown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        saveEdit()
      }
    }

    const isLongComment = computed(() => props.comment?.content?.length > 300)
    const isExpanded = ref(false)
    const displayedText = computed(() => {
      if (isLongComment.value && !isExpanded.value) {
        return props.comment?.content?.slice(0, 300) + '...'
      }
      return props.comment?.content || ''
    })

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value
    }

    const autoResizeEdit = (event) => {
      const textarea = event.target
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    }

    const insertEmojiEdit = (emoji) => {
      const textarea = editTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const before = editContent.value.substring(0, start)
        const after = editContent.value.substring(end)
        editContent.value = before + emoji + after

        nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start + emoji.length, start + emoji.length)
          autoResizeEdit({ target: textarea })
        })
      } else {
        editContent.value += emoji
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

    const handleButtonMouseEnter = () => {
      isButtonHovered.value = true
      showEmojiPicker.value = true
    }

    const handleButtonMouseLeave = () => {
      isButtonHovered.value = false
      setTimeout(() => {
        if (!isEmojiHovered.value && !isButtonHovered.value) {
          showEmojiPicker.value = false
        }
      }, 300)
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
      startEdit,
      cancelEdit,
      saveEdit,
      confirmDelete,
      rateComment,
      avatarUrl,
      getInitials,
      goToUserLists,
      handleEditKeydown,
      isCommentHidden,
      showHiddenComment,
      hiddenCommentReason,
      isLongComment,
      isExpanded,
      displayedText,
      toggleExpanded,
      autoResizeEdit,
      editTextarea,
      showEmojiPicker,
      insertEmojiEdit,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      closeEmojiPicker,
      handleButtonMouseEnter,
      handleButtonMouseLeave
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
  overflow-x: hidden;
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
  overflow-x: hidden;
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

.edit-form {
  position: relative;
  margin-bottom: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
}

.edit-textarea-container {
  position: relative;
  width: 100%;
  overflow-x: hidden;
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
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
  position: relative;
}

.emoji-button-inline {
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #999;
  transition: color 0.2s;
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
</style>
