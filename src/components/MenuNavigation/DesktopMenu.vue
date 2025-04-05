<template>
  <aside ref="sidebar" :class="['side-panel', { collapsed: !isSidebarOpen }]">
    <div class="top-section">
      <div class="logo-section">
        <router-link to="/" class="home-link" @click="closeSidebar">
          <img src="@/assets/basedge.png" alt="Base Edge" class="logo-image" />
          <h1 v-show="isSidebarOpen" class="logo-title">ReYohoho</h1>
        </router-link>
      </div>
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
            <component
              :is="link.to ? 'router-link' : 'a'"
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
            v-if="route.name !== 'home'"
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
        {{ activeTooltip === links?.length ? 'Поиск' : links[activeTooltip]?.text }}
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNavbarStore } from '@/store/navbar'

const props = defineProps({
  links: Array
})

const route = useRoute()

// Получаем доступ к хранилищу
const navbarStore = useNavbarStore()

// Флаг состояния боковой панели
const isSidebarOpen = ref(false)

// Ссылка на элемент боковой панели для отслеживания кликов вне её области
const sidebar = ref(null)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

// Закрываем боковую панель, если кликнули вне её области
const handleClickOutside = (event) => {
  if (sidebar.value && !sidebar.value.contains(event.target)) {
    isSidebarOpen.value = false
  }
}

// Всплывающая подсказка при свернутом сайдбаре
const tooltipPosition = ref({ x: 0, y: 0 })
const activeTooltip = ref(null)
const showTooltip = (index, event) => {
  activeTooltip.value = index
  const rect = event.target.getBoundingClientRect()
  tooltipPosition.value = {
    x: rect.right + 10,
    y: rect.top + 5
  }
}
const hideTooltip = () => {
  activeTooltip.value = null
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

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style lang="scss" scoped>
.home-link {
  text-decoration: none;
  background: transparent;
}

/* Десктопная боковая панель */
.side-panel {
  display: flex;
  flex-direction: column;
  width: 250px;
  height: 100vh;
  background: rgba(23, 23, 23, 0.95);
  -webkit-backdrop-filter: blur(10px); /* Для Safari 9+ */
  backdrop-filter: blur(10px);
  position: fixed;
  top: 0;
  left: 0;
  transition: width 0.3s ease;
  padding: 1rem 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 5;
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
}
.logo-section,
.home-link {
  display: flex;
  align-items: center;
}
.logo-title {
  white-space: nowrap;
  overflow: hidden;
  transition:
    max-width 0.3s ease,
    opacity 0.3s ease,
    margin 0.3s ease;
  max-width: 0;
  opacity: 0;
  margin-left: 0;
  color: #fff;
}
.side-panel:not(.collapsed) .logo-title {
  max-width: 200px;
  opacity: 1;
  margin: 0;
  margin-left: 8px;
}
.logo-image {
  height: 50px;
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
  transition:
    background 0.2s ease,
    color 0.2s ease;
  height: 20px;
}

.nav-links .support-link {
  align-items: self-end;
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
.nav-links a:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
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
</style>
