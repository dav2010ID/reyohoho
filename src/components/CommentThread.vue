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
          @input="handleReplyInput"
          :placeholder="getReplyPlaceholder"
          :disabled="currentUser && currentUser.allow_comments !== 1"
          rows="3"
          maxlength="1500"
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
            @mouseenter="handleButtonMouseEnter"
            @mouseleave="handleButtonMouseLeave"
            :class="{ active: showEmojiPicker }"
            :disabled="currentUser && currentUser.allow_comments !== 1"
          >
            😊
          </button>
          <EmojiPicker
            :is-visible="showEmojiPicker && canReply"
            @emoji-selected="insertEmoji"
            @mouse-enter="handleEmojiMouseEnter"
            @mouse-leave="handleEmojiMouseLeave"
            @close="closeEmojiPicker"
          />
        </div>
      </div>
    </div>

    <div v-if="comment.replies && comment.replies.length > 0" class="replies-container">
      <button
        class="collapse-toggle"
        @click="toggleCollapsed"
        :title="isCollapsed ? 'Развернуть ответы' : 'Свернуть ответы'"
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
        @click="toggleCollapsed"
        :title="isCollapsed ? 'Развернуть ответы' : 'Свернуть ответы'"
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
import CommentItem from './CommentItem.vue'
import EmojiPicker from './EmojiPicker.vue'

export default {
  name: 'CommentThread',
  components: {
    CommentItem,
    EmojiPicker
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
  data() {
    return {
      isCollapsed: true,
      showEmojiPicker: false,
      isButtonHovered: false,
      isEmojiHovered: false
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
    }
  },
  watch: {
    replyTo: {
      handler(newReplyTo) {
        if (newReplyTo && newReplyTo.id === this.comment.id) {
          this.$nextTick(() => {
            if (this.$refs.replyTextarea) {
              this.$refs.replyTextarea.focus()
            }
          })
        }
      },
      immediate: true
    },
    'comment.replies': {
      handler(newReplies, oldReplies) {
        if (newReplies && oldReplies && newReplies.length > oldReplies.length) {
          this.isCollapsed = false
        }
      },
      deep: true
    }
  },
  methods: {
    toggleCollapsed() {
      this.isCollapsed = !this.isCollapsed
    },
    handleReplyInput(event) {
      this.$emit('update-reply-content', event.target.value)
      const textarea = event.target
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    },
    insertEmoji(emoji) {
      const textarea = this.$refs.replyTextarea
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = textarea.value
        const before = value.substring(0, start)
        const after = value.substring(end)
        textarea.value = before + emoji + after
        this.$emit('update-reply-content', textarea.value)

        this.$nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(start + emoji.length, start + emoji.length)
          this.handleReplyInput({ target: textarea })
        })
      }
    },
    handleEmojiMouseEnter() {
      this.isEmojiHovered = true
    },
    handleEmojiMouseLeave() {
      this.isEmojiHovered = false
      setTimeout(() => {
        if (!this.isEmojiHovered && !this.isButtonHovered) {
          this.showEmojiPicker = false
        }
      }, 300)
    },
    handleButtonMouseEnter() {
      this.isButtonHovered = true
      this.showEmojiPicker = true
    },
    handleButtonMouseLeave() {
      this.isButtonHovered = false
      setTimeout(() => {
        if (!this.isEmojiHovered && !this.isButtonHovered) {
          this.showEmojiPicker = false
        }
      }, 300)
    },
    closeEmojiPicker() {
      this.showEmojiPicker = false
    }
  },
  mounted() {},
  beforeUnmount() {}
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
</style>
