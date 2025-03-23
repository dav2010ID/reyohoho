<template>
  <div class="settings-page">
    <header class="settings-header">
      <button class="back-button" @click="goBack">← Назад</button>
      <h1>Настройки</h1>
    </header>

    <div class="settings-container">
      <div class="settings-group">
        <h2>Фон</h2>
        <div class="radio-group">
          <label class="radio">
            <input v-model="backgroundType" type="radio" value="dynamic" />
            <span class="radio-label">Динамический фон</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" value="stars" />
            <span class="radio-label">Звездный фон</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" value="disabled" />
            <span class="radio-label">Отключить фон</span>
          </label>
        </div>
        <div class="settings-actions">
          <button class="reset-button" @click="resetBackground"><i class="fa-solid fa-arrow-rotate-left"></i> Сбросить
            фон</button>
        </div>
      </div>

      <div class="settings-group">
        <h2>Плеер</h2>
        <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>
        <SliderRound v-model="isCardBorder">Окантовка вокруг карточек</SliderRound>
      </div>

      <div class="settings-group">
        <h2>История</h2>
        <SliderRound v-model="isHistoryAllowed">
          Сохранять историю просмотра</SliderRound>
        <div class="settings-actions">
          <button class="reset-button" @click="showModal = true">
            <i class="fa-solid fa-trash-can"></i>
            Очистить историю просмотра
          </button>
          <BaseModal :is-open="showModal" message="Вы уверены, что хотите очистить историю?" @confirm="clearAllHistory"
            @close="showModal = false" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import SliderRound from '@/components/slider/SliderRound.vue'
import BaseModal from './BaseModal.vue'

const store = useStore()
const router = useRouter()
const showModal = ref(false)

const clearAllHistory = () => {
  store.dispatch('clearAllHistory')
  showModal.value = false
}

// Настройки фона (модуль background)
const backgroundType = computed({
  get: () => store.getters['background/getBackgroundType'],
  set: (value) => store.dispatch('background/updateBackgroundType', value)
})

// Вычисляемое свойство, определяющее, нужно ли отключать размытие
const isBlurDisabled = computed(() => backgroundType.value === 'stars' || backgroundType.value === 'disable')
watch(isBlurDisabled, (newValue) => {
  if (newValue) {
    // Отключаем размытие, если выбран звездный фон
    store.dispatch('background/toggleBlur', false)
  }
})

// Автоцентрирование плеера (из модуля player)
const isCentered = computed({
  get: () => store.getters['player/isCentered'],
  set: (value) => store.dispatch('player/updateCentering', value)
})

const isCardBorder = computed({
  get: () => store.getters['background/getCardBorder'],
  set: (value) => store.dispatch('background/toggleCardBorder', value)
})

const isHistoryAllowed = computed({
  get: () => store.getters['isHistoryAllowed'],
  set: (value) => store.dispatch('setHistoryAllowed', value)
})

// Навигация
const goBack = () => {
  router.go(-1)
}

const resetBackground = () => {
  store.dispatch('background/resetBackground')
}
</script>


<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: #fff;
  height: 100vh;
}

.settings-header {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 600px;
  justify-content: space-between;
  margin-bottom: 20px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-button {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.settings-container {
  background: #2a2a2a;
  padding: 20px;
  border-radius: 10px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 35px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

h2 {
  font-size: 16px;
  margin-bottom: 10px;
  margin: 0;
}

.radio {
  display: flex;
  align-items: center;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio input {
  margin-right: 10px;
}

.radio-label {
  cursor: pointer;
}

.reset-button {
  background: #d32f2f;
  border: none;
  padding: 10px 20px;
  color: #fff;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: 0.3s;
  display: flex;
  gap: 1rem;
  align-items: baseline;
}

.reset-button:hover {
  background: #b71c1c;
}
</style>
