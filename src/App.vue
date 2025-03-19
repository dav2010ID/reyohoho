<template>
  <BackgroundSpace />
  <MenuNavigation />
  <div class="router-view-container">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>

  <!-- Затемняющий оверлей для обычного режима, включается тумблером -->
  <div v-if="dimmingEnabled" class="dimming-overlay" @click="toggleDimming"></div>
</template>

<script setup>
import BackgroundSpace from '@/components/BackgroundSpace.vue'
import MenuNavigation from '@/components/MenuNavigation.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

// Реактивное состояние для ширины окна
const updateIsMobile = () => {
  store.commit('setIsMobile', window.innerWidth < 600)
}

onMounted(() => {
  window.addEventListener('resize', updateIsMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

const dimmingEnabled = computed(() => store.state.dimmingEnabled)
const toggleDimming = () => {
  store.commit('toggleDimming')
}
</script>

<style>
@import '@/assets/main.css';

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
</style>
