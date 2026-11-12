<template>
  <!-- Phones: back on the left, the page title once scrolled, profile tools on the right. -->
  <header class="app-header" :class="{ scrolled: isScrolled }">
    <button v-if="canGoBack" type="button" class="header-btn" aria-label="Назад" @click="goBack">
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>
    <span v-else class="header-spacer" aria-hidden="true"></span>
    <div class="header-content" :aria-hidden="!isScrolled">
      <template v-if="isScrolled && navbarStore.headerContent">
        <img
          v-if="navbarStore.headerContent.imageUrl"
          :src="navbarStore.headerContent.imageUrl"
          :alt="navbarStore.headerContent.text || 'Логотип'"
        />
        <span v-else-if="navbarStore.headerContent.text">{{ navbarStore.headerContent.text }}</span>
      </template>
    </div>
    <div class="header-actions">
      <template v-if="isProfileRoute">
        <router-link
          v-if="notificationsAvailable"
          to="/notifications"
          class="header-btn"
          aria-label="Уведомления"
        >
          <NotificationBadge />
        </router-link>
        <router-link to="/settings" class="header-btn" aria-label="Настройки">
          <i class="fa-solid fa-gear" aria-hidden="true"></i>
        </router-link>
      </template>
      <span v-else class="header-spacer" aria-hidden="true"></span>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavbarStore } from '@/store/navbar'
import { useAuthStore } from '@/store/auth'
import { accountCapabilities } from '@/api/accountCapabilities'
import NotificationBadge from '@/components/notification/NotificationBadge.vue'

const navbarStore = useNavbarStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const isProfileRoute = computed(() => route.name === 'user' || route.name === 'login')
const notificationsAvailable = computed(
  () => authStore.isAuthenticated && accountCapabilities(authStore).notifications
)

// vue-router keeps the previous in-app entry in history.state.back.
const canGoBack = ref(false)
const syncBack = () => {
  canGoBack.value = Boolean(window.history.state?.back)
}
const removeAfterEach = router.afterEach(() => syncBack())
const goBack = () => router.back()

const isScrolled = ref(false)
const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

onMounted(() => {
  syncBack()
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  removeAfterEach()
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  height: 56px;
  padding: 0 6px;
  background: transparent;
  transition: background-color 0.2s ease;
}

.app-header.scrolled {
  border-bottom: 1px solid var(--hairline);
  background: #111;
}

.header-content {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-height: 40px;
  padding: 0 8px;
  overflow: hidden;
  color: #fff;
  font-size: var(--fs-m);
  font-weight: 600;
  white-space: nowrap;
}

.header-content span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-content img {
  max-width: 100%;
  max-height: 32px;
  object-fit: contain;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-m);
  background: none;
  color: #fff;
  font-size: 18px;
  text-decoration: none;
  cursor: pointer;
}

.app-header:not(.scrolled) .header-btn {
  background: rgba(0, 0, 0, 0.45);
}

.header-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.header-spacer {
  width: 44px;
  height: 44px;
}
</style>
