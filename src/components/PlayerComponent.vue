<template>
  <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

  <template v-else>
    <PlayerSelectorBar
      :selected-label="selectedPlayerLabel"
      :show-source-button="showSourceButton"
      @open-player-modal="openPlayerModal"
      @open-source-modal="openSourceModal"
    />
    <!-- Модальное окно выбора плеера -->
    <PlayerModal
      v-if="showPlayerModal"
      :players="playersInternal"
      :selected-player="selectedPlayerInternal"
      @close="closePlayerModal"
      @select="handlePlayerSelect"
    />

    <PlayerSourceModal
      v-if="showSourceModal"
      :candidates="sourceCandidates"
      :loading="sourceLoading"
      :error="sourceError"
      @close="closeSourceModal"
      @select="applySourceCandidate"
    />

    <!-- Единый контейнер плеера -->
    <div
      ref="containerRef"
      :class="['player-container', { 'theater-mode': theaterMode }]"
      :style="!theaterMode ? containerStyle : {}"
    >
      <div class="iframe-wrapper" :style="!theaterMode ? iframeWrapperStyle : {}">
        <iframe
          v-show="!iframeLoading && selectedPlayerInternal?.iframe"
          ref="playerIframe"
          :src="selectedPlayerInternal?.iframe"
          :title="movieInfo?.title ? `Плеер для ${movieInfo.title}` : 'Видео-плеер'"
          frameborder="0"
          allowfullscreen
          webkitallowfullscreen
          class="responsive-iframe"
          :class="{
            'theater-mode-unlock': closeButtonVisible,
            'theater-mode-lock': theaterMode,
            dimmed: dimmingEnabled
          }"
          @load="onIframeLoad"
          @error="onIframeError"
        ></iframe>
        <SpinnerLoading
          v-if="iframeLoading && !playersEmptyMessage"
          class="player-loading-spinner"
          :text="`Загружается плеер: ${selectedPlayerInternal ? getProviderDisplayName(selectedPlayerInternal) : 'Загружается список плееров'}\nЕсли плеер не грузится, то смените плеер выше или включите VPN`"
        />
        <div v-else-if="playersEmptyMessage" class="player-empty-state">
          <p>{{ playersEmptyMessage }}</p>
          <button v-if="showSourceButton" type="button" @click="openSourceModal">
            Выбрать источник
          </button>
        </div>
      </div>

      <!-- Кнопка закрытия в театральном режиме -->
      <button
        v-show="theaterMode"
        class="close-theater-btn"
        :class="{ visible: closeButtonVisible, hiding: theaterMode && !closeButtonVisible && closeButtonWasVisible }"
        aria-label="Выйти из театрального режима"
        @click="toggleTheaterMode"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Кнопки управления -->
    <div v-if="!theaterMode" class="controls">
      <div class="main-controls">
        <div
          v-if="!isMobile && kp_id"
          ref="tooltipContainer"
          class="tooltip-container list-buttons-container"
          data-tooltip-container="favorite"
        >
          <button
            v-if="showFavoriteTooltip"
            class="favorite-btn"
            :class="{ active: movieInfo?.lists?.isFavorite }"
            aria-label="Управление списками"
            @mouseenter="showTooltip('favorite')"
            @mouseleave="tryHideTooltip"
            @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isFavorite ? 'favorite' : 'favorite_border'
            }}</span>
            <span class="material-icons dropdown-arrow" :class="{ highlighted: isInAnyList }"
              >expand_more</span
            >
          </button>
          <div
            v-show="activeTooltip === 'favorite' && showFavoriteTooltip"
            ref="tooltip"
            class="custom-tooltip advanced-tooltip list-buttons-dropdown"
            data-tooltip="favorite"
            @mouseenter="keepTooltipVisible"
            @mouseleave="hideTooltip"
          >
            <div class="list-button-item">
              <button
                class="favorite-btn"
                :class="{ active: movieInfo?.lists?.isFavorite }"
                @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
              >
                <span class="material-icons">{{
                  movieInfo?.lists?.isFavorite ? 'favorite' : 'favorite_border'
                }}</span>
                <span class="button-label">В избранное</span>
              </button>
            </div>
            <div class="list-button-item">
              <button
                class="watching-btn"
                :class="{ active: movieInfo?.lists?.isWatching }"
                @click="toggleList(USER_LIST_TYPES_ENUM.WATCHING)"
              >
                <span class="material-icons">{{
                  movieInfo?.lists?.isWatching ? 'visibility' : 'visibility_off'
                }}</span>
                <span class="button-label">Смотрю</span>
              </button>
            </div>
            <div class="list-button-item">
              <button
                class="later-btn"
                :class="{ active: movieInfo?.lists?.isLater }"
                @click="toggleList(USER_LIST_TYPES_ENUM.LATER)"
              >
                <span class="material-icons">watch_later</span>
                <span class="button-label">Смотреть позже</span>
              </button>
            </div>
            <div class="list-button-item">
              <button
                class="completed-btn"
                :class="{ active: movieInfo?.lists?.isCompleted }"
                @click="toggleList(USER_LIST_TYPES_ENUM.COMPLETED)"
              >
                <span class="material-icons">{{
                  movieInfo?.lists?.isCompleted ? 'check_circle' : 'check_circle_outline'
                }}</span>
                <span class="button-label">Просмотрено</span>
              </button>
            </div>
            <div class="list-button-item">
              <button
                class="abandoned-btn"
                :class="{ active: movieInfo?.lists?.isAbandoned }"
                @click="toggleList(USER_LIST_TYPES_ENUM.ABANDONED)"
              >
                <span class="material-icons">{{ movieInfo?.lists?.isAbandoned ? 'cancel' : 'not_interested' }}</span>
                <span class="button-label">Брошено</span>
              </button>
            </div>
            <div class="tooltip-hint">
              <span class="material-icons">settings</span>
              <span
                >Стиль отображения можно изменить в
                <a class="settings-link" @click="openSettings">настройках</a></span
              >
            </div>
          </div>
        </div>

        <template v-if="!isMobile">
          <div class="tooltip-container" data-tooltip-container="dimming">
            <button
              class="dimming-btn"
              :class="{ active: dimmingEnabled }"
              :aria-label="dimmingEnabled ? 'Отключить затемнение' : 'Включить затемнение'"
              @mouseenter="showTooltip('dimming')"
              @mouseleave="activeTooltip = null"
              @click="toggleDimming"
            >
              <span class="material-icons">{{ dimmingEnabled ? 'light_mode' : 'dark_mode' }}</span>
            </button>
            <div v-show="activeTooltip === 'dimming'" class="custom-tooltip" data-tooltip="dimming">
              {{ dimmingEnabled ? 'Отключить затемнение' : 'Включить затемнение' }}
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="blur">
            <button
              class="blur-btn"
              :class="{ 'electron-only': !isElectron }"
              aria-label="Блюр"
              @mouseenter="showTooltip('blur')"
              @mouseleave="activeTooltip = null"
              @click="toggleBlur"
            >
              <span class="material-icons">blur_on</span>
            </button>
            <div v-show="activeTooltip === 'blur'" class="custom-tooltip" data-tooltip="blur">
              {{ isElectron ? 'Блюр' : 'Блюр, функция доступна в приложении' }}
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="compressor">
            <button
              class="material-symbols-outlined"
              :class="{ active: compressorEnabled, 'electron-only': !isElectron }"
              aria-label="Компрессор"
              @mouseenter="showTooltip('compressor')"
              @mouseleave="activeTooltip = null"
              @click="toggleCompressor"
            >
              <span class="material-icons">graphic_eq</span>
            </button>
            <div
              v-show="activeTooltip === 'compressor'"
              class="custom-tooltip"
              data-tooltip="compressor"
            >
              {{ isElectron ? 'Компрессор' : 'Компрессор, функция доступна в приложении' }}
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="mirror">
            <button
              class="mirror-btn"
              :class="{ active: mirrorEnabled, 'electron-only': !isElectron }"
              aria-label="Зеркало"
              @mouseenter="showTooltip('mirror')"
              @mouseleave="activeTooltip = null"
              @click="toggleMirror"
            >
              <span class="material-icons">flip</span>
            </button>
            <div v-show="activeTooltip === 'mirror'" class="custom-tooltip" data-tooltip="mirror">
              {{ isElectron ? 'Зеркало' : 'Зеркало, функция доступна в приложении' }}
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="theater">
            <button
              class="theater-mode-btn"
              :aria-label="theaterMode ? 'Выйти из театрального режима' : 'Театральный режим'"
              @mouseenter="showTooltip('theater')"
              @mouseleave="activeTooltip = null"
              @click="toggleTheaterMode"
            >
              <span class="material-symbols-outlined">{{
                theaterMode ? 'fullscreen_exit' : 'aspect_ratio'
              }}</span>
            </button>
            <div v-show="activeTooltip === 'theater'" class="custom-tooltip" data-tooltip="theater">
              {{ theaterMode ? 'Выйти из театрального режима' : 'Театральный режим' }}
              <span class="shortcut-hint">Alt+T</span>
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="pip">
            <button
              class="pip-btn"
              :class="{ 'electron-only': !isElectron }"
              aria-label="Картинка в картинке"
              @mouseenter="showTooltip('pip')"
              @mouseleave="activeTooltip = null"
              @click="togglePiP"
            >
              <span class="material-icons">picture_in_picture_alt</span>
            </button>
            <div v-show="activeTooltip === 'pip'" class="custom-tooltip" data-tooltip="pip">
              {{
                isElectron
                  ? 'Картинка в картинке'
                  : 'Картинка в картинке, функция доступна в приложении'
              }}
            </div>
          </div>

          <div class="tooltip-container" data-tooltip-container="aspect_ratio">
            <button
              class="aspect-ratio-dropdown-btn"
              aria-label="Изменить соотношение сторон"
              @mouseenter="showTooltip('aspect_ratio')"
              @mouseleave="tryHideTooltip"
              @click="cycleAspectRatio"
            >
              <span class="current-ratio">{{ aspectRatio }}</span>
            </button>
            <div
              v-show="activeTooltip === 'aspect_ratio'"
              class="custom-tooltip advanced-tooltip aspect-ratio-dropdown"
              data-tooltip="aspect_ratio"
              @mouseenter="keepTooltipVisible"
              @mouseleave="hideTooltip"
            >
              <div
                v-for="ratio in aspectRatios"
                :key="ratio"
                class="aspect-ratio-option"
                :class="{ active: aspectRatio === ratio }"
                @click="setAspectRatio(ratio)"
              >
                {{ ratio }}
              </div>
            </div>
          </div>

          <!-- Кнопка центрирования с SliderRound в подсказке -->
          <div
            class="tooltip-container"
            data-tooltip-container="centering"
            @mouseenter="showTooltip('centering')"
            @mouseleave="tryHideTooltip"
          >
            <button class="center-btn" aria-label="Отцентрировать плеер" @click="centerPlayer">
              <span class="material-icons">center_focus_strong</span>
            </button>
            <div
              v-show="activeTooltip === 'centering'"
              class="custom-tooltip advanced-tooltip"
              data-tooltip="centering"
              @mouseenter="keepTooltipVisible"
              @mouseleave="hideTooltip"
            >
              Отцентрировать плеер
              <SliderRound v-model="isCentered" title="Автоцентрирование плеера" />
              <span class="tooltip-title">Автоцентрирование плеера</span>
            </div>
          </div>

          <!-- Кнопка для открытия в приложении -->
          <div
            v-if="!isElectron && kp_id"
            class="tooltip-container"
            data-tooltip-container="app_link"
          >
            <button
              class="app-link-btn"
              aria-label="Открыть в приложении"
              @mouseenter="showTooltip('app_link')"
              @mouseleave="activeTooltip = null"
              @click="openAppLink"
            >
              <span class="material-icons">open_in_new</span>
            </button>
            <div
              v-show="activeTooltip === 'app_link'"
              class="custom-tooltip"
              data-tooltip="app_link"
            >
              Открыть в приложении
            </div>
          </div>

          <!-- Кнопка для копирования ссылки на фильм (только в Electron) -->
          <div v-if="isElectron" class="tooltip-container" data-tooltip-container="copy_link">
            <button
              class="copy-link-btn"
              aria-label="Скопировать ссылку"
              @mouseenter="showTooltip('copy_link')"
              @mouseleave="activeTooltip = null"
              @click="copyMovieLink"
            >
              <span class="material-icons">content_copy</span>
            </button>
            <div
              v-show="activeTooltip === 'copy_link'"
              class="custom-tooltip"
              data-tooltip="copy_link"
            >
              Скопировать ссылку
            </div>
          </div>

          <div v-if="isElectron" class="tooltip-container" data-tooltip-container="overlay">
            <button
              class="overlay-btn"
              :class="{ active: videoOverlayEnabled2 }"
              :aria-label="videoOverlayEnabled2 ? 'Скрыть оверлей видео' : 'Показать оверлей видео'"
              @mouseenter="showTooltip('overlay')"
              @mouseleave="activeTooltip = null"
              @click="toggleVideoOverlay"
            >
              <span class="material-icons">{{
                videoOverlayEnabled2 ? 'layers' : 'layers_clear'
              }}</span>
            </button>
            <div v-show="activeTooltip === 'overlay'" class="custom-tooltip" data-tooltip="overlay">
              {{ videoOverlayEnabled2 ? 'Скрыть оверлей видео' : 'Показать оверлей видео' }}
            </div>
          </div>
        </template>

        <template v-else>
          <button
            v-if="kp_id"
            class="mobile-control-btn favorite-btn"
            :class="{ active: isInAnyList }"
            type="button"
            aria-label="Добавить в список"
            @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isFavorite ? 'bookmark_added' : 'bookmark_add'
            }}</span>
          </button>

          <button
            class="mobile-control-btn theater-mode-btn"
            type="button"
            aria-label="Театральный режим"
            @click="toggleTheaterMode"
          >
            <span class="material-symbols-outlined">aspect_ratio</span>
          </button>

          <button
            class="mobile-control-btn dimming-btn"
            :class="{ active: dimmingEnabled }"
            type="button"
            aria-label="Затемнение"
            @click="toggleDimming"
          >
            <span class="material-icons">{{ dimmingEnabled ? 'light_mode' : 'dark_mode' }}</span>
          </button>

          <button
            class="mobile-control-btn aspect-ratio-dropdown-btn"
            type="button"
            aria-label="Изменить соотношение сторон"
            @click="cycleAspectRatio"
          >
            <span class="current-ratio">{{ aspectRatio }}</span>
          </button>
        </template>
      </div>

      <div v-if="!isMobile && !showFavoriteTooltip && kp_id" class="desktop-list-buttons">
        <div class="tooltip-container">
          <button
            class="favorite-btn"
            :class="{ active: movieInfo?.lists?.isFavorite }"
            @mouseenter="showTooltip('favorite')"
            @mouseleave="activeTooltip = null"
            @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isFavorite ? 'favorite' : 'favorite_border'
            }}</span>
          </button>
          <div v-show="activeTooltip === 'favorite'" class="custom-tooltip">
            {{ 'В избранное' }}
          </div>
        </div>

        <div class="tooltip-container">
          <button
            class="watching-btn"
            :class="{ active: movieInfo?.lists?.isWatching }"
            @mouseenter="showTooltip('watching')"
            @mouseleave="activeTooltip = null"
            @click="toggleList(USER_LIST_TYPES_ENUM.WATCHING)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isWatching ? 'visibility' : 'visibility_off'
            }}</span>
          </button>
          <div v-show="activeTooltip === 'watching'" class="custom-tooltip">
            {{ 'Смотрю' }}
          </div>
        </div>

        <div class="tooltip-container">
          <button
            class="later-btn"
            :class="{ active: movieInfo?.lists?.isLater }"
            @mouseenter="showTooltip('later')"
            @mouseleave="activeTooltip = null"
            @click="toggleList(USER_LIST_TYPES_ENUM.LATER)"
          >
            <span class="material-icons">watch_later</span>
          </button>
          <div v-show="activeTooltip === 'later'" class="custom-tooltip">
            {{ 'Смотреть позже' }}
          </div>
        </div>

        <div class="tooltip-container">
          <button
            class="completed-btn"
            :class="{ active: movieInfo?.lists?.isCompleted }"
            @mouseenter="showTooltip('completed')"
            @mouseleave="activeTooltip = null"
            @click="toggleList(USER_LIST_TYPES_ENUM.COMPLETED)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isCompleted ? 'check_circle' : 'check_circle_outline'
            }}</span>
          </button>
          <div v-show="activeTooltip === 'completed'" class="custom-tooltip">
            {{ 'Просмотрено' }}
          </div>
        </div>

        <div class="tooltip-container">
          <button
            class="abandoned-btn"
            :class="{ active: movieInfo?.lists?.isAbandoned }"
            @mouseenter="showTooltip('abandoned')"
            @mouseleave="activeTooltip = null"
            @click="toggleList(USER_LIST_TYPES_ENUM.ABANDONED)"
          >
            <span class="material-icons">{{
              movieInfo?.lists?.isAbandoned ? 'not_interested' : 'not_interested'
            }}</span>
          </button>
          <div v-show="activeTooltip === 'abandoned'" class="custom-tooltip">
            {{ 'Брошено' }}
          </div>
        </div>
      </div>
    </div>

    <Notification ref="notificationRef" />
  </template>
