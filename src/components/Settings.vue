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
        <h2>API сервер</h2>
        <p>После смены сервера обновите страницу</p>
        <div class="api-info">
          <div class="api-item">
            <strong>Текущий API:</strong>
            <span class="api-url">{{ currentApiInfo.url }}</span>
          </div>

          <div v-if="currentApiInfo.isCheckingHealth" class="api-item">
            <span class="checking-health">
              <i class="fas fa-spinner fa-spin"></i>
              Проверка доступности серверов...
            </span>
          </div>
          <div v-if="currentApiInfo.availableEndpoints.length > 1" class="api-item">
            <strong>Выбор сервера:</strong>
            <ul class="endpoints-list">
              <li class="server-item">
                <div
                  class="server-option"
                  :class="{
                    'selected-endpoint': !currentApiInfo.userSelectedApiUrl,
                    'current-endpoint': !currentApiInfo.userSelectedApiUrl && currentApiInfo.url
                  }"
                  @click="resetApiSelection"
                >
                  <div class="endpoint-info">
                    <span class="endpoint-description">Автоматический выбор</span>
                    <span class="endpoint-url">Система выберет лучший доступный сервер</span>
                  </div>
                  <i
                    v-if="!currentApiInfo.userSelectedApiUrl"
                    class="fas fa-check endpoint-active"
                  ></i>
                </div>
                <button
                  class="health-check-btn"
                  @click="checkAllEndpoints"
                  :disabled="healthCheckStates.checking_all"
                  title="Проверить все серверы"
                >
                  <i v-if="healthCheckStates.checking_all" class="fas fa-spinner fa-spin"></i>
                  <i v-else class="fas fa-heartbeat"></i>
                </button>
              </li>
              <li
                v-for="endpoint in currentApiInfo.availableEndpoints"
                :key="endpoint.url"
                class="server-item"
              >
                <div
                  class="server-option"
                  :class="{
                    'selected-endpoint': currentApiInfo.userSelectedApiUrl === endpoint.url,
                    'current-endpoint': endpoint.url === currentApiInfo.url
                  }"
                  @click="selectApi(endpoint.url)"
                >
                  <div class="endpoint-info">
                    <span class="endpoint-description">{{ endpoint.description }}</span>
                    <span class="endpoint-url">{{ endpoint.url }}</span>
                  </div>
                  <i
                    v-if="currentApiInfo.userSelectedApiUrl === endpoint.url"
                    class="fas fa-check endpoint-active"
                  ></i>
                </div>
                <button
                  class="health-check-btn"
                  :class="getHealthStatusClass(endpoint.url)"
                  @click="checkEndpointHealth(endpoint.url)"
                  :disabled="healthCheckStates[endpoint.url]?.checking"
                  :title="getHealthCheckTitle(endpoint.url)"
                >
                  <i
                    v-if="healthCheckStates[endpoint.url]?.checking"
                    class="fas fa-spinner fa-spin"
                  ></i>
                  <i
                    v-else-if="healthCheckStates[endpoint.url]?.status === 'healthy'"
                    class="fas fa-check"
                  ></i>
                  <i
                    v-else-if="healthCheckStates[endpoint.url]?.status === 'unhealthy'"
                    class="fas fa-times"
                  ></i>
                  <i v-else class="fas fa-heartbeat"></i>
                </button>
              </li>
            </ul>
          </div>
        </div>
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
import { useTrailerStore } from '@/store/trailer'
import { useApiStore } from '@/store/api'
import { computed, ref, watch, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { getCurrentApiInfo } from '@/api/axios'

const mainStore = useMainStore()
const backgroundStore = useBackgroundStore()
const playerStore = usePlayerStore()
const trailerStore = useTrailerStore()
const apiStore = useApiStore()
const showModal = ref(false)
const appVersion = ref(import.meta.env.VITE_APP_VERSION_FULL_VERSION)

const healthCheckStates = ref({
  checking_all: false
})

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

const currentApiInfo = ref({
  url: '',
  description: '',
  isCheckingHealth: false,
  lastCheckedAt: null,
  availableEndpoints: []
})

const updateApiInfo = () => {
  const info = getCurrentApiInfo()
  currentApiInfo.value = { ...info }
}

const selectApi = async (url) => {
  apiStore.setUserSelectedApiUrl(url)
  updateApiInfo()
}

const resetApiSelection = async () => {
  apiStore.resetUserSelection()
  const endpoints = apiStore.availableEndpoints
  if (endpoints.length > 0) {
    await apiStore.selectWorkingEndpoint(endpoints)
  }
  updateApiInfo()
}

const checkEndpointHealth = async (url) => {
  if (!healthCheckStates.value[url]) {
    healthCheckStates.value[url] = {}
  }

  healthCheckStates.value[url].checking = true
  healthCheckStates.value[url].status = null

  try {
    const isHealthy = await apiStore.checkEndpointHealth(url)
    healthCheckStates.value[url].status = isHealthy ? 'healthy' : 'unhealthy'
    healthCheckStates.value[url].lastChecked = Date.now()
  } catch (error) {
    healthCheckStates.value[url].status = 'unhealthy'
    console.error('Health check failed:', error)
  } finally {
    healthCheckStates.value[url].checking = false
  }
}

const checkAllEndpoints = async () => {
  healthCheckStates.value.checking_all = true

  const checkPromises = currentApiInfo.value.availableEndpoints.map((endpoint) =>
    checkEndpointHealth(endpoint.url)
  )

  await Promise.all(checkPromises)
  healthCheckStates.value.checking_all = false
}

const getHealthStatusClass = (url) => {
  const state = healthCheckStates.value[url]
  if (!state) return ''

  if (state.status === 'healthy') return 'health-success'
  if (state.status === 'unhealthy') return 'health-error'
  return ''
}

const getHealthCheckTitle = (url) => {
  const state = healthCheckStates.value[url]
  if (!state) return 'Проверить сервер'

  if (state.checking) return 'Проверка...'
  if (state.status === 'healthy') return 'Сервер доступен'
  if (state.status === 'unhealthy') return 'Сервер недоступен'
  return 'Проверить сервер'
}

onMounted(() => {
  updateApiInfo()

  const interval = setInterval(updateApiInfo, 1000)

  return () => {
    clearInterval(interval)
  }
})
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

.api-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.api-url {
  font-family: 'Courier New', monospace;
  color: var(--accent-color);
  font-size: 14px;
  word-break: break-all;
}

.api-description {
  color: #ccc;
}

.api-time {
  color: #aaa;
  font-size: 14px;
}

.checking-health {
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.endpoints-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.server-option {
  flex: 1;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.server-option:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.server-option.current-endpoint {
  border-color: var(--accent-color);
  background: rgba(76, 175, 80, 0.1);
}

.server-option.selected-endpoint {
  border-color: var(--accent-color);
  background: rgba(76, 175, 80, 0.15);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
}

.endpoint-description {
  font-weight: 500;
  color: #fff;
}

.endpoint-url {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #aaa;
  word-break: break-all;
}

.endpoint-active {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--accent-color);
}

.endpoint-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-check-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: 0.2s;
  padding: 8px;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.health-check-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: var(--accent-color);
}

.health-check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.health-check-btn.health-success {
  color: #4caf50;
}

.health-check-btn.health-error {
  color: #f44336;
}

.health-check-btn.health-success:hover {
  background: rgba(76, 175, 80, 0.1);
  border-color: #4caf50;
  color: #66bb6a;
}

.health-check-btn.health-error:hover {
  background: rgba(244, 67, 54, 0.1);
  border-color: #f44336;
  color: #ef5350;
}
</style>
