<template>
  <transition name="slide">
    <nav v-if="isNavbarVisible" class="mobile-navbar" @click.stop>
      <button
        class="mobile-navbar__close"
        type="button"
        aria-label="Закрыть меню"
        @click="closeNavbar"
      >
        <i class="fas fa-times"></i>
      </button>

      <div class="nav-links-wrapper">
        <ul class="nav-links">
          <li v-for="link in props.links" :key="link.text">
            <template v-if="link.component === 'NotificationBadge'">
              <router-link
                :to="link.to"
                :exact="link.exact"
                class="notification-link"
                :aria-label="link.text"
                @click="closeNavbar"
              >
                <NotificationBadge />
                <span class="menu-text">{{ link.text }}</span>
              </router-link>
            </template>

            <component
              :is="link.to ? 'router-link' : 'a'"
              v-else
              v-bind="
                link.to ? { to: link.to, exact: link.exact } : { href: link.href, target: '_blank' }
              "
              :aria-label="link.text"
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
        </ul>
      </div>
    </nav>
  </transition>

  <div v-if="isNavbarVisible" class="overlay" @click="closeNavbar"></div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useNavbarStore } from '@/store/navbar'
import NotificationBadge from '@/components/notification/NotificationBadge.vue'

const props = defineProps({
  links: Array
})

const navbarStore = useNavbarStore()
const { isNavbarVisible } = storeToRefs(navbarStore)
const { closeNavbar } = navbarStore
</script>

<style scoped>
/* Стили для мобильного меню и оверлея */
.mobile-navbar {
  position: fixed;
  top: 0;
  left: 0;
  width: min(280px, 76vw);
  height: 100vh;
  background: #171717;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 70px;
  z-index: calc(var(--z-sidebar) + 1);
  box-shadow: 18px 0 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.mobile-navbar__close {
  position: absolute;
  top: 14px;
  left: 18px;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-size: 25px;
  transition:
    background 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.mobile-navbar__close:active {
  transform: scale(0.96);
}

.mobile-navbar__close:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  border-color: color-mix(in srgb, var(--accent-color) 32%, rgba(255, 255, 255, 0.1));
  box-shadow: none;
}

.nav-links-wrapper {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
  height: calc(100vh - 70px);
}

.nav-links {
  list-style: none;
  padding: 0 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.nav-links li {
  width: 100%;
  position: relative;
}

.nav-links a,
.nav-links button {
  display: flex;
  align-items: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.86);
  text-decoration: none;
  padding: 12px 14px;
  transition: all 0.25s ease;
  min-width: 0;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border-radius: 8px;
}

.nav-links a i,
.nav-links a img {
  width: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.menu-text {
  width: auto;
  display: inline-block;
}

.nav-links a:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  transform: translateX(2px);
}

.nav-links a:active,
.nav-links a.router-link-active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.2));
  color: var(--accent-color, #6c5ce7);
}

.notification-link {
  display: flex;
  align-items: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: 12px 14px;
  transition: all 0.25s ease;
  min-width: 0;
  width: 100%;
  border-radius: 8px;
  box-sizing: border-box;
}

.notification-link:hover {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.15));
  color: var(--accent-color, #6c5ce7);
  transform: translateX(2px);
}

.notification-link:active,
.notification-link.router-link-active {
  background: var(--accent-transparent, rgba(108, 92, 231, 0.2));
  color: var(--accent-color, #6c5ce7);
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
  top: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.64);
  z-index: var(--z-sidebar);
}

.icon-donut {
  height: 25px;
  object-fit: contain;
  width: 25px;
}

.icon-user {
  height: 25px;
  width: 25px;
  object-fit: contain;
  border-radius: 50%;
}
</style>
