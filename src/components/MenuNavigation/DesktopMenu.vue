<template>
  <!-- 80px rail: icon over a short label, no expanded state. -->
  <aside
    ref="sidebar"
    :class="[
      'side-panel',
      {
        'auto-hide': sidebarAutoHide,
        'auto-hide--peeked': sidebarAutoHide && isSidebarPeeked,
        right: sidebarPosition === 'right'
      }
    ]"
  >
    <router-link class="menu-brand" to="/" aria-label="ReYohoho — на главную">
      <img src="@/assets/icon-main-logo-150x150.png" alt="" class="menu-brand__logo" />
    </router-link>
    <nav class="side-nav" aria-label="Основное меню">
      <ul class="rail-list">
        <li v-if="canGoBack">
          <button type="button" class="rail-item rail-item--back" @click="goBack">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span class="rail-label">Назад</span>
          </button>
        </li>
        <li v-for="link in mainLinks" :key="link.text">
          <button
            v-if="link.action === 'search'"
            type="button"
            class="rail-item"
            aria-keyshortcuts="Control+F"
            @click="openSearch"
          >
            <i :class="link.icon" aria-hidden="true"></i>
            <span class="rail-label">{{ link.text }}</span>
          </button>
          <router-link
            v-else
            :to="link.to"
            class="rail-item"
            :class="{ 'is-active': isActive(link) }"
          >
            <i :class="link.icon" aria-hidden="true"></i>
            <span class="rail-label">{{ link.text }}</span>
          </router-link>
        </li>
      </ul>
      <ul class="rail-list rail-list--bottom">
        <li v-for="link in bottomLinks" :key="link.text">
          <router-link :to="link.to" class="rail-item" :class="{ 'is-active': isActive(link) }">
            <i :class="link.icon" aria-hidden="true"></i>
            <span class="rail-label">{{ link.text }}</span>
          </router-link>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavbarStore } from '@/store/navbar'
import { useMainStore } from '@/store/main'

const props = defineProps({
  links: Array
})

const route = useRoute()
const router = useRouter()
const navbarStore = useNavbarStore()
const mainStore = useMainStore()

const mainLinks = computed(() => (props.links || []).filter((link) => link.group !== 'bottom'))
const bottomLinks = computed(() => (props.links || []).filter((link) => link.group === 'bottom'))

// `exact` links match only their own path; others also own their sub-paths.
const isActive = (link) => {
  if (!link.to) return false
  if (link.exact) return route.path === link.to
  return route.path === link.to || route.path.startsWith(`${link.to}/`)
}

const openSearch = () => navbarStore.openSearchModal()

const sidebarAutoHide = computed(() => mainStore.sidebarAutoHide)
const sidebarPosition = computed(() => mainStore.sidebarPosition)

// Флаг «приоткрытой» панели при авто-скрытии
const isSidebarPeeked = ref(false)
let peekLeaveTimeout = null

// Зона срабатывания в пикселях от края экрана
const PEEK_TRIGGER_ZONE = 80
// Небольшой запас за реальной границей панели, чтобы она не мигала на краю.
const PEEK_KEEP_MARGIN = 16

const cancelSidebarPeekHide = () => {
  if (peekLeaveTimeout) {
    clearTimeout(peekLeaveTimeout)
    peekLeaveTimeout = null
  }
}

const hideSidebarPeek = () => {
  cancelSidebarPeekHide()
  isSidebarPeeked.value = false
}

const scheduleSidebarPeekHide = () => {
  if (peekLeaveTimeout) return

  peekLeaveTimeout = setTimeout(() => {
    isSidebarPeeked.value = false
    peekLeaveTimeout = null
  }, 220)
}

const handleMouseMove = (e) => {
  if (!sidebarAutoHide.value) return

  const isRight = sidebarPosition.value === 'right'
  const vw = window.innerWidth
  const x = e.clientX

  // Проверяем попадание в зону активации края экрана
  const inTriggerZone = isRight ? x >= vw - PEEK_TRIGGER_ZONE : x <= PEEK_TRIGGER_ZONE

  const sidebarRect = sidebar.value?.getBoundingClientRect()
  const inPanelZone = sidebarRect
    ? isRight
      ? x >= sidebarRect.left - PEEK_KEEP_MARGIN
      : x <= sidebarRect.right + PEEK_KEEP_MARGIN
    : false

  if (inTriggerZone || (isSidebarPeeked.value && inPanelZone)) {
    // Курсор в зоне — показываем панель
    cancelSidebarPeekHide()
    isSidebarPeeked.value = true
  } else if (isSidebarPeeked.value) {
    // Курсор вышел — скрываем с задержкой
    scheduleSidebarPeekHide()
  }
}

