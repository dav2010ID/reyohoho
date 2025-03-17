<template>
  <div class="settings-page">
    <header class="settings-header">
      <button @click="goBack" class="back-button">← Назад</button>
      <h1>Настройки фона и плеера</h1>
    </header>

    <div class="settings-container">
      <!-- Настройки фона -->
      <div class="setting-group">
        <h2>Тип фона</h2>
        <label class="radio">
          <input type="radio" value="dynamic" v-model="backgroundType" />
          <span class="radio-label">Динамический фон</span>
        </label>
        <label class="radio">
          <input type="radio" value="stars" v-model="backgroundType" />
          <span class="radio-label">Звездный фон</span>
        </label>
        <label class="radio">
          <input type="radio" value="disabled" v-model="backgroundType" />
          <span class="radio-label">Отключить фон</span>
        </label>
      </div>
        
      <!-- Автоцентрирование плеера -->
      <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>

      <SliderRound v-model="isCardBorder">Окантовка вокруг карточек</SliderRound>

      <!-- Кнопка сброса фона -->
      <div class="settings-actions">
        <button @click="resetBackground" class="reset-button">Сбросить фон</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import SliderRound from '@/components/slider/SliderRound.vue'

const store = useStore()
const router = useRouter()

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
});

const isCardBorder = computed({
  get: () => store.getters['background/getCardBorder'],
  set: (value) => store.dispatch('background/toggleCardBorder', value)
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
  gap: 15px; 
}
.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
h2 {
  font-size: 16px;
  margin-bottom: 10px;
}
.radio {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.radio input {
  margin-right: 10px;
}
.radio-label {
  cursor: pointer;
}
.settings-actions {
  text-align: center;
  margin-top: 20px;
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
}
.reset-button:hover {
  background: #b71c1c;
}
</style>
