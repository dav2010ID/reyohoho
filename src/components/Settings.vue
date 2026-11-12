<template>
  <!-- Section list on the left, one column of plain rows on the right; no boxes. -->
  <div class="settings-page">
    <h1>Настройки</h1>
    <div class="settings-layout">
      <nav class="settings-tabs" aria-label="Разделы настроек">
        <button
          v-for="tab in settingsTabs"
          :key="tab.id"
          type="button"
          :aria-current="activeSettingsTab === tab.id ? 'true' : undefined"
          :class="{ active: activeSettingsTab === tab.id }"
          @click="activeSettingsTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="settings-container">
        <section v-show="activeSettingsTab === 'appearance'" class="settings-section">
          <div class="settings-group">
            <h3 id="settings-background-label">Фон</h3>
            <div class="bg-tiles" role="radiogroup" aria-labelledby="settings-background-label">
              <label v-for="option in backgroundOptions" :key="option.value" class="bg-tile">
                <input
                  v-model="backgroundType"
                  type="radio"
                  name="background-type"
                  :value="option.value"
                  class="visually-hidden"
                />
                <span
                  class="bg-tile__preview"
                  :class="`bg-tile__preview--${option.value}`"
                  aria-hidden="true"
                ></span>
                <span class="bg-tile__label">{{ option.label }}</span>
              </label>
            </div>
          </div>
          <div class="settings-group">
            <h3>Тема</h3>
            <ThemeSelector />
          </div>
          <div class="settings-group">
            <h3>Карточки</h3>
            <div class="setting-row">
              <span id="settings-card-size-label" class="group-label">Размер карточек</span>
              <div class="segmented" role="radiogroup" aria-labelledby="settings-card-size-label">
                <label v-for="size in cardSizes" :key="size.value" class="segmented__option">
                  <input v-model="cardSize" type="radio" name="card-size" :value="size.value" />
                  <span>{{ size.label }}</span>
                </label>
              </div>
            </div>
            <SliderRound v-model="isCardBorder">Рамка вокруг постеров</SliderRound>
            <SliderRound v-model="isCardHoverEnabled">Подъём карточек при наведении</SliderRound>
          </div>
        </section>
        <section v-show="activeSettingsTab === 'player'" class="settings-section">
          <div class="settings-group">
            <h3>Плеер</h3>
            <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>
            <div class="setting-row">
              <span id="settings-favorites-label" class="group-label">Кнопки избранного</span>
              <div class="segmented" role="radiogroup" aria-labelledby="settings-favorites-label">
                <label class="segmented__option">
                  <input
                    v-model="showFavoriteTooltip"
                    type="radio"
                    name="favorites-style"
                    :value="true"
                  />
                  <span>Меню</span>
                </label>
                <label class="segmented__option">
                  <input
                    v-model="showFavoriteTooltip"
                    type="radio"
                    name="favorites-style"
                    :value="false"
                  />
                  <span>Все кнопки</span>
                </label>
              </div>
            </div>
          </div>
          <div class="settings-group">
            <h3>Трейлеры</h3>
            <SliderRound v-model="areTrailersActive">Показывать трейлеры</SliderRound>
          </div>
          <div v-if="backendAvailable" class="settings-group">
            <h3>Режим стримера</h3>
            <SliderRound v-model="isStreamerMode"
              >Мигание кнопки таймингов для привлечения внимания</SliderRound
            >
          </div>
        </section>
        <section v-show="activeSettingsTab === 'behavior'" class="settings-section">
          <div class="settings-group">
            <h3>История</h3>
            <SliderRound v-model="isHistoryAllowed"> Сохранять историю просмотра</SliderRound>
            <HistorySyncSettings />
            <div class="settings-actions settings-actions--danger">
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
          <div class="settings-group">
            <h3>Горячие клавиши</h3>
            <SliderRound v-model="isCtrlFEnabled">Перехватывать Ctrl+F для поиска</SliderRound>
          </div>
          <div class="settings-group settings-group--desktop-only">
            <h3>Боковая панель</h3>
            <SliderRound v-model="sidebarAutoHide"
              >Авто-скрытие: скрывать панель и показывать при наведении курсора</SliderRound
            >
            <div class="setting-row">
              <span id="settings-sidebar-position-label" class="group-label"
                >Расположение панели</span
              >
              <div
                class="segmented"
                role="radiogroup"
                aria-labelledby="settings-sidebar-position-label"
              >
                <label class="segmented__option">
                  <input
                    v-model="sidebarPosition"
                    type="radio"
                    name="sidebar-position"
                    value="left"
                  />
                  <span>Слева</span>
                </label>
                <label class="segmented__option">
                  <input
                    v-model="sidebarPosition"
                    type="radio"
                    name="sidebar-position"
                    value="right"
                  />
                  <span>Справа</span>
                </label>
              </div>
            </div>
          </div>
          <div v-if="backendAvailable" class="settings-group">
            <h3>Комментарии</h3>
            <SliderRound v-model="isCommentsEnabled">Показывать блок комментариев</SliderRound>
            <SliderRound v-model="isAutoShowComments"
              >Автоматически показывать комментарии</SliderRound
            >
          </div>
        </section>
        <section v-show="activeSettingsTab === 'api'" class="settings-section">
          <div class="settings-group">
            <h3>Источники данных</h3>
            <p v-if="unavailableSearch" class="api-note">
              Для поиска по ID {{ unavailableSearch }} нужен подключённый сервер. Вы также можете
              <router-link to="/">найти фильм по названию или ID Кинопоиска</router-link>.
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
            <p
              v-if="backendAvailable"
              class="api-note backend-status"
              :class="authorizationStatusClass"
            >
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
                <input
                  v-model="contentApiProvider"
                  type="radio"
                  name="content-api-provider"
                  value="local"
                />
                <span class="radio-label"
                  >Локальный сервер (поиск, информация о фильмах и плееры)</span
                >
              </label>
              <!-- KinoBD temporarily disabled; keep option for reactivation.
          <label class="radio">
            <input v-model="contentApiProvider" type="radio" name="content-api-provider" value="kinobd" />
            <span class="radio-label">KinoBD (search/cards/players)</span>
          </label>
          -->
              <label class="radio">
                <input
                  v-model="contentApiProvider"
                  type="radio"
                  name="content-api-provider"
                  value="kinobox"
                />
                <span class="radio-label"
                  >Kinobox (поиск, информация о фильмах и плееры, по умолчанию)</span
                >
              </label>
              <label class="radio">
                <input
                  v-model="contentApiProvider"
                  type="radio"
                  name="content-api-provider"
                  value="ddbb"
                />
                <span class="radio-label">DDBB (плееры)</span>
              </label>
              <label class="radio">
                <input
                  v-model="contentApiProvider"
                  type="radio"
                  name="content-api-provider"
                  value="ddbb_live"
                />
                <span class="radio-label">DDBB Live (плееры)</span>
              </label>
            </div>
            <p class="api-note">
              Комментарии, заметки, тайминги и поиск по IMDb доступны при подключённом сервере
              приложения. Для оценок и поиска по Shikimori можно также выбрать локальный источник
              контента.
            </p>
            <h4 id="settings-search-label" class="api-subtitle">Источник поиска</h4>
            <div class="radio-group" role="radiogroup" aria-labelledby="settings-search-label">
              <label class="radio">
                <input
                  v-model="searchApiProvider"
                  type="radio"
                  name="search-api-provider"
                  value="local"
                />
                <span class="radio-label">Локальный сервер</span>
              </label>
              <label class="radio">
                <input
                  v-model="searchApiProvider"
                  type="radio"
                  name="search-api-provider"
                  value="kinobox"
                />
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
        </section>
        <footer class="settings-footer">
          <span>Версия {{ appVersion }}</span>
          <span aria-hidden="true">·</span>
          <router-link to="/contact">Контакты</router-link>
        </footer>
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
watch(
  () => route.fullPath,
  () => {
    if (route.query.tab === 'api') activeSettingsTab.value = 'api'
  }
)
const backendAvailable = computed(legacyBackendAvailable)
const unavailableSearch = computed(() => {
  if (route.query.unavailable === 'shiki' && !legacyMovieMethodAvailable('getShikiInfo'))
    return 'Shikimori'
  if (route.query.unavailable === 'imdb' && !legacyMovieMethodAvailable('getKpIDfromIMDB'))
    return 'IMDb'
  return ''
})
const settingsTabs = [
  { id: 'appearance', label: 'Вид', description: 'Фон, тема и карточки' },
  { id: 'player', label: 'Плеер', description: 'Плеер, трейлеры и режим стримера' },
  { id: 'behavior', label: 'Поведение', description: 'История, навигация и комментарии' },
  { id: 'api', label: 'Источники', description: 'Данные, поиск и плееры' }
]
const backgroundOptions = [
  { value: 'disabled', label: 'Без фона' },
  { value: 'dynamic', label: 'Динамический' },
  { value: 'stars', label: 'Звёзды' },
  { value: 'lava-lamp', label: 'Лава-лампа' }
]
const cardSizes = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' }
]
const backendUrl = computed(() =>
  backendAvailable.value
    ? apiStore.backendMode === 'local'
      ? LOCAL_API_URL
      : import.meta.env.VITE_APP_API_URL
    : null
)

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

