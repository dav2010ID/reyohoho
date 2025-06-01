<template>
  <transition name="fade">
    <div v-if="isUpdating" class="pwa-updating-overlay">
      <div class="updating-content">
        <div class="updating-spinner">
          <div class="spinner-circle"></div>
          <div class="spinner-circle"></div>
          <div class="spinner-circle"></div>
        </div>
        <h3 class="updating-title">
          {{ updateError ? 'Ошибка обновления' : 'Обновление приложения' }}
        </h3>
        <p class="updating-text">
          {{ updateError || 'Загрузка новой версии...' }}
        </p>
        <div v-if="!updateError" class="updating-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${updateProgress}%` }"></div>
          </div>
          <div class="progress-text">{{ Math.round(updateProgress) }}%</div>
        </div>
        <div v-else class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { usePwaUpdate } from '@/composables/usePwaUpdate'

const { isUpdating, updateProgress, updateError } = usePwaUpdate()
</script>

<style scoped>
.pwa-updating-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(15px);
}

.updating-content {
  text-align: center;
  color: white;
  max-width: 350px;
  padding: 50px 30px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.updating-spinner {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 35px;
}

.spinner-circle {
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border-radius: 50%;
  animation: wave 1.4s ease-in-out infinite both;
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.5);
}

.spinner-circle:nth-child(1) {
  animation-delay: -0.32s;
}

.spinner-circle:nth-child(2) {
  animation-delay: -0.16s;
}

.updating-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 15px 0;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 10px rgba(108, 92, 231, 0.3);
}

.updating-text {
  font-size: 18px;
  opacity: 0.9;
  margin: 0 0 35px 0;
  line-height: 1.4;
}

.updating-progress {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-light));
  border-radius: 4px;
  transition: width 0.4s ease;
  box-shadow: 0 0 15px rgba(108, 92, 231, 0.6);
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

.progress-text {
  font-size: 16px;
  opacity: 0.9;
  font-weight: 600;
  color: var(--accent-light);
}

.error-icon {
  margin-top: 20px;
}

.error-icon i {
  font-size: 48px;
  color: #ff6b6b;
  animation: pulse 2s infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes wave {
  0%,
  40%,
  100% {
    transform: scaleY(0.4);
    opacity: 0.5;
  }
  20% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .updating-content {
    max-width: 300px;
    padding: 40px 25px;
  }

  .updating-title {
    font-size: 24px;
  }

  .updating-text {
    font-size: 16px;
  }

  .spinner-circle {
    width: 12px;
    height: 12px;
  }
}
</style>
