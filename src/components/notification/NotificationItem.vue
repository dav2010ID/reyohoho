<template>
  <div
    class="notification-item"
    :class="{
      unread: !notification.is_read,
      read: notification.is_read
    }"
  >
    <div class="notification-content">
      <div v-if="notification.movie_cover" class="movie-poster">
        <router-link :to="`/movie/${notification.movie_id}`">
          <img :src="notification.movie_cover" :alt="notification.movie_title" class="poster-img" />
        </router-link>
      </div>

      <div class="notification-main">
        <div class="notification-header">
          <div class="notification-info">
            <router-link :to="`/movie/${notification.movie_id}`" class="movie-title">{{
              notification.movie_title
            }}</router-link>
          </div>
          <div class="notification-time">
            {{ formatRelativeTime(notification.created_at) }}
          </div>
        </div>

        <div class="notification-message">
          {{ notification.message }}
        </div>

        <div
          v-if="notification.comment_content || notification.reply_content"
          class="comment-preview"
          @click="toggleSpoiler"
        >
          <div v-if="notification.comment_content" class="original-comment">
            <i class="fas fa-quote-left"></i>
            <span
              class="comment-text"
              v-html="formatCommentContent(notification.comment_content)"
            ></span>
          </div>
          <div v-if="notification.reply_content" class="reply-comment">
            <i class="fas fa-reply"></i>
            <span
              class="comment-text"
              v-html="formatCommentContent(notification.reply_content)"
            ></span>
          </div>
        </div>
      </div>

      <div class="notification-actions">
        <button
          v-if="!notification.is_read"
          class="action-btn mark-read-btn"
          title="Отметить как прочитанное"
          @click="markAsRead"
        >
          <i class="fas fa-check"></i>
        </button>

        <button
          class="action-btn delete-btn"
          title="Удалить уведомление"
          @click="deleteNotification"
        >
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>

    <div v-if="!notification.is_read" class="unread-indicator"></div>
  </div>
</template>

<script setup>
import { formatRelativeTime } from '@/utils/dateUtils'
import { useCommentFormatting } from '@/composables/useCommentFormatting'

const props = defineProps({
  notification: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['mark-read', 'delete'])

const { formatContent } = useCommentFormatting()

const formatCommentContent = (content) => {
  if (!content) return ''
  return formatContent(content)
}

const markAsRead = () => {
  emit('mark-read', props.notification.id)
}

const deleteNotification = () => {
  emit('delete', props.notification.id)
}

const toggleSpoiler = (event) => {
  const spoiler = event.target.closest('.spoiler-text')
  if (!spoiler) return
  spoiler.classList.toggle('revealed')
}
</script>

<style scoped>
.notification-item {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 10px;
  position: relative;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.notification-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.notification-item.unread {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
}

.notification-content {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.notification-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-icon {
  color: white;
  font-size: 18px;
}

.notification-main {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
  gap: 8px;
}

.notification-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.sender-name {
  font-weight: 600;
  color: var(--text-color);
}

.notification-type {
  color: var(--text-color);
}

.movie-title {
  color: var(--text-color);
  font-weight: 500;
  text-decoration: underline;
  display: inline;
}

.movie-title:hover {
  color: var(--text-color);
}

.notification-time {
  color: var(--muted-color);
  font-size: 0.85rem;
  white-space: nowrap;
}

.notification-message {
  color: var(--text-color);
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 0.95rem;
}

.comment-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  border-left: 2px solid var(--accent-color);
}

.original-comment,
.reply-comment {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.original-comment:last-child,
.reply-comment:last-child {
  margin-bottom: 0;
}

.comment-preview i {
  color: var(--muted-color);
  font-size: 0.8rem;
  margin-top: 2px;
  flex-shrink: 0;
}

.comment-text {
  color: var(--text-color);
  font-size: 0.9rem;
  line-height: 1.4;
}

.comment-text :deep(img.inline-emoji) {
  display: inline-block;
  vertical-align: middle;
  height: 2em;
  width: auto;
  margin: 0 0.3em;
  max-height: 32px;
}

.comment-text :deep(.spoiler-text) {
  background: #333;
  color: transparent;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.comment-text :deep(.spoiler-text.revealed) {
  background: none;
  color: inherit;
}

.comment-text :deep(.comment-link) {
  color: var(--accent-color);
  text-decoration: none;
  transition: color 0.2s ease;
}

.comment-text :deep(.comment-link:hover) {
  color: var(--accent-hover);
  text-decoration: underline;
}

.movie-poster {
  margin-right: 8px;
  flex-shrink: 0;
}

.poster-img {
  width: 50px;
  height: 75px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.poster-img:hover {
  transform: scale(1.05);
}

.notification-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 0.8rem;
}

.mark-read-btn {
  background: var(--accent-color);
  color: white;
}

.mark-read-btn:hover {
  background: var(--accent-hover);
}

.delete-btn {
  background: var(--error-color);
  color: white;
}

.delete-btn:hover {
  background: #d63031;
}

.unread-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 6px;
  height: 6px;
  background: var(--error-color);
  border-radius: 50%;
}

@media (max-width: 768px) {
  .notification-item {
    padding: 8px;
  }

  .notification-content {
    gap: 6px;
  }

  .notification-avatar {
    width: 32px;
    height: 32px;
  }

  .avatar-icon {
    font-size: 14px;
  }

  .notification-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .notification-info {
    font-size: 0.9rem;
  }

  .movie-poster {
    margin-right: 8px;
  }

  .poster-img {
    width: 40px;
    height: 60px;
  }

  .notification-actions {
    flex-direction: row;
    gap: 4px;
  }

  .action-btn {
    width: 24px;
    height: 24px;
    font-size: 0.75rem;
  }
}

:root {
  --accent-color: #6c5ce7;
  --accent-hover: #5a4fcf;
  --secondary-color: #74b9ff;
  --secondary-hover: #0984e3;
  --text-color: #2d3436;
  --muted-color: #636e72;
  --error-color: #e17055;
}

[data-theme='dark'] {
  --text-color: #ddd;
  --muted-color: #999;
}
</style>