</template>

<script setup>
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import SliderRound from '@/components/slider/SliderRound.vue'
import { usePlayerElectronControls } from '@/composables/usePlayerElectronControls'
import { usePlayerLayout } from '@/composables/usePlayerLayout'
import { usePlayerLists } from '@/composables/usePlayerLists'
import { usePlayerSharing } from '@/composables/usePlayerSharing'
import { usePlayerSources } from '@/composables/usePlayerSources'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { useAuthStore } from '@/store/auth'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlayerModal from '@/components/PlayerModal.vue'
import PlayerSelectorBar from '@/components/player/PlayerSelectorBar.vue'
import { parseTimingTextToSeconds, formatSecondsToTime } from '@/utils/dateUtils'
import { OBSWebSocket } from '@/utils/obsWebSocket'
import { debugLog } from '@/utils/logger'
import { getProviderDisplayName } from '@/utils/playerUtils'
import { trackAnalyticsEvent } from '@/utils/analytics'
import {
  applyOverlayButtonHoverStyle,
  applyOverlayProgressBackgroundStyle,
  applyOverlayTimingsBackgroundStyle,
  applyOverlayTitleBackgroundStyle,
  applyOverlayVisibilityStyle,
  applySettingsButtonHoverStyle,
  getControlsContainerStyle,
  getDurationProgressMarkup,
  getMainInfoStyle,
  getMovieTitleStyle,
  getObsStatusMarkup,
  getOverlayBaseStyle,
  getOverlayButtonStyle,
  getOverlayPositionStyle,
  getOverlaySettingsMarkup,
  getSettingsModalContentStyle,
  getSettingsModalStyle,
  getTimingChipStyle,
  getTimingsListStyle,
  getTimingsContentStyle,
  getTimingsPanelStyle,
  getVideoProgressStyle
} from '@/utils/playerOverlayStyles'

