<template>
  <div class="comment-thread">
    <CommentItem
      :comment="comment"
      :current-user="currentUser"
      :editing-comment-id="editingCommentId"
      @reply="$emit('reply', $event)"
      @start-edit="$emit('start-edit', $event)"
      @cancel-edit="$emit('cancel-edit')"
      @edit="(commentId, newContent) => $emit('edit', commentId, newContent)"
      @delete="$emit('delete', $event)"
      @rate="(commentId, rating) => $emit('rate', commentId, rating)"
    />

    <div v-if="replyTo && replyTo.id === comment.id" class="reply-form">
      <div class="textarea-container">
        <textarea
          ref="replyTextarea"
          class="comment-textarea"
          :value="replyContent"
          :placeholder="getReplyPlaceholder"
          :disabled="currentUser && currentUser.allow_comments !== 1"
          rows="3"
          maxlength="1500"
          @input="handleReplyInput"
          @keydown="$emit('reply-keydown', $event)"
        ></textarea>
      </div>
      <div class="reply-footer">
        <div class="reply-actions">
          <button class="cancel-reply" @click="$emit('cancel-reply')">Отмена</button>
          <button
            class="submit-button"
            :disabled="
              !replyContent.trim() ||
              replyContent.length > 1500 ||
              (currentUser && currentUser.allow_comments !== 1)
            "
            @click="$emit('submit-reply')"
          >
            Ответить
          </button>
        </div>
        <div class="character-counter-container">
          <div
            class="character-counter-inline"
            :class="{
              'near-limit': replyContent.length > 1400,
              'at-limit': replyContent.length >= 1500
            }"
          >
            {{ replyContent.length }}/1500
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
            :is-visible="showEmojiPicker"
            @emoji-selected="insertEmoji"
            @mouse-enter="handleEmojiMouseEnter"
            @mouse-leave="handleEmojiMouseLeave"
            @close="closeEmojiPicker"
          />
          <ImagePicker
            :is-visible="showImagePicker"
            :current-user="currentUser"
            @image-selected="insertImage"
            @mouse-enter="handleImageMouseEnter"
            @mouse-leave="handleImageMouseLeave"
            @close="closeImagePicker"
            @login-required="() => $router.push('/login')"
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

    <div v-if="comment.replies && comment.replies.length > 0" class="replies-container">
      <button
        class="collapse-toggle"
        :title="isCollapsed ? 'Развернуть ответы' : 'Свернуть ответы'"
        @click="toggleCollapsed"
      >
        <span class="collapse-icon" :class="{ expanded: !isCollapsed }">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </span>
        <span class="replies-count"
          >{{ comment.replies.length }}
          {{ comment.replies.length === 1 ? 'ответ' : 'ответов' }}</span
        >
      </button>

      <div
        class="vertical-line-clickable"
        :title="isCollapsed ? 'Развернуть ответы' : 'Свернуть ответы'"
        @click="toggleCollapsed"
      >
        <div class="vertical-line-visual" :class="{ collapsed: isCollapsed }"></div>
      </div>

      <div v-if="!isCollapsed" class="replies-content">
        <CommentThread
          v-for="reply in comment.replies"
          :key="reply.id"
          :comment="reply"
          :current-user="currentUser"
          :reply-to="replyTo"
          :reply-content="replyContent"
          :editing-comment-id="editingCommentId"
          @reply="$emit('reply', $event)"
          @start-edit="$emit('start-edit', $event)"
          @cancel-edit="$emit('cancel-edit')"
          @edit="(commentId, newContent) => $emit('edit', commentId, newContent)"
          @delete="$emit('delete', $event)"
          @rate="(commentId, rating) => $emit('rate', commentId, rating)"
          @submit-reply="$emit('submit-reply')"
          @cancel-reply="$emit('cancel-reply')"
          @update-reply-content="$emit('update-reply-content', $event)"
          @reply-keydown="$emit('reply-keydown', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import CommentItem from './CommentItem.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import ImagePicker from '@/components/ImagePicker.vue'
import LinkModal from '@/components/LinkModal.vue'

