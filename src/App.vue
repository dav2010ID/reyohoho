<template>
  <ConfirmationHost />
  <BackgroundSpace />
  <MobileHeader v-if="isMobile" />
  <MenuNavigation />

  <main
    id="main-content"
    :class="['router-view-container', { 'router-view-container--with-mobile-header': isMobile }]"
  >
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </main>

  <!-- Затемняющий оверлей для обычного режима, включается тумблером -->
  <div v-if="dimmingEnabled" class="dimming-overlay" @click="toggleDimming"></div>

  <div v-if="showGarland" id="garland" :style="{ backgroundImage: `url(${garlandImage})` }"></div>
</template>

<script setup>
import ConfirmationHost from '@/components/ConfirmationHost.vue'
import BackgroundSpace from '@/components/BackgroundSpace.vue'
import MenuNavigation from '@/components/MenuNavigation.vue'
import MobileHeader from '@/components/MobileHeader.vue'
import { useMainStore } from '@/store/main'
import { useNavbarStore } from '@/store/navbar'
import { useHead } from '@unhead/vue'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isNewYearPeriod } from '@/utils/dateUtils'
import { buildStaticCanonicalUrl } from '@/utils/staticSeo'
import garlandImage from '@/assets/trn-christmas-lights.webp'

const store = useMainStore()
const navbarStore = useNavbarStore()
const route = useRoute()
let stopSidebarPositionWatch = null

// Keep a route-level title entry alive while page-specific SEO head entries mount and unmount.
// Without this fallback, removing the home page head can restore its old title on another route.
const siteImage = buildStaticCanonicalUrl('/') + 'icons/icon-512x512.png'
useHead(() => ({
  title: route.meta?.title || 'ReYohoho',
  meta: route.name === 'movie-info' || route.name === 'movie-info-shiki'
    ? []
    : [{ property: 'og:image', content: siteImage }]
}))

// Применяем класс sidebar-right на body при смене позиции панели
const sidebarPosition = computed(() => store.sidebarPosition)
const applySidebarPosition = (pos) => {
  document.body.classList.toggle('sidebar-right', pos === 'right')
}

const isMobile = computed(() => store.isMobile)

// Реактивное состояние для ширины окна
const updateIsMobile = () => {
  store.setIsMobile(window.innerWidth < 600)
}

const handleKeyDown = (event) => {
  // Ctrl+F
  if (!event.target?.closest?.('input,textarea,select,[contenteditable="true"]') &&
      ((!event.ctrlKey && !event.metaKey && !event.altKey && event.key === '/') ||
        (event.ctrlKey && event.key.toLowerCase() === 'f' && store.isCtrlFEnabled))) {
    event.preventDefault()
    event.stopPropagation()
    navbarStore.openSearchModal()
  }

  // ESC
  if (event.key === 'Escape' && navbarStore.isModalSearchVisible) {
    event.preventDefault()
    event.stopPropagation()
    navbarStore.closeSearchModal()
  }
}

onMounted(() => {
  store.setIsMobile(window.innerWidth < 600)
  stopSidebarPositionWatch = watch(sidebarPosition, applySidebarPosition, { immediate: true })
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('keydown', handleKeyDown, true)
})

onUnmounted(() => {
  if (stopSidebarPositionWatch) {
    stopSidebarPositionWatch()
    stopSidebarPositionWatch = null
  }
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

<style>
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