const PlayerSourceModal = defineAsyncComponent(() => import('@/components/player/PlayerSourceModal.vue'))

const mainStore = useMainStore()
const playerStore = usePlayerStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const kp_id = ref(route.params.kp_id)

const props = defineProps({
  kpId: String,
  movieInfo: {
    type: Object,
    default: () => ({})
  }
})
const emit = defineEmits(['update:selectedPlayer', 'update:movieInfo'])

const iframeLoading = ref(true)
const playerIframe = ref(null)
const containerRef = ref(null)
const PLAYER_IFRAME_LOAD_TIMEOUT_MS = 20000
let iframeLoadStartedAt = 0
let iframeLoadTimeout = null

const isMobile = computed(() => mainStore.isMobile)
const isElectron = computed(() => !!window.electronAPI)

const {
  theaterMode,
  closeButtonVisible,
  closeButtonWasVisible,
  aspectRatio,
  isCentered,
  dimmingEnabled,
  containerStyle,
  iframeWrapperStyle,
  aspectRatios,
  updateScaleFactor,
  centerPlayer,
  toggleTheaterMode,
  toggleDimming,
  setAspectRatio,
  cycleAspectRatio,
  cleanupPlayerLayout
} = usePlayerLayout({
  mainStore,
  playerStore,
  containerRef,
  playerIframe
})

const {
  playersInternal,
  selectedPlayerInternal,
  showPlayerModal,
  showSourceModal,
  sourceCandidates,
  sourceLoading,
  sourceError,
  errorMessage,
  errorCode,
  playersEmptyMessage,
  showSourceButton,
  selectedPlayerLabel,
  fetchPlayers,
  openPlayerModal,
  closePlayerModal,
  openSourceModal,
  closeSourceModal,
  applySourceCandidate,
  normalizePlayerKey
} = usePlayerSources({
  props,
  getProviderDisplayName,
  onSelectedPlayerChange: (player) => emit('update:selectedPlayer', player)
})

const activeTooltip = ref(null)
const tooltipHovered = ref(false)
let hideTimeout = null

const notificationRef = ref(null)
const { copyMovieLink } = usePlayerSharing({
  notificationRef
})

const tooltipContainer = ref(null)
const tooltip = ref(null)
const videoPositionInterval = ref(null)
const overlayTimingsCheckInterval = ref(null)
const lastOverlayTimingsCount = ref(0)

const {
  compressorEnabled,
  mirrorEnabled,
  enableBlur,
  disableBlur,
  toggleBlur,
  toggleCompressor,
  toggleMirror,
  startMirrorMonitoring,
  openAppLink,
  togglePiP,
  resetElectronPlaybackState,
  cleanupElectronControls
} = usePlayerElectronControls({
  isElectron,
  playerStore,
  playerIframe,
  kpId: kp_id
})

const videoOverlayEnabled2 = computed({
  get: () => playerStore.videoOverlayEnabled2,
  set: (value) => playerStore.updateVideoOverlay(value)
})

const overlaySettings = computed({
  get: () => playerStore.overlaySettings,
  set: (value) => playerStore.updateOverlaySettings(value)
})
const currentVideoTime = ref(0)
const totalVideoDuration = ref(0)
const activeTimingTexts = ref([])
const hasActiveTimings = ref(false)
let hideTimingsTimeout = null

const currentOverlayElement = ref(null)
const overlayControlsTimeout = ref(null)
const overlayCreationInProgress = ref(false)

// OBS WebSocket
const obsWebSocket = ref(null)
const obsConnected = ref(false)
const obsSources = ref([])
const obsFiltersFound = ref([])

const obsSettings = computed({
  get: () => playerStore.obsSettings,
  set: (value) => playerStore.updateObsSettings(value)
})

const updateTooltipPosition = (tooltipName) => {
  const container = document.querySelector(`[data-tooltip-container="${tooltipName}"]`)
  const tooltip = document.querySelector(`[data-tooltip="${tooltipName}"]`)
  if (!container || !tooltip) return

  const containerRect = container.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportHeight = window.innerHeight

  if (containerRect.bottom + tooltipRect.height > viewportHeight) {
    tooltip.style.top = 'auto'
    tooltip.style.bottom = '100%'
    tooltip.style.marginTop = '0'
    tooltip.style.marginBottom = '12px'
    tooltip.style.transform = 'translateX(-50%)'
  } else {
    tooltip.style.top = '100%'
    tooltip.style.bottom = 'auto'
    tooltip.style.marginTop = '12px'
    tooltip.style.marginBottom = '0'
    tooltip.style.transform = 'translateX(-50%)'
  }
}

const showTooltip = (tooltipName) => {
  activeTooltip.value = tooltipName
  tooltipHovered.value = false
  clearTimeout(hideTimeout)
  nextTick(() => {
    updateTooltipPosition(tooltipName)
  })
}

const tryHideTooltip = () => {
  if (!tooltipHovered.value) {
    hideTimeout = setTimeout(() => {
      activeTooltip.value = null
    }, 300)
  }
}

const keepTooltipVisible = () => {
  tooltipHovered.value = true
  clearTimeout(hideTimeout)
}

const hideTooltip = () => {
  tooltipHovered.value = false
  activeTooltip.value = null
}

const isInAnyList = computed(() => {
  return (
    props.movieInfo?.lists?.isFavorite ||
    props.movieInfo?.lists?.isWatching ||
    props.movieInfo?.lists?.isLater ||
    props.movieInfo?.lists?.isCompleted ||
    props.movieInfo?.lists?.isAbandoned
  )
})