export default {
  name: 'CommentThread',
  components: {
    CommentItem,
    EmojiPicker,
    ImagePicker,
    LinkModal
  },
  props: {
    comment: {
      type: Object,
      required: true
    },
    currentUser: {
      type: Object,
      required: true
    },
    replyTo: {
      type: Object,
      default: null
    },
    replyContent: {
      type: String,
      default: ''
    },
    editingCommentId: {
      type: Number,
      default: null
    }
  },
  emits: [
    'reply',
    'start-edit',
    'cancel-edit',
    'edit',
    'delete',
    'rate',
    'submit-reply',
    'cancel-reply',
    'update-reply-content',
    'reply-keydown'
  ],
  setup(props, { emit }) {
    const replyTextarea = ref(null)
    const showEmojiPicker = ref(false)
    const showImagePicker = ref(false)
    const isButtonHovered = ref(false)
    const isEmojiHovered = ref(false)
    const isImageHovered = ref(false)
    const isCollapsed = ref(false)
    const showLinkModal = ref(false)
    const selectedTextForLink = ref('')

    const handleReplyInput = (event) => {
      emit('update-reply-content', event.target.value)
      const textarea = event.target
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    }

    const insertEmoji = (emoji) => {
      const textarea = replyTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = textarea.value
        const before = value.substring(0, start)
        const after = value.substring(end)
        textarea.value = before + emoji + after
        emit('update-reply-content', textarea.value)

        nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start + emoji.length, start + emoji.length)
          handleReplyInput({ target: textarea })
        })
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

    const handleButtonMouseEnter = () => {
      isButtonHovered.value = true
      showEmojiPicker.value = true
      showImagePicker.value = false
    }

    const handleButtonMouseLeave = () => {
      isButtonHovered.value = false
      setTimeout(() => {
        if (!isEmojiHovered.value && !isImageHovered.value && !isButtonHovered.value) {
          showEmojiPicker.value = false
          showImagePicker.value = false
        }
      }, 300)
    }

    const closeEmojiPicker = () => {
      showEmojiPicker.value = false
    }

    const handleImageMouseEnter = () => {
      isImageHovered.value = true
    }

    const handleImageMouseLeave = () => {
      isImageHovered.value = false
      setTimeout(() => {
        if (!isImageHovered.value && !isButtonHovered.value) {
          showImagePicker.value = false
        }
      }, 300)
    }

    const closeImagePicker = () => {
      showImagePicker.value = false
    }

    const handleImageButtonMouseEnter = () => {
      isButtonHovered.value = true
      showImagePicker.value = true
      showEmojiPicker.value = false
    }

    const insertImage = (imageUrl) => {
      const textarea = replyTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const imageTag = `[img]${imageUrl}[/img]`
        const newValue = textarea.value.slice(0, start) + imageTag + textarea.value.slice(end)
        textarea.value = newValue
        emit('update-reply-content', newValue)

        nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start + imageTag.length, start + imageTag.length)
          handleReplyInput({ target: textarea })
        })
      }
    }

    const insertSpoiler = () => {
      const textarea = replyTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = textarea.value.slice(start, end)

        let spoilerTag
        if (selectedText.trim()) {
          spoilerTag = `[spoiler]${selectedText}[/spoiler]`
        } else {
          spoilerTag = '[spoiler][/spoiler]'
        }

        const newValue = textarea.value.slice(0, start) + spoilerTag + textarea.value.slice(end)
        textarea.value = newValue
        emit('update-reply-content', newValue)

        nextTick(() => {
          textarea.focus()
          if (selectedText.trim()) {
            textarea.setSelectionRange(start + spoilerTag.length, start + spoilerTag.length)
          } else {
            const cursorPosition = start + '[spoiler]'.length
            textarea.setSelectionRange(cursorPosition, cursorPosition)
          }
          handleReplyInput({ target: textarea })
        })
      }
    }

    const insertLink = () => {
      const textarea = replyTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = textarea.value.slice(start, end)
        selectedTextForLink.value = selectedText.trim() || ''
      }
      showLinkModal.value = true
    }

    const closeLinkModal = () => {
      showLinkModal.value = false
    }

    const insertLinkFromModal = (linkData) => {
      const textarea = replyTextarea.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const linkTag = `[link=${linkData.url}]${linkData.title}[/link]`
        const newValue = textarea.value.slice(0, start) + linkTag + textarea.value.slice(end)
        textarea.value = newValue
        emit('update-reply-content', newValue)

        nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start + linkTag.length, start + linkTag.length)
          handleReplyInput({ target: textarea })
        })
      }
    }

    const toggleCollapsed = () => {
      isCollapsed.value = !isCollapsed.value
    }

    const closeAllPickers = () => {
      showEmojiPicker.value = false
      showImagePicker.value = false
    }

    const handleGlobalClick = (event) => {
      if (
        !event.target.closest('.emoji-picker') &&
        !event.target.closest('.image-picker') &&
        !event.target.closest('.emoji-button-inline')
      ) {
        closeAllPickers()
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleGlobalClick)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleGlobalClick)
    })

    return {
      replyTextarea,
      showEmojiPicker,
      showImagePicker,
      isCollapsed,
      insertEmoji,
      insertImage,
      insertSpoiler,
      handleEmojiMouseEnter,
      handleEmojiMouseLeave,
      handleImageMouseEnter,
      handleImageMouseLeave,
      handleButtonMouseEnter,
      handleButtonMouseLeave,
      closeEmojiPicker,
      closeImagePicker,
      handleImageButtonMouseEnter,
      handleReplyInput,
      toggleCollapsed,
      closeAllPickers,
      showLinkModal,
      selectedTextForLink,
      insertLink,
      closeLinkModal,
      insertLinkFromModal
    }
  },
  computed: {
    canReply() {
      if (!this.currentUser) return true
      return this.currentUser.allow_comments === 1
    },
    getReplyPlaceholder() {
      if (!this.currentUser) {
        return 'Войдите, чтобы оставить ответ...'
      }
      if (this.currentUser.allow_comments !== 1) {
        return 'У вас нет прав на создание комментариев'
      }
      return 'Напишите ваш ответ...'
    },
    formattedContent() {
      if (!this.comment.content) return ''

      const isValidImageUrl = (url) => {
        try {
          const urlObj = new URL(url)
          const isValid = urlObj.hostname === 'cdn.7tv.app' && urlObj.protocol === 'https:'

          if (!isValid) {
            console.warn('URL изображения отклонен:', {
              url: url,
              hostname: urlObj.hostname,
              protocol: urlObj.protocol,
              reason:
                urlObj.hostname !== 'cdn.7tv.app' ? 'неразрешенный домен' : 'неразрешенный протокол'
            })
          }

          return isValid
        } catch (error) {
          console.warn('Недопустимый URL изображения:', url, 'Ошибка:', error.message)
          return false
        }
      }

      const escapeHtml = (text) => {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      let processedContent = this.comment.content.replace(
        /\[img\](.*?)\[\/img\]/g,
        (match, url) => {
          const trimmedUrl = url.trim()
          if (isValidImageUrl(trimmedUrl)) {
            const safeUrl = escapeHtml(trimmedUrl)
            return `<img src="${safeUrl}" alt="7TV emote" class="inline-emoji" loading="lazy" />`
          }
          return `[недопустимое изображение: ${escapeHtml(trimmedUrl)}]`
        }
      )

      processedContent = processedContent.replace(
        /\[spoiler\](.*?)\[\/spoiler\]/gs,
        (match, spoilerText, offset, string) => {
          const escapedText = escapeHtml(spoilerText.trim())

          const beforeChar = offset > 0 ? string[offset - 1] : ' '
          const afterChar =
            offset + match.length < string.length ? string[offset + match.length] : ' '

          const needSpaceBefore =
            beforeChar && beforeChar !== ' ' && beforeChar !== '\n' && beforeChar !== '\t'
          const needSpaceAfter =
            afterChar && afterChar !== ' ' && afterChar !== '\n' && afterChar !== '\t'

          const spaceBefore = needSpaceBefore ? ' ' : ''
          const spaceAfter = needSpaceAfter ? ' ' : ''

          return `${spaceBefore}<span class="spoiler-text" onclick="this.classList.toggle('revealed')" title="Нажмите, чтобы показать спойлер">${escapedText}</span>${spaceAfter}`
        }
      )

      return processedContent
    }
  }
}
</script>

