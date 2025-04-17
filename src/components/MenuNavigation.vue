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
import { computed, ref, onMounted } from 'vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'
import MobileMenu from './MenuNavigation/MobileMenu.vue'
import ModalSearch from './ModalSearch.vue'
import { getBaseURL } from '@/api/axios'
import { getUser } from '@/api/user'
import { handleApiError } from '@/constants'

const store = useMainStore()
const authStore = useAuthStore()
const navbarStore = useNavbarStore()
const isMobile = computed(() => store.isMobile)
const navLinks = ref([])
onMounted(async () => {
  const baseURL = await getBaseURL()
  if (authStore.token) {
    try {
      let user = await getUser()
      authStore.setUser(user)
    } catch (error) {
      const { code } = handleApiError(error)
      if (code === 401) {
        authStore.logout()
      }
    }
  }

  navLinks.value = [
    { to: '/', exact: true, icon: 'fas fa-home', text: 'Главная' },
    {
      to: authStore.user ? '/user' : '/login',
      exact: true,
      icon: authStore.user
        ? authStore.user.photo
          ? `${baseURL}${authStore.user.photo}`
          : 'fas fa-user' // Иконка человека, если фото нет
        : 'fas fa-right-to-bracket',
      text: authStore.user ? 'Профиль' : 'Войти'
    },
    ...(authStore.token
      ? [
          {
            to: '/lists',
            exact: true,
            icon: 'fas fa-bookmark',
            text: 'Мои списки'
          }
        ]
      : []),
    { to: '/top', icon: 'fa-solid fa-trophy', text: 'Популярное' },
    { to: '/settings', icon: 'fa-solid fa-gear', text: 'Настройки' },
    { to: '/links', icon: 'fa-solid fa-info-circle', text: 'Полезные ссылки' }
  ]
})
</script>

<style scoped>
.nav-component {
  font-family: 'Neucha', sans-serif;
  font-weight: 400;
  font-size: 20px;
}

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