const startVideoPositionMonitoring = (isDebug = false) => {
  if (!isElectron.value) return

  if (videoPositionInterval.value) {
    clearInterval(videoPositionInterval.value)
  }

  let blurApplied = false
  let blurIntervals = []

  function updateBlurIntervals() {
    blurIntervals = []
    if (
      window.selectedNudityTimings &&
      Array.isArray(window.selectedNudityTimings) &&
      props.movieInfo?.nudity_timings
    ) {
      for (const timing of props.movieInfo.nudity_timings) {
        if (window.selectedNudityTimings.includes(timing.id)) {
          const parsedRanges = parseTimingTextToSeconds(timing.timing_text)
          if (parsedRanges && parsedRanges.length > 0) {
            blurIntervals.push(...parsedRanges)
          }
        }
      }
    }
  }

  updateBlurIntervals()

  videoPositionInterval.value = setInterval(() => {
    if (!playerIframe.value) return

    updateBlurIntervals()

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      if (videos.length > 0) {
        const video = videos[0]

        currentVideoTime.value = video.currentTime || 0
        totalVideoDuration.value = video.duration || 0

        if (
          isElectron.value &&
          videoOverlayEnabled2.value &&
          !currentOverlayElement.value &&
          !overlayCreationInProgress.value
        ) {
          const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
          if (timeSinceLoad >= 100) {
            try {
              createVideoOverlay(iframeDoc, video)
            } catch (error) {
              debugLog('Error creating overlay:', error)
              overlayCreationInProgress.value = false
            }
          }
        }

        if (isElectron.value && !videoOverlayEnabled2.value && currentOverlayElement.value) {
          setTimeout(() => {
            if (!videoOverlayEnabled2.value && currentOverlayElement.value) {
              removeVideoOverlay()
            }
          }, 100)
        }

        if (isElectron.value && props.movieInfo?.nudity_timings) {
          const currentTime = video.currentTime
          const selectedTimings = []
          const activeTimingIds = []

          if (
            window.overlayNudityTimings &&
            Array.isArray(window.overlayNudityTimings) &&
            window.overlayNudityTimings.length > 0
          ) {
            for (const timing of props.movieInfo.nudity_timings) {
              if (window.overlayNudityTimings.includes(timing.id)) {
                const parsedRanges = parseTimingTextToSeconds(timing.timing_text)

                if (parsedRanges && parsedRanges.length > 0) {
                  const intervals = []

                  for (const [start, end] of parsedRanges) {
                    let status = 'normal'
                    if (currentTime >= start && currentTime <= end) {
                      status = 'active'
                      activeTimingIds.push(timing.id)
                    } else if (start > currentTime && start - currentTime <= 5) {
                      status = 'upcoming'
                    }

                    intervals.push({
                      text: `[${formatSecondsToTime(start)}-${formatSecondsToTime(end)}]`,
                      status: status
                    })
                  }

                  selectedTimings.push({
                    id: timing.id,
                    intervals: intervals
                  })
                }
              }
            }
          }

          activeTimingTexts.value = selectedTimings
          hasActiveTimings.value =
            activeTimingIds.length > 0 ||
            selectedTimings.some((timing) =>
              timing.intervals.some((interval) => interval.status === 'upcoming')
            )
        }

        if (isElectron.value && currentOverlayElement.value && videoOverlayEnabled2.value) {
          updateVideoOverlay()
        }

        if (!video.paused) {
          const currentTime = video.currentTime
          const duration = video.duration
          const progress = duration > 0 ? (currentTime / duration) * 100 : 0

          if (isDebug) {
            debugLog(
              `Video position: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s (${progress.toFixed(1)}%)`
            )

            if (blurIntervals.length > 0) {
              const activeIntervals = blurIntervals
                .map(
                  ([start, end]) => `${formatSecondsToTime(start)} - ${formatSecondsToTime(end)}`
                )
                .join(', ')
              debugLog(`Active blur intervals: [${activeIntervals}]`)
            }
          }

          let shouldBlur = false
          for (const [start, end] of blurIntervals) {
            if (currentTime >= start && currentTime <= end) {
              shouldBlur = true
              break
            }
          }

          // Use OBS blur if enabled and connected, otherwise use internal blur
          if (
            obsSettings.value.enabled &&
            obsConnected.value &&
            obsSettings.value.selectedFilterId
          ) {
            // OBS blur logic
            if (shouldBlur && !blurApplied) {
              obsWebSocket.value?.enableBlur(obsSettings.value.selectedFilterId)
              blurApplied = true
              debugLog('OBS Blur applied at', currentTime.toFixed(2), 'seconds')
            } else if (!shouldBlur && blurApplied) {
              obsWebSocket.value?.disableBlur(obsSettings.value.selectedFilterId)
              blurApplied = false
              debugLog('OBS Blur removed at', currentTime.toFixed(2), 'seconds')
            }
          } else if (shouldBlur && !blurApplied && isElectron.value) {
            // Internal blur logic
            enableBlur()
            blurApplied = true
            debugLog('Blur applied at', currentTime.toFixed(2), 'seconds')
          } else if (!shouldBlur && blurApplied && !obsSettings.value.enabled) {
            disableBlur()
            blurApplied = false
            debugLog('Blur removed at', currentTime.toFixed(2), 'seconds')
          }
        }
      }
    } catch (error) {
      debugLog('Error monitoring video position:', error)
    }
  }, 100)
}

const getPlayerAnalyticsPayload = () => ({
  kp_id: kp_id.value,
  player_key: selectedPlayerInternal.value?.key || '',
  player_name: selectedPlayerInternal.value
    ? getProviderDisplayName(selectedPlayerInternal.value)
    : '',
  source: mainStore.contentApiProvider
})

const clearIframeLoadTimeout = () => {
  if (!iframeLoadTimeout) return
  clearTimeout(iframeLoadTimeout)
  iframeLoadTimeout = null
}

const scheduleIframeLoadTimeout = () => {
  clearIframeLoadTimeout()

  const iframe = selectedPlayerInternal.value?.iframe
  if (!iframe) return

  iframeLoadStartedAt = Date.now()
  iframeLoadTimeout = setTimeout(() => {
    if (!iframeLoading.value || selectedPlayerInternal.value?.iframe !== iframe) return

    const payload = {
      ...getPlayerAnalyticsPayload(),
      status: 'timeout',
      duration_ms: Date.now() - iframeLoadStartedAt,
      timeout_ms: PLAYER_IFRAME_LOAD_TIMEOUT_MS
    }

    iframeLoadTimeout = null
    trackAnalyticsEvent('player_iframe_load', payload)
    trackAnalyticsEvent('player_iframe_timeout', payload)
  }, PLAYER_IFRAME_LOAD_TIMEOUT_MS)
}

const onIframeLoad = () => {
  iframeLoading.value = false
  clearIframeLoadTimeout()
  trackAnalyticsEvent('player_iframe_load', {
    ...getPlayerAnalyticsPayload(),
    status: 'success',
    duration_ms: iframeLoadStartedAt ? Date.now() - iframeLoadStartedAt : 0
  })
  window.iframeLoadTime = Date.now()
  startMirrorMonitoring()
  startVideoPositionMonitoring()

  if (isElectron.value && videoOverlayEnabled2.value && !currentOverlayElement.value) {
    setTimeout(() => {
      try {
        const iframe = playerIframe.value
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        if (iframeDoc) {
          const video = iframeDoc.querySelector('video')
          if (video) {
            createVideoOverlay(iframeDoc, video)
          }
        }
      } catch (error) {
        debugLog('Error creating overlay on iframe load:', error)
        overlayCreationInProgress.value = false
      }
    }, 100)
  }
}

const onIframeError = () => {
  iframeLoading.value = false
  clearIframeLoadTimeout()

  const payload = {
    ...getPlayerAnalyticsPayload(),
    status: 'error',
    duration_ms: iframeLoadStartedAt ? Date.now() - iframeLoadStartedAt : 0
  }

  trackAnalyticsEvent('player_iframe_load', payload)
  trackAnalyticsEvent('player_iframe_error', payload)
}

const handlePlayerSelect = (player) => {
  if (selectedPlayerInternal.value?.key === player.key) {
    closePlayerModal()
    return
  }

  selectedPlayerInternal.value = player
  iframeLoading.value = true
  resetElectronPlaybackState()
  if (currentOverlayElement.value) {
    removeVideoOverlay()
  }
  if (videoPositionInterval.value) {
    clearInterval(videoPositionInterval.value)
    videoPositionInterval.value = null
  }
  if (!player.key.toLowerCase().includes('torrents')) {
    playerStore.updatePreferredPlayer(normalizePlayerKey(player.key))
  }
  // Note: emit('update:selectedPlayer') is handled by the watcher on selectedPlayerInternal
  closePlayerModal()
}

watch(selectedPlayerInternal, (newVal) => {
  if (newVal) {
    iframeLoading.value = true
    scheduleIframeLoadTimeout()
    resetElectronPlaybackState()
    if (currentOverlayElement.value) {
      removeVideoOverlay()
    }
    if (videoPositionInterval.value) {
      clearInterval(videoPositionInterval.value)
      videoPositionInterval.value = null
    }
    if (!newVal.key.toLowerCase().includes('torrents')) {
      playerStore.updatePreferredPlayer(normalizePlayerKey(newVal.key))
    }
    emit('update:selectedPlayer', newVal)
  } else {
    clearIframeLoadTimeout()
  }
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      kp_id.value = newKpId
      iframeLoading.value = true
      selectedPlayerInternal.value = null
      resetElectronPlaybackState()
      if (currentOverlayElement.value) {
        removeVideoOverlay()
      }
      if (videoPositionInterval.value) {
        clearInterval(videoPositionInterval.value)
        videoPositionInterval.value = null
      }
      lastOverlayTimingsCount.value = 0
      await fetchPlayers()
      if (isCentered.value) centerPlayer()
    }
  },
  { immediate: true }
)