<style scoped>
.comment-thread {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  overflow: visible;
}

.replies-container {
  margin-left: 1rem;
  margin-right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: calc(100% - 3rem);
  position: relative;
  border-left: 3px solid rgba(76, 175, 80, 0.3);
  padding-left: 1rem;
  margin-top: 0.5rem;
  overflow: visible;
}

.reply-form {
  margin-left: 1rem;
  margin-right: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 0.5rem;
  border-left: 3px solid rgba(76, 175, 80, 0.5);
  width: calc(100% - 3rem);
  overflow: visible;
  position: relative;
  z-index: 5;
}

.reply-footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 0.5rem;
  gap: 1rem;
  overflow: visible;
  position: relative;
  z-index: 10;
}

.reply-actions {
  display: flex;
  gap: 0.5rem;
  position: relative;
  overflow: visible;
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
  color: #ff0000;
}

.cancel-reply {
  padding: 0.25rem 0.5rem;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
}

.cancel-reply:hover {
  color: #fff;
}

.submit-button {
  padding: 0.25rem 0.5rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.submit-button:hover:not(:disabled) {
  background: #357abd;
}

.submit-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.textarea-container {
  position: relative;
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

.emoji-button-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  color: #999;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  min-width: fit-content;
  position: relative;
  left: 0;
  z-index: 2;
}

.collapse-toggle:hover {
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.4);
  color: #fff;
  transform: translateY(-1px);
}

.collapse-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
  color: #4caf50;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

.replies-count {
  font-size: 0.85rem;
  font-weight: 500;
  color: inherit;
  user-select: none;
}

.replies-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  margin-left: 0;
  width: 100%;
  overflow: visible;
}

.vertical-line-clickable {
  position: absolute;
  left: -8px;
  top: 0;
  width: 16px;
  height: 100%;
  cursor: pointer;
  z-index: 1;
  transition: all 0.2s ease;
}

.vertical-line-clickable:hover {
  background: rgba(76, 175, 80, 0.1);
}

.vertical-line-visual {
  position: absolute;
  left: 50%;
  top: 0;
  width: 3px;
  height: 100%;
  background: rgba(76, 175, 80, 0.3);
  transform: translateX(-50%);
  transition: all 0.2s ease;
}

.vertical-line-clickable:hover .vertical-line-visual {
  background: rgba(76, 175, 80, 0.6);
  width: 4px;
}

.vertical-line-visual.collapsed {
  background: rgba(76, 175, 80, 0.5);
}

.comment-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  color: #fff;
}

.comment-content :deep(img.inline-emoji) {
  display: inline-block;
  vertical-align: middle;
  height: 1.2em;
  width: auto;
  margin: 0 0.1em;
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

.link-button {
  color: #999;
}

.link-button:hover {
  color: #fff;
}

.link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
