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

  <div v-if="showGarland" id="garland" :style="{ backgroundImage: `url(${garlandImage})` }"></div>
</template>

<script setup>
import BackgroundSpace from '@/components/BackgroundSpace.vue'
import MenuNavigation from '@/components/MenuNavigation.vue'
import MobileHeader from '@/components/MobileHeader.vue'
import { useMainStore } from '@/store/main'
import { useNavbarStore } from '@/store/navbar'
import { computed, onMounted, onUnmounted } from 'vue'
import { isNewYearPeriod } from '@/utils/dateUtils'
import garlandImage from '@/assets/trn-christmas-lights.webp'

const store = useMainStore()
const navbarStore = useNavbarStore()

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
}

onMounted(() => {
  store.setIsMobile(window.innerWidth < 600)
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('keydown', handleKeyDown, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  document.removeEventListener('keydown', handleKeyDown, true)
})

const dimmingEnabled = computed(() => store.dimmingEnabled)
const toggleDimming = () => {
  store.toggleDimming()
}

const showGarland = computed(() => isNewYearPeriod())
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
  padding-bottom: 50px;
}

/* Отступ сверху для мобильного хедера */
.router-view-container--with-mobile-header {
  padding-top: 60px; /* Здесь height хедера */
}

#garland {
  position: fixed;
  left: 0;
  bottom: 0;
  background-repeat: repeat-x;
  height: 34px;
  width: 100%;
  pointer-events: none;
  overflow: hidden;
  transform: rotate(180deg);
  z-index: 1;
}
</style>
