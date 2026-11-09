<template>
  <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" show-retry @retry="retryPlayers" />

  <template v-else>
    <PlayerSelectorBar
      :selected-label="selectedPlayerLabel"
      :has-players="playersInternal.length > 0"
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
          v-show="!iframeLoading && safeIframeUrl"
          ref="playerIframe"
          :src="safeIframeUrl || undefined"
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
          :text="selectedPlayerInternal ? `Загружается плеер: ${getProviderDisplayName(selectedPlayerInternal)}` : `Поиск плееров${searchingSource ? ': ' + searchingSource : '…'}`"
        />
        <div v-else-if="playersEmptyMessage" class="player-empty-state">
          <p>{{ playersEmptyMessage }}</p>
          <button type="button" @click="retryPlayers">Повторить</button>
          <button type="button" @click="router.push('/settings?tab=api')">Сменить источник</button>
          <button v-if="showSourceButton" type="button" @click="openSourceModal">
            Выбрать источник
          </button>
        </div>
      </div>

      <!-- Кнопка закрытия в театральном режиме -->
      <button
        v-show="theaterMode"
        class="close-theater-btn"
        :class="{
          visible: closeButtonVisible,
          hiding: theaterMode && !closeButtonVisible && closeButtonWasVisible
        }"
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
            type="button"
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
                type="button"
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
                type="button"
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
                type="button"
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
                type="button"
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
                type="button"
                class="abandoned-btn"
                :class="{ active: movieInfo?.lists?.isAbandoned }"
                @click="toggleList(USER_LIST_TYPES_ENUM.ABANDONED)"
              >
                <span class="material-icons">{{
                  movieInfo?.lists?.isAbandoned ? 'cancel' : 'not_interested'
                }}</span>
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
              :aria-label="`Изменить соотношение сторон, сейчас ${aspectRatio}`"
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
            :aria-label="`Изменить соотношение сторон, сейчас ${aspectRatio}`"
            @click="cycleAspectRatio"
          >
            <span class="current-ratio">{{ aspectRatio }}</span>
          </button>
        </template>
      </div>

      <div v-if="!isMobile && !showFavoriteTooltip && kp_id" class="desktop-list-buttons">
        <div class="tooltip-container">
          <button
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
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
import { usePlayerVideoOverlay } from '@/composables/usePlayerVideoOverlay'
import { usePlayerSharing } from '@/composables/usePlayerSharing'
import { usePlayerSources } from '@/composables/usePlayerSources'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { useRouter } from 'vue-router'
import PlayerSelectorBar from '@/components/player/PlayerSelectorBar.vue'
import { getProviderDisplayName } from '@/utils/playerUtils'
import { trackAnalyticsEvent } from '@/utils/analytics'
import { debugLog } from '@/utils/logger'
import {
  assessPlayerIframe,
  getPersistablePlayerKey,
  getSafePlayerUrl
} from '@/utils/playerSecurity'

const PlayerSourceModal = defineAsyncComponent(
  () => import('@/components/player/PlayerSourceModal.vue')
)
const PlayerModal = defineAsyncComponent(() => import('@/components/PlayerModal.vue'))

const mainStore = useMainStore()
const playerStore = usePlayerStore()
const router = useRouter()

const props = defineProps({
  kpId: String,
  movieInfo: {
    type: Object,
    default: () => ({})
  }
})
const emit = defineEmits(['update:selectedPlayer', 'toggle-list'])
const kp_id = computed(() => props.kpId)

const iframeLoading = ref(true)
const playerIframe = ref(null)
const containerRef = ref(null)
const PLAYER_IFRAME_LOAD_TIMEOUT_MS = 20000
let iframeLoadStartedAt = 0
let iframeLoadTimeout = null
let videoErrorTrackingObserver = null
let iframeVideoTrackingLoadId = 0
const trackedVideoErrorElements = new WeakSet()
const reportedVideoErrorSignatures = new WeakMap()

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
  searchingSource,
  fetchPlayers,
  openPlayerModal,
  closePlayerModal,
  openSourceModal,
  closeSourceModal,
  applySourceCandidate
} = usePlayerSources({
  props,
  getProviderDisplayName,
  onSelectedPlayerChange: (player) => emit('update:selectedPlayer', player)
})

const safeIframeUrl = computed(() => getSafePlayerUrl(selectedPlayerInternal.value?.iframe))
const activeTooltip = ref(null)
const tooltipHovered = ref(false)
let hideTimeout = null

const notificationRef = ref(null)
const { copyMovieLink } = usePlayerSharing({
  notificationRef
})

