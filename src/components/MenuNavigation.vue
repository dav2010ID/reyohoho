<template>
  <div class="nav-component">
    <!-- Мобильное меню -->
    <MobileMenu v-if="isMobile" :links="navLinks" />

    <!-- Десктопная боковая панель -->
    <DesktopMenu v-else :links="navLinks" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

import MobileMenu from './MenuNavigation/MobileMenu.vue'
import DesktopMenu from './MenuNavigation/DesktopMenu.vue'

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
</style>
