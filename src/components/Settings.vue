<template>
  <div class="settings-page">
    <h1>Настройки</h1>
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
            <input v-model="backgroundType" type="radio" value="lava-lamp" />
            <span class="radio-label">Лава-лампа</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" value="disabled" />
            <span class="radio-label">Отключить фон</span>
          </label>
        </div>
        <div class="settings-actions">
          <button class="reset-button" @click="resetBackground">
            <i class="fa-solid fa-arrow-rotate-left"></i> Сбросить фон
          </button>
        </div>
      </div>

      <div class="settings-group">
        <h2>Тема</h2>
        <ThemeSelector />
      </div>

      <div class="settings-group">
        <h2>Плеер</h2>
        <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>
        <SliderRound v-model="isCardBorder">Окантовка вокруг карточек</SliderRound>
        <SliderRound v-model="isCardHoverDisabled"
          >Отключить подъем карточек при наведении</SliderRound
        >
        <SliderRound v-model="showFavoriteTooltip"
          >Стиль отображения кнопок избранного:
          {{ showFavoriteTooltip ? 'Тултип' : 'Все кнопки' }}</SliderRound
        >
      </div>

      <div class="settings-group">
        <h2>Карточки</h2>
        <div class="card-size-group">
          <label>Размер карточек:</label>
          <div class="radio-group">
            <label class="radio">
              <input v-model="cardSize" type="radio" value="small" />
              <span class="radio-label">Маленький</span>
            </label>
            <label class="radio">
              <input v-model="cardSize" type="radio" value="medium" />
              <span class="radio-label">Средний</span>
            </label>
            <label class="radio">
              <input v-model="cardSize" type="radio" value="large" />
              <span class="radio-label">Большой</span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h2>Трейлеры</h2>
        <SliderRound v-model="areTrailersActive">Активировать трейлеры</SliderRound>
      </div>

      <div class="settings-group">
        <h2>История</h2>
        <SliderRound v-model="isHistoryAllowed"> Сохранять историю просмотра</SliderRound>
        <div class="settings-actions">
          <button class="reset-button" @click="showModal = true">
            <i class="fa-solid fa-trash-can"></i>
            Очистить историю просмотра
          </button>
          <BaseModal
            :is-open="showModal"
            message="Вы уверены, что хотите очистить историю?"
            @confirm="clearAllHistory"
            @close="showModal = false"
          />
        </div>
      </div>

      <div class="settings-group">
        <h2>Горячие клавиши</h2>
        <SliderRound v-model="isCtrlFEnabled">Перехватывать Ctrl+F для поиска</SliderRound>
      </div>

      <div class="settings-group">
        <h2>Комментарии</h2>
        <SliderRound v-model="isCommentsEnabled">Показывать блок комментариев</SliderRound>
        <SliderRound v-model="isAutoShowComments">Автоматически показывать комментарии</SliderRound>
      </div>

      <div class="settings-group">
        <h2>Режим стримера</h2>
        <SliderRound v-model="isStreamerMode"
          >Мигание кнопки таймингов для привлечения внимания</SliderRound
        >
      </div>

      <div class="settings-group">
        <h2>Версия сайта</h2>
        {{ appVersion }}
      </div>
    </div>
  </div>
</template>

<script setup>
import SliderRound from '@/components/slider/SliderRound.vue'
import ThemeSelector from '@/components/ThemeSelector.vue'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { useTrailerStore } from '@/store/trailer' // Импортируем store для трейлеров
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'

const mainStore = useMainStore()
const backgroundStore = useBackgroundStore()
const playerStore = usePlayerStore()
const trailerStore = useTrailerStore() // Инициализируем store для трейлеров
const showModal = ref(false)
const appVersion = ref(import.meta.env.VITE_APP_VERSION_FULL_VERSION)

const clearAllHistory = () => {
  mainStore.clearAllHistory()
  showModal.value = false
}

// Настройки фона (модуль background)
const backgroundType = computed({
  get: () => backgroundStore.backgroundType,
  set: (value) => backgroundStore.updateBackgroundType(value)
})

// Вычисляемое свойство, определяющее, нужно ли отключать размытие
const isBlurDisabled = computed(
  () => backgroundType.value === 'stars' || backgroundType.value === 'disable'
)
watch(isBlurDisabled, (newValue) => {
  if (newValue) {
    // Отключаем размытие, если выбран звездный фон
    backgroundStore.toggleBlur(false)
  }
})

// Автоцентрирование плеера (из модуля player)
const isCentered = computed({
  get: () => playerStore.isCentered,
  set: (value) => playerStore.updateCentering(value)
})

const isCardBorder = computed({
  get: () => backgroundStore.isCardBorder,
  set: (value) => backgroundStore.toggleCardBorder(value)
})

const isCardHoverDisabled = computed({
  get: () => backgroundStore.isCardHoverDisabled,
  set: (value) => backgroundStore.toggleCardHover(value)
})

const isHistoryAllowed = computed({
  get: () => mainStore.isHistoryAllowed,
  set: (value) => mainStore.setHistoryAllowed(value)
})

// Управление трейлерами (из модуля trailer)
const areTrailersActive = computed({
  get: () => trailerStore.areTrailersActive, // Получаем состояние из Pinia
  set: (value) => {
    if (value) {
      trailerStore.activateTrailers() // Включаем трейлеры
    } else {
      trailerStore.deactivateTrailers() // Выключаем трейлеры
    }
  }
})

const isCtrlFEnabled = computed({
  get: () => mainStore.isCtrlFEnabled,
  set: () => mainStore.toggleCtrlF()
})

const showFavoriteTooltip = computed({
  get: () => playerStore.showFavoriteTooltip,
  set: (value) => playerStore.setFavoriteTooltip(value)
})

const isCommentsEnabled = computed({
  get: () => mainStore.isCommentsEnabled,
  set: (value) => mainStore.setCommentsEnabled(value)
})

const isAutoShowComments = computed({
  get: () => mainStore.isAutoShowComments,
  set: (value) => mainStore.setAutoShowComments(value)
})

const cardSize = computed({
  get: () => mainStore.cardSize,
  set: (value) => mainStore.updateCardSize(value)
})

const isStreamerMode = computed({
  get: () => mainStore.isStreamerMode,
  set: (value) => mainStore.setStreamerMode(value)
})

const resetBackground = () => {
  backgroundStore.resetBackground()
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  color: #fff;
  min-height: 100vh;
}

h1 {
  text-align: center;
  margin-bottom: 2.5rem;
  color: #ffffff;
  font-size: 2rem;
  font-weight: 500;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--accent-transparent);
  background: rgba(255, 255, 255, 0.02);
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
  border: 1px solid var(--accent-transparent);
  display: flex;
  flex-direction: column;
  gap: 35px;
  margin-bottom: 40px;
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
  background: var(--accent-color);
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
  background: var(--accent-hover);
}

.radio input:checked {
  accent-color: var(--accent-color);
}

.card-size-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-size-group label:first-child {
  font-weight: 500;
  margin-bottom: 5px;
}
</style>