watch(
  () => mainStore.contentApiProvider,
  async (newProvider, oldProvider) => {
    if (!newProvider || newProvider === oldProvider) return

    iframeLoading.value = true
    selectedPlayerInternal.value = null
    playerStore.clearPreferredPlayer()
    resetElectronPlaybackState()
    if (currentOverlayElement.value) {
      removeVideoOverlay()
    }
    if (videoPositionInterval.value) {
      clearInterval(videoPositionInterval.value)
      videoPositionInterval.value = null
    }
    lastOverlayTimingsCount.value = 0
    await fetchPlayers()
  }
)

watch(videoOverlayEnabled2, (enabled) => {
  if (!isElectron.value) return

  if (enabled && !currentOverlayElement.value) {
    const checkAndCreate = () => {
      if (playerIframe.value) {
        try {
          const iframe = playerIframe.value
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
          if (iframeDoc) {
            const video = iframeDoc.querySelector('video')
            if (video) {
              const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
              if (timeSinceLoad >= 100) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(checkAndCreate, 100 - timeSinceLoad)
              }
            }
          }
        } catch (error) {
          debugLog('Error creating overlay via watcher:', error)
          overlayCreationInProgress.value = false
        }
      }
    }
    checkAndCreate()
  } else if (!enabled && currentOverlayElement.value) {
    removeVideoOverlay()
  }
})

watch(
  activeTimingTexts,
  (newTimings, oldTimings) => {
    if (!isElectron.value) return

    const hadTimings = oldTimings && oldTimings.length > 0
    const hasTimings = newTimings && newTimings.length > 0

    if (!hadTimings && hasTimings) {
      if (!videoOverlayEnabled2.value) {
        videoOverlayEnabled2.value = true
        if (window.electronAPI) {
          window.electronAPI.showToast('Оверлей автоматически включён - добавлены тайминги')
        }
      }
    }
  },
  { deep: true }
)

watch(
  () => obsSettings.value.enabled,
  (enabled) => {
    if (enabled && !obsConnected.value) {
      connectToOBS()
    } else if (!enabled && obsConnected.value) {
      disconnectFromOBS()
    }
  }
)

watch(
  overlaySettings,
  (newSettings, oldSettings) => {
    if (!isElectron.value || !videoOverlayEnabled2.value) return

    if (oldSettings && newSettings.showBackground !== oldSettings.showBackground) {
      if (currentOverlayElement.value) {
        removeVideoOverlay()

        setTimeout(() => {
          if (playerIframe.value && videoOverlayEnabled2.value) {
            try {
              const iframe = playerIframe.value
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
              if (iframeDoc) {
                const video = iframeDoc.querySelector('video')
                if (video) {
                  createVideoOverlay(iframeDoc, video)
                }
              }
            } catch (error) {
              debugLog('Error recreating overlay:', error)
            }
          }
        }, 100)
      }
    } else if (currentOverlayElement.value) {
      updateVideoOverlay()
    }
  },
  { deep: true }
)

const openLogin = () => {
  router.push('/login')
}

const { toggleList } = usePlayerLists({
  authStore,
  emit,
  kpId: kp_id,
  movieInfo: computed(() => props.movieInfo),
  notificationRef,
  openLogin
})

const showFavoriteTooltip = computed(() => playerStore.showFavoriteTooltip)

const openSettings = () => {
  router.push('/settings')
  hideTooltip()
}

const toggleVideoOverlay = () => {
  videoOverlayEnabled2.value = !videoOverlayEnabled2.value

  if (!videoOverlayEnabled2.value) {
    removeVideoOverlay()
  } else {
    const createOverlayAfterDelay = () => {
      if (!currentOverlayElement.value && playerIframe.value) {
        try {
          const iframe = playerIframe.value
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
          if (iframeDoc) {
            const video = iframeDoc.querySelector('video')
            if (video) {
              const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
              if (timeSinceLoad >= 100) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(createOverlayAfterDelay, 100 - timeSinceLoad)
              }
            }
          }
        } catch (error) {
          debugLog('Error creating overlay:', error)
          overlayCreationInProgress.value = false
        }
      }
    }
    createOverlayAfterDelay()
  }
}

const initializeOBSWebSocket = () => {
  if (obsWebSocket.value) {
    obsWebSocket.value.disconnect()
  }

  obsWebSocket.value = new OBSWebSocket()

  obsWebSocket.value.setCallbacks({
    onConnect: () => {
      obsConnected.value = true
      playerStore.setObsConnected(true)
      if (isElectron.value && window.electronAPI) {
        window.electronAPI.showToast('Подключен к OBS WebSocket')
      }
    },
    onDisconnect: () => {
      obsConnected.value = false
      playerStore.setObsConnected(false)
      obsSources.value = []
      obsFiltersFound.value = []
    },
    onSourcesUpdated: (sources) => {
      obsSources.value = sources
      window.obsSources = sources
    },
    onFiltersFound: (filters) => {
      obsFiltersFound.value = filters
      window.obsFiltersFound = filters
      playerStore.updateObsSettings({ filtersFound: filters })
    },
    onError: (error) => {
      console.error('OBS WebSocket error:', error)
      if (isElectron.value && window.electronAPI) {
        window.electronAPI.showToast(`Ошибка OBS: ${error}`)
      }
    }
  })
}

const connectToOBS = async () => {
  if (!obsWebSocket.value) {
    initializeOBSWebSocket()
  }

  await obsWebSocket.value.connect(
    obsSettings.value.host,
    obsSettings.value.port,
    obsSettings.value.password
  )
}

const disconnectFromOBS = () => {
  if (obsWebSocket.value) {
    obsWebSocket.value.disconnect()
  }
}

const testOBSBlur = (selectedFilterId) => {
  if (obsWebSocket.value && obsConnected.value && selectedFilterId) {
    obsWebSocket.value.testBlur(selectedFilterId)
  } else {
    if (isElectron.value && window.electronAPI) {
      window.electronAPI.showToast('Фильтр не выбран или не найден в OBS')
    }
  }
}

const refreshOBSFilters = () => {
  if (obsWebSocket.value && obsConnected.value) {
    obsWebSocket.value.loadSourcesAndSearchFilters()
  }
}

const getOBSFiltersInfo = () => {
  return obsFiltersFound.value
}

const exitFullscreen = () => {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }

    const iframe = playerIframe.value
    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (iframeDoc) {
        if (iframeDoc.exitFullscreen) {
          iframeDoc.exitFullscreen()
        } else if (iframeDoc.webkitExitFullscreen) {
          iframeDoc.webkitExitFullscreen()
        } else if (iframeDoc.mozCancelFullScreen) {
          iframeDoc.mozCancelFullScreen()
        } else if (iframeDoc.msExitFullscreen) {
          iframeDoc.msExitFullscreen()
        }

        const video = iframeDoc.querySelector('video')
        if (video) {
          if (video.webkitExitFullscreen) {
            video.webkitExitFullscreen()
          } else if (video.exitFullscreen) {
            video.exitFullscreen()
          }
        }
      }
    }
  } catch (error) {
    debugLog('Error exiting fullscreen:', error)
  }
}