// The store keeps the negative flag; the switch reads positively.
const isCardHoverEnabled = computed({
  get: () => !backgroundStore.isCardHoverDisabled,
  set: (value) => backgroundStore.toggleCardHover(!value)
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

const resetKinoBdSources = () => {
  playerStore.clearKinoBdSources()
}
</script>

<style scoped>
.settings-page {
  box-sizing: border-box;
  max-width: 920px;
  min-height: 100vh;
  padding: var(--page-top) 24px 64px;
  color: #fff;
}

h1 {
  margin: 0 0 32px;
  color: #fff;
  font-size: var(--fs-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.settings-layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 640px);
  gap: 48px;
  align-items: start;
}

/* Section list: plain text rows, a 2px bar marks the current one. */
.settings-tabs {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-tabs button {
  position: relative;
  min-height: 44px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-s);
  background: none;
  color: var(--text-dim);
  font: inherit;
  font-size: var(--fs-m);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.settings-tabs button:hover {
  color: #fff;
}

.settings-tabs button.active {
  color: #fff;
  font-weight: 600;
}

.settings-tabs button.active::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 2px;
  border-radius: 1px;
  background: var(--accent-ui);
}

.settings-tabs button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.settings-container {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 40px;
}

/* Groups inside a section are separated by a hairline. */
.settings-group + .settings-group {
  padding-top: 40px;
  border-top: 1px solid var(--hairline);
}

h3 {
  margin: 0 0 8px;
  color: #fff;
  font-size: var(--fs-l);
  font-weight: 700;
}

/* Switch rows: label left, switch right, 52px tall. */
.settings-group :deep(.toggle) {
  flex-direction: row-reverse;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
}

.settings-group :deep(.label-text) {
  font-size: var(--fs-m);
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  min-height: 52px;
}

.group-label {
  font-size: var(--fs-m);
}

.segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-m);
  background: rgba(255, 255, 255, 0.06);
}