const tooltipContainer = ref(null)
const tooltip = ref(null)

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

const videoOverlay = usePlayerVideoOverlay({
  isElectron,
  playerStore,
  playerIframe,
  props,
  enableBlur,
  disableBlur
})
const { videoOverlayEnabled2, toggleVideoOverlay } = videoOverlay

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

const getPlayerAnalyticsPayload = () => ({
  kp_id: kp_id.value,
  player_key: selectedPlayerInternal.value?.key || '',
  player_name: selectedPlayerInternal.value
    ? getProviderDisplayName(selectedPlayerInternal.value)
    : '',
  source: mainStore.contentApiProvider
})

const clearVideoErrorTracking = () => {
  if (!videoErrorTrackingObserver) return
  videoErrorTrackingObserver.disconnect()
  videoErrorTrackingObserver = null
}

const resolveIframeSrc = (src) => {
  try {
    return new URL(src || '', window.location.href).href
  } catch {
    return src || ''
  }
}

const isExpectedIframeSrc = (iframe, iframeSrc) => {
  if (!iframe || !iframeSrc || !iframe.src || iframe.src === 'about:blank') return false
  return resolveIframeSrc(iframe.src) === resolveIframeSrc(iframeSrc)
}

const getVideoErrorSignature = (video) => {
  const errorCode = video?.error?.code || ''
  const errorMessage = video?.error?.message || ''
  const videoSource = video?.currentSrc || video?.src || ''
  return [videoSource, errorCode, errorMessage].join('|')
}

const trackVideoElementError = (video, loadId) => {
  if (loadId !== iframeVideoTrackingLoadId) return

  const signature = getVideoErrorSignature(video)
  if (reportedVideoErrorSignatures.get(video) === signature) return
  reportedVideoErrorSignatures.set(video, signature)

  const mediaError = video?.error
  trackAnalyticsEvent('player_iframe_error', {
    ...getPlayerAnalyticsPayload(),
    error_target: 'video',
    status: 'error',
    duration_ms: iframeLoadStartedAt ? Date.now() - iframeLoadStartedAt : 0,
    video_error_code: mediaError?.code || null,
    video_error_message: mediaError?.message || '',
    video_ready_state: video?.readyState ?? null,
    video_network_state: video?.networkState ?? null
  })
}

const trackVideoElementForErrors = (video, loadId) => {
  if (loadId !== iframeVideoTrackingLoadId) return

  if (!trackedVideoErrorElements.has(video)) {
    trackedVideoErrorElements.add(video)
    video.addEventListener('error', () => trackVideoElementError(video, loadId))
  }

  if (video.error) {
    trackVideoElementError(video, loadId)
  }
}

const trackVideoErrorsInNode = (node, loadId) => {
  if (!node || loadId !== iframeVideoTrackingLoadId) return

  if (node.nodeType === 1 && node.matches?.('video')) {
    trackVideoElementForErrors(node, loadId)
  }

  if (node.nodeType === 1 || node.nodeType === 11) {
    node.querySelectorAll?.('video')?.forEach((video) => {
      trackVideoElementForErrors(video, loadId)
    })
  }
}

const trackIframeDocVideoErrors = (iframeDoc, loadId) => {
  iframeDoc?.querySelectorAll?.('video')?.forEach((video) => {
    trackVideoElementForErrors(video, loadId)
  })
}

const startIframeVideoErrorTracking = (loadId) => {
  if (loadId !== iframeVideoTrackingLoadId) return

  clearVideoErrorTracking()

  try {
    const iframe = playerIframe.value
    const iframeSrc = selectedPlayerInternal.value?.iframe || ''
    if (!iframe || !isExpectedIframeSrc(iframe, iframeSrc)) return
    const iframeOrigin = new URL(iframeSrc, window.location.href).origin
    if (iframeOrigin !== window.location.origin) return

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc || loadId !== iframeVideoTrackingLoadId) return

    trackIframeDocVideoErrors(iframeDoc, loadId)

    const observeTarget = iframeDoc.body || iframeDoc.documentElement
    const MutationObserverCtor = iframe.contentWindow?.MutationObserver || window.MutationObserver
    if (!observeTarget || !MutationObserverCtor) return

    videoErrorTrackingObserver = new MutationObserverCtor((mutations) => {
      if (loadId !== iframeVideoTrackingLoadId) return
      mutations.forEach((mutation) => {
        mutation.addedNodes?.forEach((node) => {
          trackVideoErrorsInNode(node, loadId)
        })
      })
    })
    videoErrorTrackingObserver.observe(observeTarget, {
      childList: true,
      subtree: true
    })
  } catch (error) {
    debugLog('Unable to track iframe video errors:', error)
  }
}