const showOverlaySettings = () => {
  if (!isElectron.value) return

  const iframe = playerIframe.value
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
  if (!iframeDoc) return

  if (iframeDoc.getElementById('overlay-settings-modal')) return

  const settings = overlaySettings.value

  const modal = iframeDoc.createElement('div')
  modal.id = 'overlay-settings-modal'
  modal.style.cssText = getSettingsModalStyle()

  const modalContent = iframeDoc.createElement('div')
  modalContent.style.cssText = getSettingsModalContentStyle()

  modalContent.innerHTML = getOverlaySettingsMarkup(settings)
  ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
    modalContent.addEventListener(eventType, (e) => {
      e.stopPropagation()
      e.stopImmediatePropagation()
    })
  })

  modal.appendChild(modalContent)

  modal.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    if (e.target === modal) {
      modal.remove()
    }
  })
  ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
    modal.addEventListener(eventType, (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    })
  })

  modalContent.querySelector('#saveSettings').addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    const newSettings = {
      showTitle: modalContent.querySelector('#showTitle').checked,
      showDuration2: modalContent.querySelector('#showDuration').checked,
      showBackground: modalContent.querySelector('#showBackground').checked,
      showTimingsOnMouseMove: modalContent.querySelector('#showTimingsOnMouseMove').checked,
      highlightTimings: modalContent.querySelector('#highlightTimings').checked
    }
    overlaySettings.value = newSettings
    window.electronAPI?.showToast('Настройки оверлея сохранены')
    modal.remove()
  })

  modalContent.querySelector('#cancelSettings').addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    modal.remove()
  })

  const buttons = modalContent.querySelectorAll('button')
  buttons.forEach((button) => {
    button.addEventListener('mouseenter', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      applySettingsButtonHoverStyle(button, true)
    })
    button.addEventListener('mouseleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      applySettingsButtonHoverStyle(button, false)
    })
    ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      button.addEventListener(eventType, (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })
  })

  const checkboxes = modalContent.querySelectorAll('input[type="checkbox"]')
  const labels = modalContent.querySelectorAll('label')

  checkboxes.forEach((checkbox) => {
    ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      checkbox.addEventListener(eventType, (e) => {
        if (eventType !== 'click') {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        } else {
          e.stopPropagation()
        }
      })
    })
  })

  labels.forEach((label) => {
    ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      label.addEventListener(eventType, (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })
  })

  iframeDoc.body.appendChild(modal)
}

const createVideoOverlay = (iframeDoc, video) => {
  if (!videoOverlayEnabled2.value) {
    return
  }
  if (currentOverlayElement.value) {
    return
  }
  if (overlayCreationInProgress.value) {
    return
  }

  overlayCreationInProgress.value = true

  const overlay = iframeDoc.createElement('div')
  overlay.id = 'reyohoho-video-overlay'

  let applyOverlayStyles = () => {
    overlay.style.cssText = getOverlayBaseStyle()
  }

  const mainInfo = iframeDoc.createElement('div')
  mainInfo.style.cssText = getMainInfoStyle()

  const movieTitle = iframeDoc.createElement('div')
  const initialFontSize = overlaySettings.value.fontSize || 18

  movieTitle.style.cssText = getMovieTitleStyle({
    fontSize: initialFontSize,
    showBackground: overlaySettings.value.showBackground
  })

  const videoProgress = iframeDoc.createElement('div')
  videoProgress.style.cssText = getVideoProgressStyle({
    fontSize: initialFontSize,
    showBackground: overlaySettings.value.showBackground
  })

  const timingsPanel = iframeDoc.createElement('div')
  timingsPanel.style.cssText = getTimingsPanelStyle({
    showBackground: overlaySettings.value.showBackground
  })

  const timingsContent = iframeDoc.createElement('div')
  timingsContent.style.cssText = getTimingsContentStyle({ fontSize: initialFontSize })

  const controlsContainer = iframeDoc.createElement('div')
  controlsContainer.style.cssText = getControlsContainerStyle()

  const settingsBtn = iframeDoc.createElement('button')
  settingsBtn.style.cssText = getOverlayButtonStyle()
  settingsBtn.innerHTML = '⚙️'
  settingsBtn.title = 'Настройки оверлея'

  const fontDecreaseBtn = iframeDoc.createElement('button')
  fontDecreaseBtn.style.cssText = getOverlayButtonStyle({ fontSize: 15, fontWeight: '700' })
  fontDecreaseBtn.innerHTML = 'A-'
  fontDecreaseBtn.title = 'Уменьшить шрифт'

  const fontIncreaseBtn = iframeDoc.createElement('button')
  fontIncreaseBtn.style.cssText = getOverlayButtonStyle({ fontSize: 15, fontWeight: '700' })
  fontIncreaseBtn.innerHTML = 'A+'
  fontIncreaseBtn.title = 'Увеличить шрифт'

  const toggleBtn = iframeDoc.createElement('button')
  toggleBtn.style.cssText = getOverlayButtonStyle()
  toggleBtn.innerHTML = '👁️'
  toggleBtn.title = 'Отключить оверлей'

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    videoOverlayEnabled2.value = false
  })

  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    exitFullscreen()

    setTimeout(() => {
      showOverlaySettings()
    }, 100)
  })

  fontDecreaseBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    const currentSize = overlaySettings.value.fontSize || 18
    if (currentSize > 10) {
      overlaySettings.value = { ...overlaySettings.value, fontSize: currentSize - 2 }
    }
  })

  fontIncreaseBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    const currentSize = overlaySettings.value.fontSize || 18
    if (currentSize < 36) {
      overlaySettings.value = { ...overlaySettings.value, fontSize: currentSize + 2 }
    }
  })
  ;[settingsBtn, toggleBtn, fontDecreaseBtn, fontIncreaseBtn].forEach((btn) => {
    btn.addEventListener('mouseenter', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      applyOverlayButtonHoverStyle(btn, true)
    })
    btn.addEventListener('mouseleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      applyOverlayButtonHoverStyle(btn, false)
    })
    ;['mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
      btn.addEventListener(eventType, (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      })
    })
  })
  ;['click', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'contextmenu'].forEach((eventType) => {
    controlsContainer.addEventListener(eventType, (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    })
  })

  controlsContainer.appendChild(fontDecreaseBtn)
  controlsContainer.appendChild(fontIncreaseBtn)
  controlsContainer.appendChild(settingsBtn)
  controlsContainer.appendChild(toggleBtn)

  timingsPanel.appendChild(timingsContent)

  mainInfo.appendChild(movieTitle)
  mainInfo.appendChild(videoProgress)

  overlay.appendChild(mainInfo)
  overlay.appendChild(timingsPanel)
  overlay.appendChild(controlsContainer)

  controlsContainer.style.transition = 'opacity 0.3s ease, visibility 0.3s ease'
  applyOverlayVisibilityStyle(controlsContainer, false)

  mainInfo.style.transition = 'opacity 0.3s ease'
  let hideMainInfoTimeout = null

  const handleMouseMove = () => {
    applyOverlayVisibilityStyle(controlsContainer, true)
    mainInfo.style.opacity = '0'

    if (overlaySettings.value.showTimingsOnMouseMove && activeTimingTexts.value.length > 0) {
      applyOverlayVisibilityStyle(timingsPanel, true)
      clearTimeout(hideTimingsTimeout)
      hideTimingsTimeout = null

      if (!hasActiveTimings.value) {
        hideTimingsTimeout = setTimeout(() => {
          applyOverlayVisibilityStyle(timingsPanel, false)
          hideTimingsTimeout = null
        }, 3000)
      }
    }

    clearTimeout(overlayControlsTimeout.value)
    clearTimeout(hideMainInfoTimeout)

    overlayControlsTimeout.value = setTimeout(() => {
      applyOverlayVisibilityStyle(controlsContainer, false)
    }, 3000)

    hideMainInfoTimeout = setTimeout(() => {
      mainInfo.style.opacity = '1'
    }, 2000)
  }

  iframeDoc.addEventListener('mousemove', handleMouseMove)

  overlay.addEventListener('mouseenter', () => {
    applyOverlayVisibilityStyle(controlsContainer, true)
    mainInfo.style.opacity = '0'
    clearTimeout(hideMainInfoTimeout)
  })

  overlay.addEventListener('mouseleave', () => {
    clearTimeout(overlayControlsTimeout.value)
    clearTimeout(hideMainInfoTimeout)
    applyOverlayVisibilityStyle(controlsContainer, false)
    mainInfo.style.opacity = '1'
  })

  overlay._mouseHandler = handleMouseMove

  const findBestContainer = (videoElement) => {
    const isFullscreen =
      document.fullscreenElement === videoElement ||
      document.webkitFullscreenElement === videoElement ||
      videoElement.webkitDisplayingFullscreen ||
      (videoElement.offsetWidth === window.screen.width &&
        videoElement.offsetHeight === window.screen.height)

    if (isFullscreen) {
      return iframeDoc.body || iframeDoc.documentElement
    }

    let container = videoElement.parentNode
    let attempts = 0
    const maxAttempts = 5

    while (container && attempts < maxAttempts) {
      const computedStyle = iframeDoc.defaultView.getComputedStyle(container)
      const rect = container.getBoundingClientRect()

      if (
        rect.width > 0 &&
        rect.height > 0 &&
        (computedStyle.position === 'relative' ||
          computedStyle.position === 'absolute' ||
          computedStyle.position === 'fixed' ||
          container.tagName === 'BODY')
      ) {
        return container
      }

      container = container.parentNode
      attempts++
    }

    return videoElement.parentNode
  }

  const targetContainer = findBestContainer(video)

  overlay._targetContainer = targetContainer
  overlay._videoElement = video

  const applyOverlayStylesUpdated = () => {
    const video = overlay._videoElement
    const container = overlay._targetContainer

    const isFullscreen =
      document.fullscreenElement === video ||
      document.webkitFullscreenElement === video ||
      video.webkitDisplayingFullscreen ||
      (video.offsetWidth === window.screen.width && video.offsetHeight === window.screen.height)

    if (isFullscreen) {
      overlay.style.cssText = getOverlayPositionStyle({ fullscreen: true })
    } else {
      const videoStyle = iframeDoc.defaultView.getComputedStyle(video)
      const containerRect = container.getBoundingClientRect()

      const videoWidth = video.offsetWidth || video.clientWidth || parseFloat(videoStyle.width) || 0
      const videoHeight =
        video.offsetHeight || video.clientHeight || parseFloat(videoStyle.height) || 0

      const videoRect = video.getBoundingClientRect()
      const relativeTop = videoRect.top - containerRect.top + container.scrollTop
      const relativeLeft = videoRect.left - containerRect.left + container.scrollLeft

      overlay.style.cssText = getOverlayPositionStyle({
        fullscreen: false,
        top: relativeTop,
        left: relativeLeft,
        width: videoWidth,
        height: videoHeight
      })
    }
  }

  applyOverlayStyles = applyOverlayStylesUpdated

  video.style.position = 'relative'
  if (targetContainer.style.position === '' || targetContainer.style.position === 'static') {
    targetContainer.style.position = 'relative'
  }

  targetContainer.appendChild(overlay)

  applyOverlayStyles()

  currentOverlayElement.value = overlay
  overlayCreationInProgress.value = false

  const overlayMonitorInterval = setInterval(() => {
    if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
      clearInterval(overlayMonitorInterval)
      return
    }

    if (!iframeDoc.body.contains(overlay)) {
      try {
        const videos = iframeDoc.querySelectorAll('video')
        if (videos.length > 0) {
          const newVideo = videos[0]

          overlay._videoElement = newVideo

          const findBestContainer = (videoElement) => {
            const isFullscreen =
              document.fullscreenElement === videoElement ||
              document.webkitFullscreenElement === videoElement ||
              videoElement.webkitDisplayingFullscreen ||
              (videoElement.offsetWidth === window.screen.width &&
                videoElement.offsetHeight === window.screen.height)

            if (isFullscreen) {
              return iframeDoc.body || iframeDoc.documentElement
            }

            let container = videoElement.parentNode
            let attempts = 0
            const maxAttempts = 5

            while (container && attempts < maxAttempts) {
              const computedStyle = iframeDoc.defaultView.getComputedStyle(container)
              const rect = container.getBoundingClientRect()

              if (
                rect.width > 0 &&
                rect.height > 0 &&
                (computedStyle.position === 'relative' ||
                  computedStyle.position === 'absolute' ||
                  computedStyle.position === 'fixed' ||
                  container.tagName === 'BODY')
              ) {
                return container
              }

              container = container.parentNode
              attempts++
            }

            return videoElement.parentNode
          }

          const targetContainer = findBestContainer(newVideo)
          overlay._targetContainer = targetContainer
          targetContainer.appendChild(overlay)
          applyOverlayStyles()

          if (overlay._mouseHandler) {
            iframeDoc.removeEventListener('mousemove', overlay._mouseHandler)
            iframeDoc.addEventListener('mousemove', overlay._mouseHandler)
          }
        }
      } catch (e) {
        debugLog('Error re-adding overlay to DOM:', e)
      }
    }

    const computedStyle = iframeDoc.defaultView.getComputedStyle(overlay)
    if (
      computedStyle.visibility === 'hidden' ||
      computedStyle.display === 'none' ||
      computedStyle.opacity === '0'
    ) {
      applyOverlayStyles()
    }

    const currentZIndex = parseInt(computedStyle.zIndex) || 0
    if (currentZIndex < 999999999) {
      applyOverlayStyles()
    }

    if (overlay._videoElement && overlay._targetContainer) {
      const video = overlay._videoElement
      const videoStyle = iframeDoc.defaultView.getComputedStyle(video)

      const isFullscreen =
        document.fullscreenElement === video ||
        document.webkitFullscreenElement === video ||
        video.webkitDisplayingFullscreen ||
        (video.offsetWidth === window.screen.width && video.offsetHeight === window.screen.height)

      let expectedWidth, expectedHeight

      if (isFullscreen) {
        expectedWidth = window.innerWidth
        expectedHeight = window.innerHeight
      } else {
        expectedWidth = video.offsetWidth || video.clientWidth || parseFloat(videoStyle.width) || 0
        expectedHeight =
          video.offsetHeight || video.clientHeight || parseFloat(videoStyle.height) || 0
      }

      const currentWidth = parseInt(computedStyle.width) || 0
      const currentHeight = parseInt(computedStyle.height) || 0

      if (
        Math.abs(currentWidth - expectedWidth) > 5 ||
        Math.abs(currentHeight - expectedHeight) > 5
      ) {
        applyOverlayStyles()
      }
    }
  }, 1000)

  const overlayObserver = new window.MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target === overlay) {
        if (mutation.attributeName === 'style') {
          setTimeout(() => {
            if (currentOverlayElement.value && videoOverlayEnabled2.value) {
              applyOverlayStyles()
            }
          }, 100)
        }
      }
    })
  })

  overlayObserver.observe(overlay, {
    attributes: true,
    attributeFilter: ['style', 'class']
  })

  const resizeHandler = () => {
    if (currentOverlayElement.value && videoOverlayEnabled2.value) {
      applyOverlayStyles()
    }
  }

  const fullscreenHandler = () => {
    if (currentOverlayElement.value && videoOverlayEnabled2.value) {
      setTimeout(() => {
        applyOverlayStyles()
      }, 100)
    }
  }

  iframeDoc.defaultView.addEventListener('resize', resizeHandler)
  iframeDoc.addEventListener('fullscreenchange', fullscreenHandler)
  iframeDoc.addEventListener('webkitfullscreenchange', fullscreenHandler)

  video.addEventListener('webkitbeginfullscreen', fullscreenHandler)
  video.addEventListener('webkitendfullscreen', fullscreenHandler)

  overlay._monitorInterval = overlayMonitorInterval
  overlay._mutationObserver = overlayObserver
  overlay._resizeHandler = resizeHandler
  overlay._fullscreenHandler = fullscreenHandler
  overlay._iframeDoc = iframeDoc

  const initialProtectionInterval = setInterval(() => {
    if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
      clearInterval(initialProtectionInterval)
      return
    }
    applyOverlayStyles()
  }, 500)

  setTimeout(() => {
    clearInterval(initialProtectionInterval)
  }, 10000)
}

