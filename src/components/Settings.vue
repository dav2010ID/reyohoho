<template>
  <div class="settings-page">
    <h1>Настройки</h1>
    <div class="settings-container">
      <nav class="settings-tabs" aria-label="Разделы настроек">
        <button
          v-for="tab in settingsTabs"
          :key="tab.id"
          type="button"
          :aria-current="activeSettingsTab === tab.id ? 'true' : undefined"
          :class="{ active: activeSettingsTab === tab.id }"
          @click="activeSettingsTab = tab.id"
        >
          <span class="settings-tab__label">{{ tab.label }}</span>
          <span class="settings-tab__description">{{ tab.description }}</span>
        </button>
      </nav>

      <header class="settings-section-header">
        <p>Раздел настроек</p>
        <h2>{{ activeSettingsSection.label }}</h2>
        <span>{{ activeSettingsSection.description }}</span>
      </header>

      <div v-show="activeSettingsTab === 'appearance'" class="settings-group">
        <h3 id="settings-background-label">Фон</h3>
        <div class="radio-group" role="radiogroup" aria-labelledby="settings-background-label">
          <label class="radio">
            <input v-model="backgroundType" type="radio" name="background-type" value="dynamic" />
            <span class="radio-label">Динамический фон</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" name="background-type" value="stars" />
            <span class="radio-label">Звездный фон</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" name="background-type" value="lava-lamp" />
            <span class="radio-label">Лава-лампа</span>
          </label>
          <label class="radio">
            <input v-model="backgroundType" type="radio" name="background-type" value="disabled" />
            <span class="radio-label">Отключить фон</span>
          </label>
        </div>
        <div class="settings-actions">
          <button class="reset-button" @click="resetBackground">
            <i class="fa-solid fa-arrow-rotate-left"></i> Сбросить фон
          </button>
        </div>
      </div>

      <div v-show="activeSettingsTab === 'appearance'" class="settings-group">
        <h3>Тема</h3>
        <ThemeSelector />
      </div>

      <div v-show="activeSettingsTab === 'player'" class="settings-group">
        <h3>Плеер</h3>
        <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>
        <SliderRound v-model="showFavoriteTooltip"
          >Стиль отображения кнопок избранного:
          {{ showFavoriteTooltip ? 'Всплывающее меню' : 'Все кнопки' }}</SliderRound
        >
      </div>

      <div v-show="activeSettingsTab === 'appearance'" class="settings-group">
        <h3>Карточки</h3>
        <div class="card-size-group">
          <span id="settings-card-size-label" class="group-label">Размер карточек:</span>
          <div class="radio-group" role="radiogroup" aria-labelledby="settings-card-size-label">
            <label class="radio">
              <input v-model="cardSize" type="radio" name="card-size" value="small" />
              <span class="radio-label">Маленький</span>
            </label>
            <label class="radio">
              <input v-model="cardSize" type="radio" name="card-size" value="medium" />
              <span class="radio-label">Средний</span>
            </label>
            <label class="radio">
              <input v-model="cardSize" type="radio" name="card-size" value="large" />
              <span class="radio-label">Большой</span>
            </label>
          </div>
        </div>
        <SliderRound v-model="isCardBorder">Окантовка вокруг карточек</SliderRound>
        <SliderRound v-model="isCardHoverDisabled"
          >Отключить подъем карточек при наведении</SliderRound
        >
      </div>

      <div v-show="activeSettingsTab === 'player'" class="settings-group">
        <h3>Трейлеры</h3>
        <SliderRound v-model="areTrailersActive">Активировать трейлеры</SliderRound>
      </div>

      <div v-show="activeSettingsTab === 'api'" class="settings-group">
        <h3>Источники данных</h3>
        <p v-if="unavailableSearch" class="api-note">
          Для поиска по ID {{ unavailableSearch }} нужен подключённый сервер.
          Вы также можете <router-link to="/">найти фильм по названию или ID Кинопоиска</router-link>.
        </p>
        <h4 id="settings-backend-label" class="api-subtitle">Сервер приложения</h4>
        <div class="radio-group" role="radiogroup" aria-labelledby="settings-backend-label">
          <label class="radio">
            <input v-model="backendMode" type="radio" name="backend-mode" value="auto" />
            <span class="radio-label">Автоматический выбор сервера</span>
          </label>
          <label class="radio">
            <input v-model="backendMode" type="radio" name="backend-mode" value="local" />
            <span class="radio-label">Локальный сервер (для самостоятельной настройки)</span>
          </label>
        </div>
        <p class="api-note backend-status" :class="backendStatusClass">
          {{ backendStatusText }}<template v-if="backendUrl"> · {{ backendUrl }}</template>
        </p>
        <p v-if="backendAvailable" class="api-note backend-status" :class="authorizationStatusClass">
          {{ authorizationStatusText }}
        </p>
        <div class="settings-actions">
          <button
            type="button"
            class="reset-button"
            :disabled="!backendAvailable || apiStore.isCheckingHealth"
            @click="checkSelectedBackend"
          >
            <i class="fa-solid fa-rotate"></i>
            {{ apiStore.isCheckingHealth ? 'Проверка…' : 'Проверить соединение' }}
          </button>
        </div>
        <h4 id="settings-content-label" class="api-subtitle">Источники контента</h4>
        <div class="radio-group" role="radiogroup" aria-labelledby="settings-content-label">
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="local" />
            <span class="radio-label">Локальный сервер (поиск, информация о фильмах и плееры)</span>
          </label>
          <!-- KinoBD temporarily disabled; keep option for reactivation.
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="kinobd" />
            <span class="radio-label">KinoBD (search/cards/players)</span>
          </label>
          -->
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="kinobox" />
            <span class="radio-label"
              >Kinobox (поиск, информация о фильмах и плееры, по умолчанию)</span
            >
          </label>
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="ddbb" />
            <span class="radio-label">DDBB (плееры)</span>
          </label>
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="ddbb_live" />
            <span class="radio-label">DDBB Live (плееры)</span>
          </label>
        </div>
        <p class="api-note">
          Комментарии, заметки, тайминги и поиск по IMDb доступны при подключённом сервере приложения.
          Для оценок и поиска по Shikimori можно также выбрать локальный источник контента.
        </p>
        <h4 id="settings-search-label" class="api-subtitle">Источник поиска</h4>
        <div class="radio-group" role="radiogroup" aria-labelledby="settings-search-label">
          <label class="radio">
            <input v-model="searchApiProvider" type="radio" name="search-api-provider" value="local" />
            <span class="radio-label">Локальный сервер</span>
          </label>
          <label class="radio">
            <input v-model="searchApiProvider" type="radio" name="search-api-provider" value="kinobox" />
            <span class="radio-label">Kinobox (по умолчанию)</span>
          </label>
          <!-- KinoBD temporarily disabled; keep option for reactivation.
          <label class="radio">
            <input v-model="searchApiProvider" type="radio" name="search-api-provider" value="kinobd" />
            <span class="radio-label">KinoBD</span>
          </label>
          -->
        </div>
        <p class="api-note">Этот параметр влияет только на поиск по названию.</p>
        <div class="settings-actions">
          <button class="reset-button" @click="resetKinoBdSources">
            <i class="fa-solid fa-arrow-rotate-left"></i>
            Сбросить выбранные источники KinoBD
          </button>
        </div>
      </div>

      <div v-show="activeSettingsTab === 'behavior'" class="settings-group">
        <h3>История</h3>
        <SliderRound v-model="isHistoryAllowed"> Сохранять историю просмотра</SliderRound>
        <HistorySyncSettings />
        <div class="settings-actions">
          <button class="reset-button reset-button--danger" @click="showModal = true">
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

      <div v-show="activeSettingsTab === 'behavior'" class="settings-group">
        <h3>Горячие клавиши</h3>
        <SliderRound v-model="isCtrlFEnabled">Перехватывать Ctrl+F для поиска</SliderRound>
      </div>

      <div v-show="activeSettingsTab === 'behavior'" class="settings-group settings-group--desktop-only">
        <h3>Боковая панель</h3>
        <SliderRound v-model="sidebarAutoHide"
          >Авто-скрытие: скрывать панель и показывать при наведении курсора</SliderRound
        >
        <div class="sidebar-position-group">
          <span id="settings-sidebar-position-label" class="group-label">Расположение панели:</span>
          <div class="radio-group" role="radiogroup" aria-labelledby="settings-sidebar-position-label">
            <label class="radio">
              <input v-model="sidebarPosition" type="radio" name="sidebar-position" value="left" />
              <span class="radio-label">Слева</span>
            </label>
            <label class="radio">
              <input v-model="sidebarPosition" type="radio" name="sidebar-position" value="right" />
              <span class="radio-label">Справа</span>
            </label>
          </div>
        </div>
      </div>

      <div v-if="backendAvailable" v-show="activeSettingsTab === 'behavior'" class="settings-group">
        <h3>Комментарии</h3>
        <SliderRound v-model="isCommentsEnabled">Показывать блок комментариев</SliderRound>
        <SliderRound v-model="isAutoShowComments">Автоматически показывать комментарии</SliderRound>
      </div>

      <div v-if="backendAvailable" v-show="activeSettingsTab === 'player'" class="settings-group">
        <h3>Режим стримера</h3>
        <SliderRound v-model="isStreamerMode"
          >Мигание кнопки таймингов для привлечения внимания</SliderRound
        >
      </div>

      <div v-show="activeSettingsTab === 'about'" class="settings-group">
        <h3>Версия сайта</h3>
        {{ appVersion }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useConfirmation } from '@/composables/useConfirmation'
