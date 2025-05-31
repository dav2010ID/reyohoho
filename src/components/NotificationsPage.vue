<template>
  <div class="notifications-page">
    <div class="container">
      <div class="notifications-header">
        <h1 class="page-title">
          <i class="fas fa-bell"></i>
          Уведомления
        </h1>

        <div class="header-actions" v-if="notifications.length > 0">
          <button
            v-if="notificationsStore.unreadCount > 0"
            @click="markAllAsRead"
            class="btn btn-secondary"
            :disabled="loading"
          >
            <i class="fas fa-check-double"></i>
            Отметить все как прочитанные
          </button>
        </div>
      </div>

      <div v-if="notificationsStore.loading" class="loading-container">
        <SpinnerLoading />
        <p class="loading-text">Загрузка уведомлений...</p>
      </div>

      <ErrorMessage
        v-else-if="notificationsStore.error"
        :message="notificationsStore.error"
        @retry="fetchNotifications"
      />

      <div v-else-if="notifications.length === 0" class="empty-state">
        <i class="fas fa-bell-slash empty-icon"></i>
        <h3 class="empty-title">Нет уведомлений</h3>
        <p class="empty-text">
          Когда кто-то ответит на ваш комментарий, вы увидите уведомление здесь
        </p>
      </div>

      <div v-else class="notifications-list">
        <NotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          :notification="notification"
          @mark-read="markAsRead"
          @delete="deleteNotification"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotificationsStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import NotificationItem from './notification/NotificationItem.vue'
import SpinnerLoading from './SpinnerLoading.vue'
import ErrorMessage from './ErrorMessage.vue'

const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)

const notifications = computed(() => notificationsStore.notifications)

onMounted(async () => {
  if (!authStore.token) {
    router.push('/login')
    return
  }

  await fetchNotifications()

  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

let pollingInterval = null

function startPolling() {
  pollingInterval = setInterval(() => {
    notificationsStore.fetchUnreadCount()
  }, 30000)
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

async function fetchNotifications() {
  await notificationsStore.fetchNotifications()
}

async function markAllAsRead() {
  loading.value = true
  try {
    await notificationsStore.markAsRead()
  } catch (error) {
    console.error('Error marking all as read:', error)
  } finally {
    loading.value = false
  }
}

async function markAsRead(notificationId) {
  try {
    await notificationsStore.markAsRead([notificationId])
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

async function deleteNotification(notificationId) {
  try {
    await notificationsStore.deleteNotification(notificationId)
  } catch (error) {
    console.error('Error deleting notification:', error)
  }
}
</script>

<style scoped>
.notifications-page {
  min-height: 100vh;
  background: var(--bg-gradient);
  padding: 20px 0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 15px;
  margin: 0;
}

.page-title i {
  color: var(--accent-color);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--secondary-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--secondary-hover);
}

.loading-container {
  text-align: center;
  padding: 60px 20px;
}

.loading-text {
  margin-top: 20px;
  color: var(--text-color);
  font-size: 1.1rem;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 4rem;
  color: var(--muted-color);
  margin-bottom: 20px;
}

.empty-title {
  font-size: 1.8rem;
  color: var(--text-color);
  margin-bottom: 10px;
}

.empty-text {
  color: var(--muted-color);
  font-size: 1.1rem;
  line-height: 1.5;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

@media (max-width: 768px) {
  .notifications-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 2rem;
  }

  .header-actions {
    width: 100%;
  }

  .btn {
    flex: 1;
    justify-content: center;
  }
}

:root {
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --accent-color: #6c5ce7;
  --accent-hover: #5a4fcf;
  --secondary-color: #74b9ff;
  --secondary-hover: #0984e3;
  --text-color: #2d3436;
  --muted-color: #636e72;
  --error-color: #e17055;
}

[data-theme='dark'] {
  --bg-gradient: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  --text-color: #ddd;
  --muted-color: #999;
}
</style>
