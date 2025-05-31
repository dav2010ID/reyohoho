<template>
  <div class="toggle-wrapper">
    <button class="toggle" @click="toggle">
      <i
        :class="['fas', navbarStore.isNavbarVisible ? 'fa-times' : 'fa-bars', { animate: animate }]"
      ></i>
    </button>
    <div v-if="unreadCount > 0" class="mobile-badge">
      {{ displayCount }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useNavbarStore } from '@/store/navbar'
import { useNotificationsStore } from '@/store/notifications'

const navbarStore = useNavbarStore()
const notificationsStore = useNotificationsStore()
const animate = ref(false)

const unreadCount = computed(() => notificationsStore.unreadCount)

const displayCount = computed(() => {
  if (unreadCount.value > 99) return '99+'
  return unreadCount.value
})

function toggle() {
  // Запускаем анимацию перед переключением иконки
  animate.value = true
  // Используем небольшой timeout для анимации (например, 150 мс)
  setTimeout(() => {
    navbarStore.toggleNavbar()
    // Сбрасываем флаг анимации
    animate.value = false
  }, 150)
}
</script>

<style scoped>
.toggle-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 30px;
  margin: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  transition: transform 0.3s ease;
  z-index: 6;
  color: #fff;
}

.mobile-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  background: #4caf50;
  color: white;
  font-size: 8px;
  font-weight: 600;
  padding: 2px;
  border-radius: 50%;
  min-width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: bounce-in 0.5s ease;
}

/* Базовая анимация для иконки */
.toggle i {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

/* При добавлении класса .animate можно задать эффект, например, увеличение или небольшое вращение */
.animate {
  transform: scale(1.2);
  opacity: 0.7;
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}
</style>
