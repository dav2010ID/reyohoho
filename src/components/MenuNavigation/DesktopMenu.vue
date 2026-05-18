<template>
  <aside
    ref="sidebar"
    :class="['side-panel', { collapsed: !isSidebarOpen, 'auto-hide': sidebarAutoHide, 'auto-hide--peeked': sidebarAutoHide && isSidebarPeeked, right: sidebarPosition === 'right' }]"
  >
    <router-link class="menu-brand" to="/" aria-label="ReYohoho">
      <img src="@/assets/icon-main-logo-150x150.png" alt="" class="menu-brand__logo" />
      <span v-show="isSidebarOpen" class="menu-brand__text">ReYohoho</span>
    </router-link>
    <div class="top-section">
      <button
        v-if="canGoBack"
        class="back-btn"
        :aria-label="'Назад'"
        :title="isSidebarOpen ? '' : 'Назад'"
        @click="goBack"
      >
        <i class="fas fa-arrow-left"></i>
        <span v-show="isSidebarOpen" class="back-text">Назад</span>
      </button>
      <button
        class="toggle-sidebar-btn"
        :aria-label="isSidebarOpen ? 'Свернуть меню' : 'Развернуть меню'"
        @click="toggleSidebar"
      >
        <i :class="sidebarPosition === 'right' ? (isSidebarOpen ? 'fas fa-chevron-right' : 'fas fa-chevron-left') : (isSidebarOpen ? 'fas fa-chevron-left' : 'fas fa-chevron-right')"></i>
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
                :aria-label="link.text"
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
              :aria-label="link.text"
              @click="closeSidebar"
            >
              <template v-if="typeof link.icon === 'string' && link.icon.startsWith('fa')">
                <i :class="link.icon"></i>
              </template>
              <template
                v-else-if="typeof link.icon === 'string' && link.icon.startsWith('https://')"
              >
                <img :src="link.icon" :alt="link.text" class="icon-user" />
              </template>
              <template v-else>
                <img src="@/assets/icon-donut.png" :alt="link.text" class="icon-donut" />
              </template>
              <span v-show="isSidebarOpen" class="menu-text">{{ link.text }}</span>
            </component>
          </li>
          <li
            v-if="route.name !== 'home' && props.links.length > 0"
            @pointerenter="showTooltip(links.length, $event)"
            @pointerleave="hideTooltip"
          >
            <button type="button" class="search-toggle-btn" aria-label="Открыть поиск" @click="toggleSearch">
              <i class="fas fa-search"></i>
              <span v-show="isSidebarOpen" class="menu-text">Поиск</span>
            </button>
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
import { useMainStore } from '@/store/main'
import NotificationBadge from '@/components/notification/NotificationBadge.vue'

const props = defineProps({
  links: Array
})

const route = useRoute()
const router = useRouter()

// Получаем доступ к хранилищу
const navbarStore = useNavbarStore()
const mainStore = useMainStore()

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
  const inTriggerZone = isRight
    ? x >= vw - PEEK_TRIGGER_ZONE
    : x <= PEEK_TRIGGER_ZONE

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
  document.addEventListener('mousemove', handleMouseMove, { passive: true })
  document.addEventListener('mouseleave', handleDocumentMouseLeave)
  window.addEventListener('blur', hideSidebarPeek)
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
  if (peekLeaveTimeout) {
    clearTimeout(peekLeaveTimeout)
  }
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleDocumentMouseLeave)
  window.removeEventListener('blur', hideSidebarPeek)
})

watch(() => route.fullPath, () => updateNavigationHistory(route))
watch(sidebarAutoHide, (enabled) => {
  if (!enabled) hideSidebarPeek()
})
</script>

<style lang="scss" scoped>

/* Десктопная боковая панель */
.side-panel {
  display: flex;
  flex-direction: column;
  width: 230px;
  height: 100vh;
  background: rgba(23, 23, 23, 0.98);
  position: fixed;
  top: 0;
  left: 0;
  transition: width 0.3s ease;
  padding: 1rem 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: var(--z-sidebar);
  will-change: width;
}
.side-panel.collapsed {
  width: var(--app-sidebar-collapsed-width);
}

.menu-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 14px 12px;
  color: #fff;
  text-decoration: none;
}

.menu-brand__logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 10px;
}

.menu-brand__text {
  min-width: 130px;
  font-size: 24px;
  line-height: 1;
  white-space: nowrap;
}

.side-panel.collapsed .menu-brand {
  padding-inline: 0;
}

.top-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
  font-weight: 700;
  font-size: 27px;
}
.toggle-sidebar-btn {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}
.toggle-sidebar-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--accent-color, #6c5ce7);
  border-left-color: var(--accent-color, #6c5ce7);
}

.side-panel:not(.collapsed) .toggle-sidebar-btn {
  width: calc(100% - 17px);
  justify-content: flex-end;
  padding-right: 20px;
  border-radius: 0 12px 12px 0;
}

