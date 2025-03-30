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
import { useNavbarStore } from '@/store/navbar'
import { computed } from 'vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'
import MobileMenu from './MenuNavigation/MobileMenu.vue'
import ModalSearch from './ModalSearch.vue'

const store = useMainStore()
const navbarStore = useNavbarStore()
const isMobile = computed(() => store.isMobile)

const navLinks = [
  { to: '/', exact: true, icon: 'fas fa-home', text: 'Главная' },
  { to: '/top', icon: 'fa-solid fa-trophy', text: 'Популярное' },
  { href: 'https://t.me/ReYohoho/126', icon: 'fab fa-telegram', text: 'Приложение' },
  {
    href: 'https://gitlab.com/reyohoho/reyohoho-chrome-ff-ext',
    icon: 'fa-solid fa-puzzle-piece',
    text: 'Расширение'
  },
  {
    href: 'https://gitlab.com/-/snippets/4830428',
    icon: 'fas fa-heart',
    text: 'Благодарность'
  },
  { href: 'https://gitlab.com/reyohoho/reyohoho', icon: 'fab fa-gitlab', text: 'Gitlab' },
  { href: 'https://t.me/ReYohoho', icon: 'fab fa-telegram', text: 'Telegram' },
  {
    href: 'http://45.136.199.126:3001/status/reyohoho',
    icon: 'fas fa-tachometer-alt',
    text: 'Статус'
  },
  { to: '/contact', icon: 'fas fa-info-circle', text: 'Copyright' },
  { href: 'https://t.me/ReYohoho_Donut_Bot', icon: '', text: 'Поддержать' },
  { to: '/setting', icon: 'fa-solid fa-gear', text: 'Настройки' }
]
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
