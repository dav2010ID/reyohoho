<template>
  <aside ref="sidebar" :class="['side-panel', { collapsed: !isSidebarOpen }]">
    <div class="top-section">
      <button
        v-if="canGoBack"
        class="back-btn"
        :title="isSidebarOpen ? '' : 'Назад'"
        @click="goBack"
      >
        <i class="fas fa-arrow-left"></i>
        <span v-show="isSidebarOpen" class="back-text">Назад</span>
      </button>
      <button class="toggle-sidebar-btn" @click="toggleSidebar">
        <i :class="isSidebarOpen ? 'fas fa-chevron-left' : 'fas fa-chevron-right'"></i>
      </button>
    </div>
    <nav class="side-nav">
      <div class="nav-links-wrapper">
        <ul class="nav-links">
          <li
            v-for="(link, idx) in props.links"
            :key="link.text"
            @pointerenter="showTooltip(idx, $event)"
            @pointerleave="hideTooltip"
          >
            <template v-if="link.component === 'NotificationBadge'">
              <router-link
                :to="link.to"
                :exact="link.exact"
                class="notification-link"
                @click="closeSidebar"
              >
                <NotificationBadge />
                <span v-show="isSidebarOpen" class="menu-text">{{ link.text }}</span>
              </router-link>
            </template>

            <component
              :is="link.to ? 'router-link' : 'a'"
              v-else
              v-bind="
                link.to ? { to: link.to, exact: link.exact } : { href: link.href, target: '_blank' }
              "
              :class="{ 'support-link': !link.icon }"
              @click="closeSidebar"
            >
              <template v-if="typeof link.icon === 'string' && link.icon.startsWith('fa')">
                <i :class="link.icon"></i>
              </template>
              <template
                v-else-if="typeof link.icon === 'string' && link.icon.startsWith('https://')"
              >
                <img :src="link.icon" alt="icon" class="icon-user" />
              </template>
              <template v-else>
                <img src="@/assets/icon-donut.png" alt="icon" class="icon-donut" />
              </template>
              <span v-show="isSidebarOpen" class="menu-text">{{ link.text }}</span>
            </component>
          </li>
          <li
            v-if="route.name !== 'home' && props.links.length > 0"
            @pointerenter="showTooltip(links.length, $event)"
            @pointerleave="hideTooltip"
          >
            <a @click="toggleSearch">
              <i class="fas fa-search"></i>
              <span v-show="isSidebarOpen" class="menu-text">Поиск</span>
            </a>
          </li>
        </ul>
      </div>

      <div v-if="!isSidebarOpen && activeTooltip !== null" class="tooltip" :style="tooltipStyle">
        {{ activeTooltip === links?.length ? 'Поиск (Ctrl+F)' : links[activeTooltip]?.text }}
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavbarStore } from '@/store/navbar'
import NotificationBadge from '@/components/notification/NotificationBadge.vue'

const props = defineProps({
  links: Array
})

const route = useRoute()
const router = useRouter()

// Получаем доступ к хранилищу
const navbarStore = useNavbarStore()

// Флаг состояния боковой панели
const isSidebarOpen = ref(false)


const internalNavigationHistory = ref([])
const isNavigatingBack = ref(false)

// Ссылка на элемент боковой панели для отслеживания кликов вне её области
const sidebar = ref(null)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

let clickOutsideTimeout = null
const handleClickOutside = (event) => {
  if (clickOutsideTimeout) return
  clickOutsideTimeout = window.requestAnimationFrame(() => {
    if (sidebar.value && !sidebar.value.contains(event.target) && isSidebarOpen.value) {
      isSidebarOpen.value = false
    }
    clickOutsideTimeout = null
  })
}

const tooltipPosition = ref({ x: 0, y: 0 })
const activeTooltip = ref(null)
let tooltipTimeout = null
let tooltipEvent = null

const showTooltip = (index, event) => {
  if (isSidebarOpen.value) return
  
  tooltipEvent = event
  
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
  
  tooltipTimeout = setTimeout(() => {
    if (tooltipEvent) {
      activeTooltip.value = index
      const rect = tooltipEvent.target.getBoundingClientRect()
      tooltipPosition.value = {
        x: rect.right + 10,
        y: rect.top + 5
      }
    }
    tooltipTimeout = null
  }, 150)
}

const hideTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
    tooltipTimeout = null
  }
  activeTooltip.value = null
  tooltipEvent = null
}
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x}px`,
  top: `${tooltipPosition.value.y}px`
}))

// Открыть модалку поиска через хранилище
const toggleSearch = () => {
  closeSidebar()
  navbarStore.openSearchModal() // Используем метод из хранилища для управления модалкой поиска
}

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

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (route.fullPath) {
    internalNavigationHistory.value.push(route.fullPath)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (clickOutsideTimeout) {
    window.cancelAnimationFrame(clickOutsideTimeout)
  }
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
})

watch(
  route,
  (to, from) => {
    updateNavigationHistory(to, from)
  },
  { immediate: false }
)
</script>

<style lang="scss" scoped>

/* Десктопная боковая панель */
.side-panel {
  display: flex;
  flex-direction: column;
  width: 250px;
  height: 100vh;
  background: rgba(23, 23, 23, 0.98);
  position: fixed;
  top: 0;
  left: 0;
  transition: width 0.3s ease;
  padding: 1rem 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 5;
  will-change: width;
}
.side-panel.collapsed {
  width: 80px;
}

.top-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
  font-weight: 700;
  font-size: 27px;
}
.toggle-sidebar-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.3s ease;
}
.toggle-sidebar-btn:hover {
  color: var(--accent-color, #6c5ce7);
  transform: scale(1.1);
}

.side-nav {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-links-wrapper {
  flex: 1;
  padding-bottom: 1rem;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px; /* Ширина вертикального скроллбара */
    height: 12px; /* Высота горизонтального скроллбара */
  }

  &::-webkit-scrollbar-track {
    background: transparent; /* Цвет фона */
    border-radius: 10px; /* Закругление углов */
  }

  &::-webkit-scrollbar-thumb {
    background: #494949; /* Цвет ползунка */
    border-radius: 10px; /* Закругление углов */
    border: 0; /* Отступ вокруг ползунка */
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555; /* Цвет ползунка при наведении */
  }
}

.nav-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.nav-links li {
  width: 100%;
  position: relative;
}
.nav-links a,
.nav-links button {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: 10px 20px;
  transition: all 0.3s ease;
  height: 20px;
}

.side-panel:not(.collapsed) .nav-links a {
  min-width: 250px;
}

.side-panel.collapsed .nav-links a {
  justify-content: center;
  padding: 10px;
  min-width: auto;
}

.nav-links a i,
.nav-links a img {
  width: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.nav-links .support-link {
  align-items: center;
}

.menu-text {
  white-space: nowrap;
  overflow: hidden;
  transition:
    max-width 0.3s ease,
    opacity 0.3s ease,
    margin 0.3s ease;
  max-width: 0;
  opacity: 0;
  margin-left: 0;
  width: 130px;
  display: inline-block;
}
.side-panel:not(.collapsed) .menu-text {
  max-width: 130px;
  opacity: 1;
  margin-left: 8px;
}
.side-panel.collapsed .nav-links a {
  justify-content: center;
  padding: 10px;
}
.side-panel.collapsed .nav-links a i,
.side-panel.collapsed .nav-links a img {
  margin: 0;
}
.nav-links a {
  will-change: transform;
}

.nav-links a:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
  transform: translateX(3px);
}

.nav-links a:active,
.nav-links a.router-link-active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.2));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
}

.icon-user {
  height: 25px;
  width: 25px;
  object-fit: contain;
  border-radius: 50%;
}

.icon-donut {
  height: 25px;
  object-fit: contain;
}

.tooltip {
  position: absolute;
  top: 5px;
  left: 70px;
  background-color: #333;
  color: #fff;
  padding: 5px;
  border-radius: 4px;
  white-space: nowrap;
}

a {
  cursor: pointer;
}

.notification-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: 10px 20px;
  transition: all 0.3s ease;
  height: 20px;
}

.notification-link:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
  transform: translateX(3px);
}

.notification-link:active,
.notification-link.router-link-active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.2));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
}

.side-panel.collapsed .notification-link {
  justify-content: center;
  padding: 10px;
}

.back-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  cursor: pointer;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn:hover {
  color: var(--accent-color, #6c5ce7);
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  transform: translateX(-2px);
}

.back-text {
  white-space: nowrap;
  overflow: hidden;
  transition:
    max-width 0.3s ease,
    opacity 0.3s ease;
  max-width: 0;
  opacity: 0;
}

.side-panel:not(.collapsed) .back-text {
  max-width: 100px;
  opacity: 1;
}
</style>
