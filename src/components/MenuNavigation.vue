<template>
  <div class="nav-component">
    <!-- Мобильное меню -->
    <MobileMenu v-if="isMobile" :links="navLinks" />

    <!-- Десктопная боковая панель -->
    <DesktopMenu v-else :links="navLinks" />

    <!-- Модальное окно поиска -->
    <transition name="fade">
      <ModalSearch v-if="navbarStore.isModalSearchVisible" />
    </transition>
  </div>
</template>

<script setup>
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { useNavbarStore } from '@/store/navbar'
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'
import MobileMenu from './MenuNavigation/MobileMenu.vue'

// Loaded on first open: most visits never search from the modal.
const ModalSearch = defineAsyncComponent(() => import('./ModalSearch.vue'))
import { handleApiError } from '@/constants'

const store = useMainStore()
const authStore = useAuthStore()
const navbarStore = useNavbarStore()
const isMobile = computed(() => store.isMobile)

// The menu stays mounted during login/logout: derive links from live auth state.
// `group: 'bottom'` items sit at the foot of the desktop rail and are not tabs on phones.
const navLinks = computed(() => {
  const authenticated = authStore.isAuthenticated
  return [
    { to: '/', exact: true, icon: 'fas fa-home', text: 'Главная' },
    { action: 'search', icon: 'fas fa-search', text: 'Поиск' },
    {
      to: '/top',
      icon: 'fa-solid fa-trophy',
      text: 'Топ-250'
    },
    { to: '/lists', exact: true, icon: 'fas fa-bookmark', text: 'Списки' },
    {
      to: authenticated ? '/user' : '/login',
      exact: true,
      icon: authenticated ? 'fas fa-user' : 'fas fa-right-to-bracket',
      text: authenticated ? 'Профиль' : 'Войти'
    },
    { to: '/settings', icon: 'fa-solid fa-gear', text: 'Настройки', group: 'bottom' },
    { to: '/contact', icon: 'fas fa-info-circle', text: 'Контакты', group: 'bottom' }
  ]
})

let active = true
onBeforeUnmount(() => {
  active = false
})

onMounted(async () => {
  const session = authStore.token
  const isCurrentSession = () => active && authStore.token === session
  if (session) {
    try {
      const { getUser } = await import('@/api/user')
      if (!isCurrentSession()) return
      const user = await getUser()
      if (!isCurrentSession()) return
      authStore.setUser(user)
    } catch (error) {
      if (!isCurrentSession()) return
      const { code } = handleApiError(error)
      if (code === 401) {
        authStore.logout()
      }
    }
  }
})
</script>

<style scoped>
/* Стили для анимации fade */
.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-leave-active {
  transition: all 0s;
}

.fade-enter-from {
  opacity: 0;
}

.fade-enter-to {
  opacity: 1;
}
</style>