import SliderRound from '@/components/slider/SliderRound.vue'
import HistorySyncSettings from '@/components/HistorySyncSettings.vue'
import ThemeSelector from '@/components/ThemeSelector.vue'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { useTrailerStore } from '@/store/trailer'
import { LOCAL_API_URL, useApiStore } from '@/store/api'
import { legacyBackendAvailable } from '@/api/backendConfig'
import { legacyMovieMethodAvailable } from '@/api/movieCapabilities'
import { useAuthStore } from '@/store/auth'
import { getApiAuthorizationState } from '@/utils/apiTrust'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseModal from './BaseModal.vue'
import { historyRequest, isCloudHistoryEnabled } from '@/api/cloudHistory'

const askConfirmation = useConfirmation()

const mainStore = useMainStore()
const backgroundStore = useBackgroundStore()
const playerStore = usePlayerStore()
const trailerStore = useTrailerStore()
const apiStore = useApiStore()
const authStore = useAuthStore()
const showModal = ref(false)
const appVersion = ref(import.meta.env.VITE_APP_VERSION_FULL_VERSION)
const route = useRoute()
const activeSettingsTab = ref(route.query.tab === 'api' ? 'api' : 'appearance')
watch(() => route.fullPath, () => {
  if (route.query.tab === 'api') activeSettingsTab.value = 'api'
})
const backendAvailable = computed(legacyBackendAvailable)
const unavailableSearch = computed(() => {
  if (route.query.unavailable === 'shiki' && !legacyMovieMethodAvailable('getShikiInfo')) return 'Shikimori'
  if (route.query.unavailable === 'imdb' && !legacyMovieMethodAvailable('getKpIDfromIMDB')) return 'IMDb'
  return ''
})
const settingsTabs = [
  { id: 'appearance', label: 'Вид', description: 'Фон, тема и карточки' },
  { id: 'player', label: 'Плеер', description: 'Плеер, трейлеры и режим стримера' },
  { id: 'behavior', label: 'Поведение', description: 'История, навигация и комментарии' },
  { id: 'api', label: 'Источники', description: 'Данные, поиск и плееры' },
  { id: 'about', label: 'О сайте', description: 'Версия приложения' }
]
const activeSettingsSection = computed(
  () => settingsTabs.find((tab) => tab.id === activeSettingsTab.value) || settingsTabs[0]
)
const backendUrl = computed(() => backendAvailable.value
  ? (apiStore.backendMode === 'local' ? LOCAL_API_URL : import.meta.env.VITE_APP_API_URL)
  : null)

