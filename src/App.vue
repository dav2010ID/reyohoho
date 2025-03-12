<template>
  <BackgroundSpace />
  <MenuNavigation />
  <div class="router-view-container">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>

<script setup>
import BackgroundSpace from '@/components/BackgroundSpace.vue'
import MenuNavigation from '@/components/MenuNavigation.vue'
</script>

<style>
@import '@/assets/main.css';

#app {
  position: relative;
  z-index: 1;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}


</style>
