<template>
  <!-- Icon with the unread count; the menu item around it is the link. -->
  <span
    v-if="available"
    class="notification-badge"
    :class="{ 'has-notifications': hasUnreadNotifications }"
  >
    <i class="fas fa-bell" aria-hidden="true"></i>
    <span v-if="unreadCount > 0" class="badge-count" :class="{ 'large-count': unreadCount > 99 }">
      <span class="visually-hidden">Непрочитанных: </span>{{ displayCount }}
    </span>
  </span>
</template>

<script setup>
import { computed, onUnmounted, watch } from 'vue'
import { accountCapabilities } from '@/api/accountCapabilities'
import { useNotificationsStore } from '@/store/notifications'
import { useAuthStore } from '@/store/auth'

const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()
const available = computed(() => accountCapabilities(authStore).notifications)

const unreadCount = computed(() => notificationsStore.unreadCount)
const hasUnreadNotifications = computed(() => notificationsStore.hasUnreadNotifications)

const displayCount = computed(() => {
  if (unreadCount.value > 99) return '99+'
  return unreadCount.value
})

let pollingInterval = null

watch(
  () => authStore.token,
  () => {
    const enabled = available.value
    clearInterval(pollingInterval)
    pollingInterval = null
    notificationsStore.reset()
    if (enabled) {
      notificationsStore.fetchUnreadCount()

      pollingInterval = setInterval(
        () => {
          if (available.value) {
            notificationsStore.fetchUnreadCount()
          }
        },
        1000 * 60 * 5
      )
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
})
</script>

<style scoped>
.notification-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.badge-count {
  position: absolute;
  top: -6px;
  right: -9px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  box-sizing: border-box;
  border-radius: 8px;
  background: var(--accent-solid);
  color: var(--accent-contrast);
  font-family: 'Roboto', sans-serif;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.badge-count.large-count {
  font-size: 9px;
}
</style>