const backendMode = computed({
  get: () => apiStore.backendMode,
  set: (value) => void apiStore.setBackendMode(value)
})

const backendStatusText = computed(() => {
  if (apiStore.isCheckingHealth) return 'Проверяется'
  if (!backendAvailable.value) return 'Сервер приложения не настроен'
  if (apiStore.backendMode !== 'local') return 'Автоматический выбор активен'
  if (apiStore.localApiHealthy === true) return 'Локальный сервер доступен'
  if (apiStore.localApiHealthy === false) return 'Локальный сервер недоступен'
  return 'Локальный сервер ещё не проверен'
})

const backendStatusClass = computed(() => ({
  'backend-status--ok': apiStore.backendMode === 'local' && apiStore.localApiHealthy === true,
  'backend-status--error': apiStore.backendMode === 'local' && apiStore.localApiHealthy === false
}))

const authorizationStatus = computed(() =>
  getApiAuthorizationState({
    baseURL: backendUrl.value,
    hasToken: Boolean(authStore.token)
  })
)

const authorizationStatusText = computed(
  () =>
    ({
      anonymous: 'Вы не вошли в аккаунт',
      allowed: 'Выбранному серверу разрешено получать данные входа',
      blocked: 'Данные входа не передаются: выбранный сервер не входит в список доверенных'
    })[authorizationStatus.value]
)