const handleDocumentMouseLeave = (event) => {
  if (!sidebarAutoHide.value) return
  if (event.relatedTarget || event.toElement) return

  hideSidebarPeek()
}

const sidebar = ref(null)

const internalNavigationHistory = ref([])
const isNavigatingBack = ref(false)

const canGoBack = computed(() => {
  return internalNavigationHistory.value.length > 1
})

const goBack = () => {
  if (internalNavigationHistory.value.length > 1) {
    isNavigatingBack.value = true
    internalNavigationHistory.value.pop()
    const previousRoute =
      internalNavigationHistory.value[internalNavigationHistory.value.length - 1]
    router.replace(previousRoute)
  }
}

const updateNavigationHistory = (to) => {
  if (isNavigatingBack.value) {
    isNavigatingBack.value = false
    return
  }

  if (
    internalNavigationHistory.value.length === 0 ||
    internalNavigationHistory.value[internalNavigationHistory.value.length - 1] !== to.fullPath
  ) {
    internalNavigationHistory.value.push(to.fullPath)
    if (internalNavigationHistory.value.length > 50) {
      internalNavigationHistory.value.shift()
    }
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove, { passive: true })
  document.addEventListener('mouseleave', handleDocumentMouseLeave)
  window.addEventListener('blur', hideSidebarPeek)
  if (route.fullPath) {
    internalNavigationHistory.value.push(route.fullPath)
  }
})

onBeforeUnmount(() => {
  if (peekLeaveTimeout) {
    clearTimeout(peekLeaveTimeout)
  }
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleDocumentMouseLeave)
  window.removeEventListener('blur', hideSidebarPeek)
})

watch(
  () => route.fullPath,
  () => updateNavigationHistory(route)
)
watch(sidebarAutoHide, (enabled) => {
  if (!enabled) hideSidebarPeek()
})
</script>

<style scoped>
.side-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-sidebar);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: var(--app-sidebar-collapsed-width);
  height: 100vh;
  padding: 16px 0;
  border-right: 1px solid var(--hairline);
  background: #111;
}

.menu-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-bottom: 16px;
}

.menu-brand__logo {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-m);
  object-fit: contain;
}

.menu-brand:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.side-nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0 8px;
  list-style: none;
}

.rail-list--bottom {
  padding-top: 16px;
}

.rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 6px 2px;
  border: none;
  border-radius: var(--radius-m);
  background: none;
  color: var(--text-dim);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.rail-item i,
.rail-item :deep(.notification-badge i) {
  font-size: 20px;
  line-height: 1;
}

.rail-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.rail-label {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.rail-item.is-active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.rail-item.is-active i,
.rail-item.is-active :deep(.notification-badge i) {
  color: var(--accent-text);
}

/* 2px bar on the inner edge marks the current section. */
.rail-item.is-active::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: -8px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent-ui);
}

.rail-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.rail-item--back {
  min-height: 44px;
}

/* Auto-hide: the rail slides out and leaves a thin edge marker. */
.side-panel.auto-hide {
  transform: translateX(calc(-100% + 4px));
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.side-panel.auto-hide::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(
    180deg,
    transparent,
    var(--accent-ui) 40%,
    var(--accent-ui) 60%,
    transparent
  );
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.side-panel.auto-hide.auto-hide--peeked {
  transform: translateX(0);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);
}

.side-panel.auto-hide.auto-hide--peeked::after {
  opacity: 0;
}

.side-panel.right {
  right: 0;
  left: auto;
  border-right: none;
  border-left: 1px solid var(--hairline);
}

.side-panel.right .rail-item.is-active::before {
  right: -8px;
  left: auto;
}

.side-panel.right.auto-hide {
  transform: translateX(calc(100% - 4px));
}

.side-panel.right.auto-hide::after {
  right: auto;
  left: 0;
}

.side-panel.right.auto-hide.auto-hide--peeked {
  transform: translateX(0);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.45);
}
</style>