const updateVideoOverlay = () => {
  if (!currentOverlayElement.value || !videoOverlayEnabled2.value) {
    return
  }

  const iframe = playerIframe.value
  if (!iframe) return
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
  if (!iframeDoc) return

  const overlay = currentOverlayElement.value
  const mainInfo = overlay.children[0]
  const timingsPanel = overlay.children[1]

  const computedStyle = iframeDoc.defaultView.getComputedStyle(overlay)
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    overlay.style.setProperty('display', 'flex', 'important')
    overlay.style.setProperty('visibility', 'visible', 'important')
  }

  const currentFontSize = overlaySettings.value.fontSize || 18
  const movieTitle = mainInfo.children[0]
  movieTitle.style.fontSize = `${currentFontSize + 2}px`
  if (overlaySettings.value.showTitle) {
    movieTitle.style.display = 'block'
    const title =
      props.movieInfo?.title ||
      props.movieInfo?.name_ru ||
      props.movieInfo?.name_en ||
      props.movieInfo?.name_original ||
      'Загрузка...'
    const year = props.movieInfo?.year ? ` (${props.movieInfo.year})` : ''
    movieTitle.textContent = title + year

    applyOverlayTitleBackgroundStyle(movieTitle, overlaySettings.value.showBackground)
  } else {
    movieTitle.style.display = 'none'
  }

  const videoProgress = mainInfo.children[1]
  videoProgress.style.fontSize = `${currentFontSize}px`
  let progressHtml = ''

  if (overlaySettings.value.showDuration2) {
    const currentTimeFormatted = formatSecondsToTime(currentVideoTime.value)
    const totalTimeFormatted = formatSecondsToTime(totalVideoDuration.value)
    progressHtml = getDurationProgressMarkup({ currentTimeFormatted, totalTimeFormatted })
  }

  if (obsSettings.value.enabled && obsSettings.value.showObsInOverlay) {
    let statusText = 'Отключен'
    const statusColor = '#999999'

    if (obsConnected.value) {
      if (obsSettings.value.selectedFilterId) {
        const selectedFilter = obsFiltersFound.value.find(
          (f) => f.id === obsSettings.value.selectedFilterId
        )
        if (selectedFilter) {
          statusText = `${selectedFilter.filterName} (${selectedFilter.sceneName})`
        } else {
          statusText = 'Фильтр не найден'
        }
      } else if (obsFiltersFound.value.length > 0) {
        statusText = 'Фильтр не выбран'
      } else {
        statusText = 'Фильтры не найдены'
      }
    }

    const obsStatusHtml = getObsStatusMarkup({ statusColor, statusText })
    progressHtml = progressHtml ? `${progressHtml} ${obsStatusHtml}` : obsStatusHtml
  }

  if (progressHtml) {
    videoProgress.style.display = 'flex'
    videoProgress.innerHTML = progressHtml
    applyOverlayProgressBackgroundStyle(videoProgress, overlaySettings.value.showBackground)
  } else {
    videoProgress.style.display = 'none'
  }

  if (activeTimingTexts.value.length > 0) {
    const timingsContent = timingsPanel.children[0]
    timingsContent.style.cssText = getTimingsContentStyle({ fontSize: currentFontSize })
    timingsContent.innerHTML = ''

    const list = iframeDoc.createElement('div')
    list.style.cssText = getTimingsListStyle()

    activeTimingTexts.value.forEach((timing) => {
      timing.intervals.forEach((interval) => {
        const intervalSpan = iframeDoc.createElement('div')
        intervalSpan.textContent = interval.text
        intervalSpan.style.cssText = getTimingChipStyle({
          status: interval.status,
          highlight: overlaySettings.value.highlightTimings
        })

        list.appendChild(intervalSpan)
      })
    })

    timingsContent.appendChild(list)
    timingsPanel.style.display = 'block'

    if (!overlaySettings.value.showTimingsOnMouseMove || hasActiveTimings.value) {
      applyOverlayVisibilityStyle(timingsPanel, true)
    }

    applyOverlayTimingsBackgroundStyle(timingsPanel, overlaySettings.value.showBackground)
  } else {
    timingsPanel.style.display = 'none'
  }

  if (
    overlaySettings.value.showTimingsOnMouseMove &&
    hasActiveTimings.value &&
    activeTimingTexts.value.length > 0
  ) {
    applyOverlayVisibilityStyle(timingsPanel, true)
    clearTimeout(hideTimingsTimeout)
  } else if (
    overlaySettings.value.showTimingsOnMouseMove &&
    !hasActiveTimings.value &&
    activeTimingTexts.value.length > 0 &&
    timingsPanel.style.opacity === '1' &&
    !hideTimingsTimeout
  ) {
    hideTimingsTimeout = setTimeout(() => {
      applyOverlayVisibilityStyle(timingsPanel, false)
      hideTimingsTimeout = null
    }, 3000)
  }
}

