<template>
  <!-- Phones: five tabs at the bottom; settings and contacts live behind the profile page. -->
  <nav class="tab-bar" aria-label="Основное меню">
    <ul class="tab-list">
      <li v-for="link in tabs" :key="link.text">
        <button
          v-if="link.action === 'search'"
          type="button"
          class="tab"
          :class="{ 'is-active': navbarStore.isModalSearchVisible }"
          @click="openSearch"
        >
          <i :class="link.icon" aria-hidden="true"></i>
          <span class="tab-label">{{ link.text }}</span>
        </button>
        <router-link
          v-else
          :to="link.to"
          class="tab"
          :class="{ 'is-active': isActive(link) }"
          :aria-current="isActive(link) ? 'page' : undefined"
        >
          <img
            v-if="typeof link.icon === 'string' && link.icon.startsWith('http')"
            :src="link.icon"
            alt=""
            class="tab-avatar"
          />
          <i v-else :class="link.icon" aria-hidden="true"></i>
          <span class="tab-label">{{ link.text }}</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNavbarStore } from '@/store/navbar'

const props = defineProps({
  links: Array
})

const route = useRoute()
const navbarStore = useNavbarStore()

const tabs = computed(() => (props.links || []).filter((link) => link.group !== 'bottom'))

// Profile owns its sub-pages (settings, notifications, contacts) on phones.
const PROFILE_CHILDREN = ['/settings', '/notifications', '/contact']
const isActive = (link) => {
  if (!link.to) return false
  if (link.to === '/user' || link.to === '/login') {
    return route.path === link.to || PROFILE_CHILDREN.includes(route.path)
  }
  if (link.exact) return route.path === link.to
  return route.path === link.to || route.path.startsWith(`${link.to}/`)
}

const openSearch = () => navbarStore.openSearchModal()
</script>

<style scoped>
.tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-sidebar);
  box-sizing: border-box;
  height: var(--app-bottom-bar-height);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--hairline);
  background: #111;
}

body.theater-mode-active .tab-bar {
  display: none;
}

.tab-list {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  height: 56px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 0 2px;
  border: none;
  background: none;
  color: var(--text-dim);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tab i {
  font-size: 20px;
  line-height: 1;
}

.tab-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.tab-label {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab.is-active {
  color: var(--accent-text);
}

.tab:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -4px;
}
</style>
