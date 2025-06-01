<template>
  <BackgroundSpace />
  <MobileHeader v-if="isMobile" />
  <MenuNavigation />

  <div
    :class="['router-view-container', { 'router-view-container--with-mobile-header': isMobile }]"
  >
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>

  <!-- Затемняющий оверлей для обычного режима, включается тумблером -->
  <div v-if="dimmingEnabled" class="dimming-overlay" @click="toggleDimming"></div>

  <PwaUpdateNotification ref="pwaUpdateRef" />
</template>

<script setup>
import BackgroundSpace from '@/components/BackgroundSpace.vue'
import MenuNavigation from '@/components/MenuNavigation.vue'
import MobileHeader from '@/components/MobileHeader.vue'
import PwaUpdateNotification from '@/components/PwaUpdateNotification.vue'
import { useMainStore } from '@/store/main'
import { useNavbarStore } from '@/store/navbar'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const store = useMainStore()
const navbarStore = useNavbarStore()
const pwaUpdateRef = ref(null)

const isMobile = computed(() => store.isMobile)

// Реактивное состояние для ширины окна
const updateIsMobile = () => {
  store.setIsMobile(window.innerWidth < 600)
}

const handleKeyDown = (event) => {
  // Ctrl+F
  if (event.ctrlKey && event.keyCode === 70 && store.isCtrlFEnabled) {
    event.preventDefault()
    event.stopPropagation()
    navbarStore.openSearchModal()
  }

  // ESC
  if (event.keyCode === 27 && navbarStore.isModalSearchVisible) {
    event.preventDefault()
    event.stopPropagation()
    navbarStore.closeSearchModal()
  }

  if (import.meta.env.DEV && event.ctrlKey && event.shiftKey && event.keyCode === 85) {
    event.preventDefault()
    event.stopPropagation()
    console.log('🚀 Triggering PWA update test via keyboard shortcut')
    window.testPwaUpdate?.()
  }
}

onMounted(() => {
  store.setIsMobile(window.innerWidth < 600)
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('keydown', handleKeyDown, true)

  if (import.meta.env.DEV) {
    console.log('🎯 Development shortcuts:')
    console.log('   • Ctrl+Shift+U: Test PWA update')
    console.log('   • window.testPwaUpdate(): Test PWA update via console')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  document.removeEventListener('keydown', handleKeyDown, true)
})

const dimmingEnabled = computed(() => store.dimmingEnabled)
const toggleDimming = () => {
  store.toggleDimming()
}
</script>

<style>
@import '@/assets/main.scss';

#app {
  position: relative;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}

/* Затемняющий оверлей для обычного режима */
.dimming-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 5;
}

/* Стиль для страницы с учетом мобильного хедера */
.router-view-container {
  padding-top: 0; /* По умолчанию без отступа */
}

/* Отступ сверху для мобильного хедера */
.router-view-container--with-mobile-header {
  padding-top: 60px; /* Здесь height хедера */
}
</style>
