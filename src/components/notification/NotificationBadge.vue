<template>
  <div class="notification-badge-wrapper">
    <router-link
      to="/notifications"
      class="notification-badge"
      :class="{ 'has-notifications': hasUnreadNotifications }"
    >
      <i class="fas fa-bell"></i>
      <span v-if="unreadCount > 0" class="badge-count" :class="{ 'large-count': unreadCount > 99 }">
        {{ displayCount }}
      </span>
    </router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useNotificationsStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'

const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()

const unreadCount = computed(() => notificationsStore.unreadCount)
const hasUnreadNotifications = computed(() => notificationsStore.hasUnreadNotifications)

const displayCount = computed(() => {
  if (unreadCount.value > 99) return '99+'
  return unreadCount.value
})

let pollingInterval = null

onMounted(() => {
  if (authStore.token) {
    notificationsStore.fetchUnreadCount()

    pollingInterval = setInterval(() => {
      if (authStore.token) {
        notificationsStore.fetchUnreadCount()
      }
    }, 30000)
  }
})

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
})
</script>

<style scoped>
.notification-badge-wrapper {
  position: relative;
}

.notification-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

.notification-badge:hover {
  color: #fff;
}

.notification-badge.has-notifications {
  color: var(--accent-color);
  animation: pulse 2s infinite;
}

.notification-badge i {
  font-size: 18px;
  width: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.badge-count {
  position: absolute;
  top: -3px;
  right: -3px;
  background: #4caf50;
  color: white;
  font-size: 9px;
  font-weight: 600;
  padding: 2px;
  border-radius: 50%;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: bounce-in 0.5s ease;
}

.badge-count.large-count {
  font-size: 8px;
  padding: 2px;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

:root {
  --accent-color: #6c5ce7;
  --text-color: #2d3436;
  --error-color: #e17055;
  --success-color: #4caf50;
}

[data-theme='dark'] {
  --text-color: #ddd;
}

@media (max-width: 768px) {
  .notification-badge {
    width: 25px;
    height: 25px;
  }

  .notification-badge i {
    font-size: 16px;
  }

  .badge-count {
    top: -2px;
    right: -2px;
    font-size: 8px;
    min-width: 12px;
    height: 12px;
  }
}
</style>
