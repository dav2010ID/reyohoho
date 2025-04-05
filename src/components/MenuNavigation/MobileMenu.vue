<template>
  <transition name="slide">
    <nav v-if="isNavbarVisible" class="mobile-navbar" @click.stop>
      <div class="nav-links-wrapper">
        <ul class="nav-links">
          <li v-for="link in props.links" :key="link.text">
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
              <template
                v-else-if="typeof link.icon === 'string' && link.icon.startsWith('https://')"
              >
                <img :src="link.icon" alt="icon" class="icon-user" />
              </template>
              <template v-else>
                <img src="@/assets/icon-donut.png" alt="icon" class="icon-donut" />
              </template>
              <span class="menu-text">{{ link.text }}</span>
            </component>
          </li>
          <li v-if="route.name !== 'home'">
            <a @click="toggleSearch">
              <i class="fas fa-search"></i>
              <span class="menu-text">Поиск</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  </transition>

  <div v-if="isNavbarVisible" class="overlay" @click="closeNavbar"></div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useNavbarStore } from '@/store/navbar'
import { useRoute } from 'vue-router'

const props = defineProps({
  links: Array
})

const route = useRoute()
const navbarStore = useNavbarStore()
const { isNavbarVisible } = storeToRefs(navbarStore)
const { closeNavbar, toggleSearchModal } = navbarStore

const toggleSearch = () => {
  toggleSearchModal()
  navbarStore.closeNavbar()
}
</script>

<style scoped>
/* Стили для мобильного меню и оверлея */
.mobile-navbar {
  position: fixed;
  left: 0;
  width: 250px;
  height: 100vh;
  background: rgba(30, 30, 30, 0.97);
  padding-top: 60px;
  z-index: 5;
}

.nav-links-wrapper {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
  height: calc(100vh - 60px);
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
}

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
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
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 4;
}

.icon-donut {
  height: 25px;
  object-fit: contain;
}

.icon-user {
  height: 25px;
  width: 25px;
  object-fit: contain;
  border-radius: 50%;
}
</style>
