<template>
  <!-- Мобильный бургер для открытия/закрытия мобильного меню -->
  <button class="mobile-burger" @click.stop="toggleNavbar">
    <div :style="!isNavbarVisible ? 'margin-top: -3px' : ''">
      {{ isNavbarVisible ? '&#10005;' : '&#9776;' }}
    </div>
  </button>
  <transition name="slide">
    <nav v-if="isNavbarVisible" class="mobile-navbar" @click.stop>
      <ul class="nav-links">
        <li v-for="link in links" :key="link.text">
          <component
            :is="link.to ? 'router-link' : 'a'"
            v-bind="
              link.to ? { to: link.to, exact: link.exact } : { href: link.href, target: '_blank' }
            "
            @click="closeNavbar"
          >
            <template v-if="typeof link.icon === 'string' && link.icon.startsWith('fa')">
              <i :class="link.icon"></i>
            </template>
            <template v-else>
              <img src="@/assets/icon-donut.png" alt="icon" class="icon-donut" />
            </template>
            <span class="menu-text">{{ link.text }}</span>
          </component>
        </li>
      </ul>
    </nav>
  </transition>
  <!-- Оверлей для закрытия мобильного меню при клике вне его -->
  <div v-if="isNavbarVisible" class="overlay" @click="closeNavbar"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  links: Array,
})

// Флаг видимости меню
const isNavbarVisible = ref(false)

// Функции для управления состоянием меню
const toggleNavbar = () => {
  isNavbarVisible.value = !isNavbarVisible.value
}

const closeNavbar = () => {
  isNavbarVisible.value = false
}

// todo: Может быть стоит обрабатывать нажатия клавиш глобально по всему приложению и управлять поведением через store?
// Закрываем мобильное меню при нажатии клавиши Escape
const handleKeydown = (event) => {
  if (event.key === 'Escape') closeNavbar()
}

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.mobile-burger {
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(61, 61, 61, 0.96);
  border: none;
  color: #fff;
  font-size: 1.4rem;
  z-index: 1100;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
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

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

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
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
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