const authorizationStatusClass = computed(() => ({
  'backend-status--ok': authorizationStatus.value === 'allowed',
  'backend-status--error': authorizationStatus.value === 'blocked'
}))

const checkSelectedBackend = () => apiStore.recheckSelectedEndpoint()

const clearAllHistory = async () => {
  if (isCloudHistoryEnabled()) {
    try {
      await historyRequest('', 'DELETE')
    } catch (error) {
      await askConfirmation(error.message)
      return
    }
  }
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
  () => backgroundType.value === 'stars' || backgroundType.value === 'disabled'
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

const contentApiProvider = computed({
  get: () => mainStore.contentApiProvider,
  set: (value) => mainStore.setContentApiProvider(value)
})

const searchApiProvider = computed({
  get: () => mainStore.searchApiProvider,
  set: (value) => mainStore.setSearchApiProvider(value)
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

const sidebarAutoHide = computed({
  get: () => mainStore.sidebarAutoHide,
  set: (value) => mainStore.setSidebarAutoHide(value)
})

const sidebarPosition = computed({
  get: () => mainStore.sidebarPosition,
  set: (value) => mainStore.setSidebarPosition(value)
})

const resetBackground = () => {
  backgroundStore.resetBackground()
}

const resetKinoBdSources = () => {
  playerStore.clearKinoBdSources()
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
  max-width: 860px;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-transparent);
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 40px;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 8px;
  padding: 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-tabs button {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 68px;
  padding: 10px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: left;
}

.settings-tabs button.active {
  background: var(--accent-solid);
  color: var(--accent-contrast);
}

.settings-tabs button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.settings-tab__label,
.settings-tab__description {
  display: block;
}

.settings-tab__description {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.25;
}

.settings-tabs button.active .settings-tab__description {
  color: var(--accent-contrast);
}

.settings-section-header {
  padding: 4px 2px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-section-header p,
.settings-section-header span {
  margin: 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
}

.settings-section-header h2 {
  margin: 4px 0;
  color: #fff;
  font-size: 22px;
  font-weight: 600;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

h3 {
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
  /* Dark native rendering: unchecked radios are dark rings, so the checked one stands out for every accent. */
  color-scheme: dark;
}

.radio input:focus-visible {
  outline: 2px solid var(--accent-light);
  outline-offset: 2px;
}

.radio-label {
  cursor: pointer;
}

/* Switch labels use the same size as the radio options next to them. */
.settings-group :deep(.label-text) {
  font-size: 1rem;
}

/* Touch: every radio row is a full 44px target and rows touch, so there is no dead gap. */
@media (max-width: 768px), (pointer: coarse) {
  .radio {
    box-sizing: border-box;
    min-height: 44px;
    padding: 6px 0;
    cursor: pointer;
  }

  div.radio-group {
    gap: 0;
  }
}

.reset-button {
  /* Secondary action: same outline as the history actions; solid fill stays for primary actions. */
  background: transparent;
  border: 1px solid var(--accent-ui);
  min-height: 44px;
  padding: 10px 16px;
  color: #fff;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.3s;
  display: flex;
  gap: 1rem;
  align-items: center;
  text-align: left;
}

.reset-button:hover {
  background: var(--accent-transparent);
}

.reset-button--danger {
  background: transparent;
  border: 1px solid #ff8b8b;
  color: #ff8b8b;
}

.reset-button--danger:hover {
  background: rgba(255, 139, 139, 0.14);
}

.reset-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.radio input:checked {
  accent-color: var(--accent-ui);
}

.card-size-group,
.sidebar-position-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-size-group > label:first-child,
.sidebar-position-group > label:first-child {
  font-weight: 500;
  margin-bottom: 5px;
}

.api-note {
  margin: 0;
  opacity: 0.85;
  font-size: 13px;
  line-height: 1.35;
}

.api-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.backend-status {
  overflow-wrap: anywhere;
}

.backend-status--ok {
  color: #78d69c;
}

.backend-status--error {
  color: #ff8b8b;
}

@media (max-width: 599px) {
  .settings-group--desktop-only {
    display: none !important;
  }
}

@media (max-width: 640px) {
  .settings-container {
    padding: 14px;
  }

  .settings-tabs {
    grid-template-columns: repeat(2, 1fr);
  }

  .settings-tabs button {
    min-height: 44px;
  }

  .settings-tabs button:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .settings-tab__description {
    display: none;
  }
}
</style>