.side-panel.collapsed .toggle-sidebar-btn {
  width: 42px;
  align-self: center;
  border-left: 0;
  border-radius: 8px;
}

.side-panel.collapsed .toggle-sidebar-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-left: 0;
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
  gap: 0.55rem;
}
.nav-links li {
  width: 100%;
  position: relative;
}
.nav-links a,
.nav-links button,
.notification-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: 10px 17px;
  transition: all 0.3s ease;
  min-height: 42px;
  height: auto;
  border-left: 3px solid transparent;
  border-radius: 0 12px 12px 0;
}

.side-panel:not(.collapsed) .nav-links a,
.side-panel:not(.collapsed) .nav-links button,
.side-panel:not(.collapsed) .notification-link {
  min-width: 230px;
}

.side-panel.collapsed .nav-links a,
.side-panel.collapsed .nav-links button,
.side-panel.collapsed .notification-link {
  justify-content: center;
  padding: 10px;
  min-width: auto;
}

.nav-links a i,
.nav-links a img,
.nav-links button i,
.nav-links button img,
.notification-link i,
.notification-link img {
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

.side-panel.collapsed .nav-links a i,
.side-panel.collapsed .nav-links a img,
.side-panel.collapsed .nav-links button i,
.side-panel.collapsed .nav-links button img,
.side-panel.collapsed .notification-link i,
.side-panel.collapsed .notification-link img {
  margin: 0;
}

.nav-links a,
.nav-links button,
.notification-link {
  will-change: transform;
}

.nav-links a:hover,
.notification-link:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
  transform: translateX(3px);
}

.nav-links a:active,
.nav-links a.router-link-active,
.notification-link:active,
.notification-link.router-link-active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.2));
  color: var(--accent-color, #6c5ce7);
  border-left: 3px solid var(--accent-color, #6c5ce7);
}

.search-toggle-btn {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.search-toggle-btn:hover,
.search-toggle-btn:active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  transform: translateX(3px);
  border-left: 3px solid var(--accent-color, #6c5ce7);
}

.search-toggle-btn:focus-visible {
  outline: none;
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
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
  position: fixed;
  top: 5px;
  left: var(--app-sidebar-collapsed-width);
  background-color: rgba(35, 35, 35, 0.98);
  color: #fff;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

a {
  cursor: pointer;
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

/* ─── Авто-скрытие боковой панели ─── */
.side-panel.auto-hide {
  /* Полностью убираем влево, оставляем только тонкую полоску-индикатор */
  transform: translateX(calc(-100% + 4px));
  transition:
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s ease,
    box-shadow 0.35s ease;
  box-shadow: none;

  /* Тонкая светящаяся полоска, чтобы пользователь знал, где панель */
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--accent-color, #6c5ce7) 40%,
      var(--accent-color, #6c5ce7) 60%,
      transparent 100%
    );
    opacity: 0.5;
    border-radius: 0 2px 2px 0;
    transition: opacity 0.3s ease;
  }
}

.side-panel.auto-hide.auto-hide--peeked {
  transform: translateX(0);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);

  &::after {
    opacity: 0;
  }
}


/* ─── Боковая панель справа ─── */
.side-panel.right {
  left: auto;
  right: 0;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);

  /* Переворачиваем стрелки border-left → border-right для nav-links */
  .nav-links a,
  .nav-links button,
  .notification-link {
    border-left: none;
    border-right: 3px solid transparent;
    border-radius: 12px 0 0 12px;
  }

  .nav-links a:hover,
  .notification-link:hover {
    border-left: none;
    border-right: 3px solid var(--accent-color, #6c5ce7);
    transform: translateX(-3px);
  }

  .nav-links a:active,
  .nav-links a.router-link-active,
  .notification-link:active,
  .notification-link.router-link-active {
    border-left: none;
    border-right: 3px solid var(--accent-color, #6c5ce7);
  }

  .toggle-sidebar-btn {
    border-left: none;
    border-right: 3px solid transparent;
    border-radius: 12px 0 0 12px;
    justify-content: flex-start;
    padding-left: 20px;
  }

  .toggle-sidebar-btn:hover {
    border-left: none;
    border-right-color: var(--accent-color, #6c5ce7);
  }

  .search-toggle-btn {
    border-left: none;
    border-right: 3px solid transparent;
  }

  .search-toggle-btn:hover,
  .search-toggle-btn:active {
    border-left: none;
    border-right: 3px solid var(--accent-color, #6c5ce7);
    transform: translateX(-3px);
  }

  .back-btn:hover {
    transform: translateX(2px);
  }
}

/* При авто-скрытии справа — сдвигаем вправо */
.side-panel.right.auto-hide {
  transform: translateX(calc(100% - 4px));

  &::after {
    left: 0;
    right: auto;
    border-radius: 2px 0 0 2px;
  }
}

.side-panel.right.auto-hide.auto-hide--peeked {
  transform: translateX(0);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.45);
}

/* Тултип справа */
.side-panel.right .tooltip {
  left: auto;
  right: var(--app-sidebar-collapsed-width);
}

</style>