.segmented__option {
  position: relative;
  cursor: pointer;
}

.segmented__option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.segmented__option span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: var(--radius-s);
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-weight: 600;
}

.segmented__option input:checked + span {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.segmented__option input:focus-visible + span {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

/* Background previews. */
.bg-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.bg-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.bg-tile__preview {
  display: block;
  width: 96px;
  height: 60px;
  border-radius: var(--radius-m);
  box-shadow: inset 0 0 0 1px var(--hairline);
}

.bg-tile__preview--disabled {
  background: var(--bg-primary);
}

.bg-tile__preview--dynamic {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(135deg, #3a2f2a, #12161f);
}

.bg-tile__preview--stars {
  background:
    radial-gradient(1px 1px at 20% 30%, #fff, transparent),
    radial-gradient(1px 1px at 70% 20%, #fff, transparent),
    radial-gradient(1px 1px at 45% 70%, #fff, transparent),
    radial-gradient(1px 1px at 85% 65%, #fff, transparent),
    radial-gradient(1px 1px at 10% 80%, #fff, transparent), #05070d;
}

.bg-tile__preview--lava-lamp {
  background:
    radial-gradient(circle at 30% 70%, #7a2bd9 0 18%, transparent 19%),
    radial-gradient(circle at 70% 35%, #d92b6a 0 22%, transparent 23%), #120a1c;
}

.bg-tile__label {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.bg-tile input:checked ~ .bg-tile__preview {
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.6),
    0 0 0 2px var(--accent-ui);
}

.bg-tile input:checked ~ .bg-tile__label {
  color: #fff;
}

.bg-tile input:focus-visible ~ .bg-tile__preview {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.radio {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: 44px;
  cursor: pointer;
}

.radio-group {
  display: flex;
  flex-direction: column;
}

.radio input {
  margin-right: 12px;
  /* Dark native rendering: unchecked radios are dark rings, so the checked one stands out for every accent. */
  color-scheme: dark;
}

.radio input:checked {
  accent-color: var(--accent-ui);
}

.radio input:focus-visible {
  outline: 2px solid var(--accent-light);
  outline-offset: 2px;
}

.radio-label {
  font-size: var(--fs-m);
  cursor: pointer;
}

.settings-actions {
  margin-top: 12px;
}

/* Clearing history is destructive: it comes last, behind a hairline. */
.settings-actions--danger {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--hairline);
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font-size: var(--fs-m);
  text-align: left;
  cursor: pointer;
}

.reset-button:hover {
  background: rgba(255, 255, 255, 0.06);
}

.reset-button--danger {
  border-color: rgba(255, 139, 139, 0.6);
  color: #ff8b8b;
}

.reset-button--danger:hover {
  background: rgba(255, 139, 139, 0.1);
}

.reset-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.api-note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
  line-height: 1.45;
}

.api-subtitle {
  margin: 20px 0 4px;
  font-size: var(--fs-m);
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

.settings-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 24px;
  border-top: 1px solid var(--hairline);
  color: var(--text-faint);
  font-size: var(--fs-xs);
}

.settings-footer a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--text-dim);
}

.settings-footer a:hover {
  color: #fff;
}

@media (max-width: 599px) {
  .settings-group--desktop-only {
    display: none !important;
  }
}

@media (max-width: 760px) {
  .settings-page {
    padding: var(--page-top) 12px 40px;
  }

  h1 {
    margin-bottom: 16px;
    font-size: var(--fs-xl);
  }

  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }

  /* Phones: sections as one scrollable row of text tabs. */
  .settings-tabs {
    position: static;
    flex-direction: row;
    gap: 4px;
    margin: 0 -12px;
    padding: 0 12px;
    overflow-x: auto;
    border-bottom: 1px solid var(--hairline);
    scrollbar-width: none;
  }

  .settings-tabs button {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .settings-tabs button.active::before {
    top: auto;
    right: 12px;
    bottom: 0;
    left: 12px;
    width: auto;
    height: 2px;
  }
}
</style>
