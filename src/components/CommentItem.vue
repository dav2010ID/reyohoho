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
              :alt="comment?.name || 'Аноним'"
              @error="handleAvatarError"
            />
            <div
              v-else
              class="avatar-placeholder"
              :style="{ display: avatarUrl ? 'none' : 'flex' }"
            >
              {{ getInitials(comment?.name || 'Аноним') }}
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
            <span class="username">{{ comment?.name || 'Аноним' }}</span>
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
                <button class="cancel-button" @click="cancelEdit">Отмена</button>
                <button
                  class="save-button"
                  :disabled="!editContent.trim() || editContent.length > 1500"
                  @click="saveEdit"
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
                  :class="{ active: showEmojiPicker }"
                  @mouseenter="handleButtonMouseEnter"
                  @mouseleave="handleButtonMouseLeave"
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
                  title="Добавить спойлер"
                  class="emoji-button-inline spoiler-button"
                  @click="insertSpoilerEdit"
                >
                  <i class="fas fa-eye-slash"></i>
                </button>
                <button
                  type="button"
                  class="emoji-button-inline link-button"
                  title="Добавить ссылку"
                  @click="insertLinkEdit"
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
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p class="comment-text" @click="handleFormattedContentClick" v-html="formattedContent"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="comment-footer">
      <div class="comment-actions">
        <div class="rating-buttons">
          <button
            v-if="!isCommentOwner && !comment?.is_deleted"
            class="rating-button"
            :class="{ 'rated-up': userRating === 1 }"
            @click="rateComment(1)"
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
            class="rating-button"
            :class="{ 'rated-down': userRating === -1 }"
            @click="rateComment(-1)"
          >
            <i class="fas fa-thumbs-down"></i>
          </button>
        </div>

        <div class="action-buttons">
          <button
            v-if="!currentUser || currentUser.allow_comments === 1"
            class="action-button reply-button"
            @click="$emit('reply', comment)"
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
            class="action-button edit-button"
            @click="startEdit"
          >
            <i class="fas fa-edit"></i>
          </button>

          <button
            v-if="canDeleteComment && !comment?.is_deleted"
            class="action-button delete-button"
            @click="confirmDelete"
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
import { debugLog } from '@/utils/logger'

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
      // Зачем  required: true, если прописаны default?
      default: () => ({
        name: 'Аноним',
        user_avatar: null,
        content: '',
        created_at: new Date().toISOString(),
        rating: 0,
        replies: []
      })
    },
    currentUser: {
      type: Object,
      // Зачем  required: true, если прописаны default?
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

    const formattedContent = computed(() => {
      return formatContentWithTruncation(props.comment?.content)
    })

    const handleAvatarError = () => {
      debugLog('Avatar load error, falling back to initials')
      avatarUrl.value = null
    }

    const handleFormattedContentClick = (event) => {
      const spoiler = event.target.closest('.spoiler-text')
      if (!spoiler) return
      spoiler.classList.toggle('revealed')
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
      formattedContent,
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
      handleFormattedContentClick,
      openLogin,
      showLinkModal,
      selectedTextForLink,
      insertLinkFromModal,
      closeLinkModal
    }
  }
}
</script>

<style scoped src="./CommentItem.css"></style>