const removeVideoOverlay = () => {
  if (currentOverlayElement.value) {
    try {
      if (currentOverlayElement.value._monitorInterval) {
        clearInterval(currentOverlayElement.value._monitorInterval)
      }
      if (currentOverlayElement.value._mutationObserver) {
        currentOverlayElement.value._mutationObserver.disconnect()
      }
      if (currentOverlayElement.value._resizeHandler && currentOverlayElement.value._iframeDoc) {
        currentOverlayElement.value._iframeDoc.defaultView.removeEventListener(
          'resize',
          currentOverlayElement.value._resizeHandler
        )
      }
      if (
        currentOverlayElement.value._fullscreenHandler &&
        currentOverlayElement.value._iframeDoc
      ) {
        currentOverlayElement.value._iframeDoc.removeEventListener(
          'fullscreenchange',
          currentOverlayElement.value._fullscreenHandler
        )
        currentOverlayElement.value._iframeDoc.removeEventListener(
          'webkitfullscreenchange',
          currentOverlayElement.value._fullscreenHandler
        )

        if (currentOverlayElement.value._videoElement) {
          currentOverlayElement.value._videoElement.removeEventListener(
            'webkitbeginfullscreen',
            currentOverlayElement.value._fullscreenHandler
          )
          currentOverlayElement.value._videoElement.removeEventListener(
            'webkitendfullscreen',
            currentOverlayElement.value._fullscreenHandler
          )
        }
      }
      if (currentOverlayElement.value._mouseHandler && currentOverlayElement.value._iframeDoc) {
        currentOverlayElement.value._iframeDoc.removeEventListener(
          'mousemove',
          currentOverlayElement.value._mouseHandler
        )
      }

      currentOverlayElement.value.remove()
    } catch (e) {
      debugLog('Error removing overlay:', e)
    }
    currentOverlayElement.value = null
  }

  overlayCreationInProgress.value = false

  if (overlayControlsTimeout.value) {
    clearTimeout(overlayControlsTimeout.value)
    overlayControlsTimeout.value = null
  }
}

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  window.addEventListener('resize', updateTooltipPosition)
  if (isCentered.value) centerPlayer()

  window.toggleCompressor = toggleCompressor
  window.toggleMirror = toggleMirror

  initializeOBSWebSocket()

  window.connectToOBS = connectToOBS
  window.testOBSBlur = testOBSBlur
  window.refreshOBSFilters = refreshOBSFilters
  window.getOBSFiltersInfo = getOBSFiltersInfo
  window.testOBSConnection = testOBSConnection

  window.debugOBS = () => {
    debugLog('=== OBS Debug Info ===')
    debugLog('OBS Settings:', obsSettings.value)
    debugLog('OBS Connected:', obsConnected.value)
    debugLog('OBS Filters Found:', obsFiltersFound.value)
    debugLog('OBS WebSocket instance:', obsWebSocket.value)

    if (obsWebSocket.value) {
      debugLog('WebSocket state:', obsWebSocket.value.ws?.readyState)
      debugLog('Is Connected:', obsWebSocket.value.isConnected)
      debugLog('Is Authenticated:', obsWebSocket.value.isAuthenticated)
    }
  }

  if (obsSettings.value.enabled) {
    connectToOBS()
  }

  if (isElectron.value) {
    overlayTimingsCheckInterval.value = setInterval(() => {
      const currentCount = window.overlayNudityTimings ? window.overlayNudityTimings.length : 0

      if (currentCount > lastOverlayTimingsCount.value) {
        lastOverlayTimingsCount.value = currentCount

        if (!videoOverlayEnabled2.value) {
          videoOverlayEnabled2.value = true
          if (window.electronAPI) {
            window.electronAPI.showToast('Оверлей автоматически включён - добавлены тайминги')
          }
        }
      } else {
        lastOverlayTimingsCount.value = currentCount
      }
    }, 1000)
  }

  if (isElectron.value && videoOverlayEnabled2.value) {
    const initializeOverlay = () => {
      if (playerIframe.value && !currentOverlayElement.value) {
        try {
          const iframe = playerIframe.value
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
          if (iframeDoc) {
            const video = iframeDoc.querySelector('video')
            if (video) {
              const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
              if (timeSinceLoad >= 100) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(initializeOverlay, 100 - timeSinceLoad)
              }
            }
          }
        } catch (error) {
          debugLog('Error initializing overlay on mount:', error)
          overlayCreationInProgress.value = false
        }
      }
    }

    setTimeout(initializeOverlay, 1000)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScaleFactor)
  window.removeEventListener('resize', updateTooltipPosition)
  clearIframeLoadTimeout()
  cleanupPlayerLayout()

  if (videoPositionInterval.value) {
    clearInterval(videoPositionInterval.value)
  }
  if (overlayTimingsCheckInterval.value) {
    clearInterval(overlayTimingsCheckInterval.value)
  }
  removeVideoOverlay()
  cleanupElectronControls()

  disconnectFromOBS()

  delete window.connectToOBS
  delete window.testOBSBlur
  delete window.refreshOBSFilters
  delete window.getOBSFiltersInfo
  delete window.testOBSConnection
  delete window.debugOBS
  delete window.obsSources
  delete window.obsFiltersFound
})

const testOBSConnection = async () => {
  if (obsWebSocket.value && obsConnected.value) {
    const result = await obsWebSocket.value.testConnection()
    return result
  } else {
    return { success: false, error: 'Not connected' }
  }
}
</script>

<style scoped src="../assets/player-component.scss"></style>
