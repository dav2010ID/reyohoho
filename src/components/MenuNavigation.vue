<template>
  <div class="nav-component">
    <!-- Мобильный бургер для открытия/закрытия мобильного меню -->
    <button v-if="isMobile" class="mobile-burger" @click.stop="toggleNavbar">
      <span v-if="isNavbarVisible">&#10005;</span>
      <span v-else>&#9776;</span>
    </button>

    <!-- Десктопная боковая панель -->
    <aside
      v-if="!isMobile"
      ref="sidebar"
      :class="['side-panel', { collapsed: !isSidebarOpen }]"
    >
      <div class="top-section">
        <div class="logo-section">
          <router-link to="/" class="home-link" @click="closeSidebar">
            <img src="@/assets/basedge.png" alt="Base Edge" class="logo-image" />
            <h1 v-show="isSidebarOpen" class="logo-title">Reyohoho</h1>
          </router-link>
        </div>
        <button @click="toggleSidebar" class="toggle-sidebar-btn">
          <i :class="isSidebarOpen ? 'fas fa-chevron-left' : 'fas fa-chevron-right'"></i>
        </button>
      </div>
      <nav class="side-nav">
        <ul class="nav-links">
          <li v-for="link in navLinks" :key="link.text">
            <!-- Используем динамический компонент для поддержки router-link и обычного <a> -->
              <component
                :is="link.to ? 'router-link' : 'a'"
                v-bind="link.to ? { to: link.to, exact: link.exact } : { href: link.href, target: '_blank' }"
                @click="closeSidebar"
              >
                <template v-if="typeof link.icon === 'string' && link.icon.startsWith('fa')">
                  <i :class="link.icon"></i>
                </template>
                <template v-else>
                  <img src="@/assets/icon-donut.png" alt="icon" class="icon-donut" />
                </template>
                <span v-show="isSidebarOpen" class="menu-text">{{ link.text }}</span>
              </component>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Мобильное меню -->
    <transition name="slide">
      <nav v-if="isNavbarVisible" class="mobile-navbar" @click.stop>
        <ul class="nav-links">
          <li v-for="link in navLinks" :key="link.text">
            <component
              :is="link.to ? 'router-link' : 'a'"
              v-bind="link.to ? { to: link.to, exact: link.exact } : { href: link.href, target: '_blank' }"
              @click="closeNavbar"
            >
            <template v-if="typeof link.icon === 'string' && link.icon.startsWith('fa')">
                  <i :class="link.icon"></i>
                </template>
                <template v-else>
                  <img src="@/assets/icon-donut.png" alt="icon" class="icon-donut" />
                </template>
                <span сlass="menu-text2">{{ link.text }}</span>
            </component>
          </li>
        </ul>
      </nav>
    </transition>
    <!-- Оверлей для закрытия мобильного меню при клике вне его -->
    <div v-if="isNavbarVisible" class="overlay" @click="closeNavbar"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

// Флаги видимости меню и состояния боковой панели
const isNavbarVisible = ref(false);
const isSidebarOpen = ref(false);

// Определяем, мобильное ли устройство (ширина окна меньше 600px)
const isMobile = ref(window.innerWidth < 600);

// Ссылка на элемент боковой панели для отслеживания кликов вне её области
const sidebar = ref(null);
const route = useRoute();

// Массив навигационных ссылок
const navLinks = [
  { to: '/', exact: true, icon: 'fas fa-home', text: 'Главная' },
  { to: '/top', icon: 'fa-solid fa-trophy', text: 'Популярное' },
  { href: 'https://t.me/ReYohoho/126', icon: 'fab fa-telegram', text: 'Приложение' },
  { href: 'https://github.com/reyohoho/reyohoho-chrome-ff-ext/blob/master/README.MD', icon: 'fa-solid fa-puzzle-piece', text: 'Расширение' },
  { href: 'https://gist.github.com/reyohoho/93d835ada55bb1175b4249cbf1f1bf20', icon: 'fas fa-heart', text: 'Благодарность' },
  { href: 'https://github.com/reyohoho/reyohoho', icon: 'fab fa-github', text: 'Github' },
  { href: 'https://t.me/ReYohoho', icon: 'fab fa-telegram', text: 'Telegram' },
  { href: 'http://45.136.199.126:3001/status/reyohoho', icon: 'fas fa-tachometer-alt', text: 'Статус' },
  { to: '/contact', icon: 'fas fa-info-circle', text: 'Copyright' },
  { href: 'https://t.me/ReYohoho_Donut_Bot', icon: '', text: 'Поддержать' },
];

// Функции для управления состоянием меню
const toggleNavbar = () => {
  isNavbarVisible.value = !isNavbarVisible.value;
};

const closeNavbar = () => {
  isNavbarVisible.value = false;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const closeSidebar = () => {
  isSidebarOpen.value = false;
};


// Обновляем состояние мобильного устройства при изменении размера окна
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 600;
};

// Закрываем боковую панель, если кликнули вне её области 
const handleClickOutside = (event) => {
  if (sidebar.value && !sidebar.value.contains(event.target)) {
    isSidebarOpen.value = false;
  }
};

// Закрываем мобильное меню при нажатии клавиши Escape
const handleKeydown = (event) => {
  if (event.key === 'Escape') closeNavbar();
};

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.nav-component {
  font-family: 'Neucha', sans-serif;
  font-weight: 400;
  font-size: 20px;
}

.home-link {
  text-decoration: none;
  background: transparent;
}

/* Мобильные устройства (<600px) */
@media (max-width: 600px) {
  .side-panel { display: none; }
  .mobile-burger {
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(99, 99, 99, 0.589);
    border: none;
    color: #fff;
    font-size: 1.4rem;
    z-index: 1100;
    cursor: pointer;
    padding: 10px;
  }
}

/* Десктопная боковая панель */
.side-panel {
  display: flex;
  flex-direction: column;
  width: 250px;
  height: 100vh;
  background: rgba(23, 23, 23, 0.95);
  backdrop-filter: blur(10px);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  transition: width 0.3s ease;
  padding: 1rem 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}
.side-panel.collapsed { width: 80px; }

.top-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 1rem;
  height: 110px;
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
  transition: max-width 0.3s ease, opacity 0.3s ease, margin 0.3s ease;
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
.logo-image { height: 50px; }

.side-nav { flex-grow: 1; }
.nav-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.nav-links li { width: 100%; }
.nav-links a,
.nav-links router-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: 10px 20px;
  transition: background 0.2s ease, color 0.2s ease;
  height: 20px;
}
.menu-text {
  white-space: nowrap;
  overflow: hidden;
  transition: max-width 0.3s ease, opacity 0.3s ease, margin 0.3s ease;
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
.nav-links a:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }

/* Мобильное меню */
.mobile-navbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 250px;
  height: 100vh;
  background: rgba(30, 30, 30, 0.97);
  z-index: 1000;
  padding-top: 60px;
}
.slide-enter-active,
.slide-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-enter-from,
.slide-leave-to { transform: translateX(-100%); }
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.icon-donut {
  height: 25px;
  object-fit: contain;
}
</style>
