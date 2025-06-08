<template>
  <div class="back-header"></div>
  <header class="app-header" :class="{ scrolled: isScrolled }">
    <ToggleMenu @toggle-navbar="toggleNavbar" />
    <div class="header-content">
      <!-- Если есть изображение, показываем его -->
      <img
        v-if="navbarStore.headerContent && navbarStore.headerContent.imageUrl"
        :src="navbarStore.headerContent.imageUrl"
        alt="Логотип"
      />

      <!-- Если изображения нет, но есть текст, показываем текст -->
      <span v-else-if="navbarStore.headerContent && navbarStore.headerContent.text">{{
        navbarStore.headerContent.text
      }}</span>

      <!-- Если нет ни текста, ни изображения, ничего не показываем -->
    </div>
    <div class="header-actions">
      <button class="btn btn--search" @click="toggleSearch">
        <i class="fas fa-search"></i>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ToggleMenu from '@/components/buttons/ToggleMenu.vue'
import { useNavbarStore } from '@/store/navbar'

const navbarStore = useNavbarStore()

const toggleSearch = () => {
  navbarStore.toggleSearchModal()
  navbarStore.closeNavbar()
}
const toggleNavbar = () => navbarStore.toggleNavbar()

const isScrolled = ref(false)

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.app-header {
  background: transparent;
  transition: background 0.3s ease;
}

.app-header.scrolled {
  background: rgba(30, 30, 30, 0.97);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.back-header {
  display: none;
  /* Скрываем градиентный фон */
}

.back-header {
  position: fixed;
  background: linear-gradient(to bottom, rgb(0, 0, 0) 0%, rgba(30, 30, 30, 0) 100%);
  z-index: -1;
  width: 100%;
  height: 100px;
}

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 6;
  padding: 10px 0;
  height: 60px;
}

.header-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  max-height: 40px;
  overflow: hidden;
  color: white;
  font-size: 20px;
  font-weight: bold;
  padding: 0 10px;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.header-content img {
  max-height: 40px;
  max-width: 100%;
  width: auto;
  object-fit: contain;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px;
  flex-shrink: 0;
}
</style>
