<template>
  <div class="nav-component">
    <!-- Мобильное меню -->
    <MobileMenu v-if="isMobile" :links="navLinks" @toggleSearch="toggleModalSearch" />

    <!-- Десктопная боковая панель -->
    <DesktopMenu v-else :links="navLinks" @toggleSearch="toggleModalSearch" />

    <!-- Модальное окно поиска -->
    <transition name="fade">
      <ModalSearch v-if="isModalSearchVisible" @closeModal="toggleModalSearch" />
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

import MobileMenu from './MenuNavigation/MobileMenu.vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'
import ModalSearch from './ModalSearch.vue'

// Определяем, мобильное ли устройство (ширина окна меньше 600px)
const isMobile = ref(window.innerWidth < 601)

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

// Обновляем состояние мобильного устройства при изменении размера окна
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 601
}

// Поиск в модальном окне
const isModalSearchVisible = ref(false)
const toggleModalSearch = () => {
  console.log('hi')
  isModalSearchVisible.value = !isModalSearchVisible.value
}

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  window.addEventListener('resize', updateIsMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
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