const stopCurrentVideoErrorTracking = () => {
  iframeVideoTrackingLoadId += 1
  clearVideoErrorTracking()
}

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
  const iframe = playerIframe.value
  const iframeSrc = selectedPlayerInternal.value?.iframe || ''
  if (!isExpectedIframeSrc(iframe, iframeSrc)) return

  const loadId = ++iframeVideoTrackingLoadId
  iframeLoading.value = false
  clearIframeLoadTimeout()
  startIframeVideoErrorTracking(loadId)
  trackAnalyticsEvent('player_iframe_load', {
    ...getPlayerAnalyticsPayload(),
    status: 'success',
    duration_ms: iframeLoadStartedAt ? Date.now() - iframeLoadStartedAt : 0
  })
  const securityAssessment = assessPlayerIframe({ iframeUrl: iframeSrc })
  trackAnalyticsEvent('player_iframe_security', {
    ...getPlayerAnalyticsPayload(),
    security_status: securityAssessment.status,
    iframe_origin: securityAssessment.origin
  })
  const preferredPlayerKey = getPersistablePlayerKey(selectedPlayerInternal.value)
  if (preferredPlayerKey) {
    playerStore.updatePreferredPlayer(preferredPlayerKey)
  }
  window.iframeLoadTime = Date.now()
  startMirrorMonitoring()
  void videoOverlay.onIframeLoad()
}

const onIframeError = () => {
  iframeLoading.value = false
  clearIframeLoadTimeout()
  stopCurrentVideoErrorTracking()

  const payload = {
    ...getPlayerAnalyticsPayload(),
    error_target: 'iframe',
    status: 'error',
    duration_ms: iframeLoadStartedAt ? Date.now() - iframeLoadStartedAt : 0
  }

  trackAnalyticsEvent('player_iframe_load', payload)
  trackAnalyticsEvent('player_iframe_error', payload)
}

const resetPlayerPlayback = () => {
  videoOverlay.resetPlayback()
  resetElectronPlaybackState()
}

const handlePlayerSelect = (player) => {
  if (selectedPlayerInternal.value?.key === player.key) {
    closePlayerModal()
    return
  }

  selectedPlayerInternal.value = player
  iframeLoading.value = true
  // Note: emit('update:selectedPlayer') is handled by the watcher on selectedPlayerInternal
  closePlayerModal()
}

watch(selectedPlayerInternal, (newVal) => {
  resetPlayerPlayback()
  stopCurrentVideoErrorTracking()
  if (newVal) {
    iframeLoading.value = true
    scheduleIframeLoadTimeout()
    emit('update:selectedPlayer', newVal)
  } else {
    clearIframeLoadTimeout()
  }
})

watch(
  kp_id,
  async (newKpId) => {
    if (newKpId) {
      iframeLoading.value = true
      selectedPlayerInternal.value = null
      resetPlayerPlayback()
      await fetchPlayers()
      if (isCentered.value) centerPlayer()
    }
  }
)

watch(
  () => mainStore.contentApiProvider,
  async (newProvider, oldProvider) => {
    if (!newProvider || newProvider === oldProvider) return

    iframeLoading.value = true
    playerStore.clearPreferredPlayer()
    resetPlayerPlayback()
    await fetchPlayers()
  }
)

const toggleList = (type) => emit('toggle-list', type)
const retryPlayers = () => {
  iframeLoading.value = true
  return fetchPlayers(true)
}
const repositionTooltip = () => {
  if (activeTooltip.value) updateTooltipPosition(activeTooltip.value)
}

const showFavoriteTooltip = computed(() => playerStore.showFavoriteTooltip)

const openSettings = () => {
  router.push('/settings')
  hideTooltip()
}

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  window.addEventListener('resize', repositionTooltip)
  if (isCentered.value) centerPlayer()

  window.toggleCompressor = toggleCompressor
  window.toggleMirror = toggleMirror

  videoOverlay.mount()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScaleFactor)
  window.removeEventListener('resize', repositionTooltip)
  clearIframeLoadTimeout()
  stopCurrentVideoErrorTracking()
  cleanupPlayerLayout()

  clearTimeout(hideTimeout)
  videoOverlay.dispose()
  cleanupElectronControls()
})
</script>

<style scoped src="../assets/player-component.scss"></style>
