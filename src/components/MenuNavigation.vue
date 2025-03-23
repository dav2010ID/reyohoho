<template>
  <div class="nav-component">
    <!-- Мобильное меню -->
    <MobileMenu v-if="isMobile" :links="navLinks" @toggle-search="toggleModalSearch" />

    <!-- Десктопная боковая панель -->
    <DesktopMenu v-else :links="navLinks" @toggle-search="toggleModalSearch" />

    <!-- Модальное окно поиска -->
    <transition name="fade">
      <ModalSearch v-if="isModalSearchVisible" @close-modal="toggleModalSearch" />
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

import MobileMenu from './MenuNavigation/MobileMenu.vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'
import ModalSearch from './ModalSearch.vue'
import { useStore } from 'vuex'

const store = useStore()

// Определяем, мобильное ли устройство (ширина окна меньше 600px)
const isMobile = computed(() => store.state.isMobile)

// Массив навигационных ссылок
const navLinks = [
  { to: '/', exact: true, icon: 'fas fa-home', text: 'Главная' },
  { to: '/top', icon: 'fa-solid fa-trophy', text: 'Популярное' },
  { href: 'https://t.me/ReYohoho/126', icon: 'fab fa-telegram', text: 'Приложение' },
  {
    href: 'https://github.com/reyohoho/reyohoho-chrome-ff-ext/blob/master/README.MD',
    icon: 'fa-solid fa-puzzle-piece',
    text: 'Расширение'
  },
  {
    href: 'https://gist.github.com/reyohoho/93d835ada55bb1175b4249cbf1f1bf20',
    icon: 'fas fa-heart',
    text: 'Благодарность'
  },
  { href: 'https://github.com/reyohoho/reyohoho', icon: 'fab fa-github', text: 'Github' },
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

// Поиск в модальном окне
const isModalSearchVisible = ref(false)
const toggleModalSearch = () => {
  isModalSearchVisible.value = !isModalSearchVisible.value
}
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
