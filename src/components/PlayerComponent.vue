<template>
  <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

  <template v-else>
    <!-- Кнопка для открытия модалки выбора плеера -->
    <div class="players-list">
      <span>Плеер:</span>
      <button class="player-btn" @click="openPlayerModal">
        {{
          selectedPlayerInternal
            ? cleanName(selectedPlayerInternal.translate).toUpperCase()
            : 'Загрузка плееров...'
        }}
      </button>
    </div>

    <!-- Модальное окно выбора плеера -->
    <PlayerModal
      v-if="showPlayerModal"
      :players="playersInternal"
      :selected-player="selectedPlayerInternal"
      @close="closePlayerModal"
      @select="handlePlayerSelect"
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
        ></iframe>
        <SpinnerLoading
          v-if="iframeLoading"
          :text="`Загружается плеер: ${selectedPlayerInternal ? cleanName(selectedPlayerInternal.translate) : 'Загружается список плееров'}\nЕсли плеер не грузится, то смените плеер выше или включите VPN`"
          style="white-space: pre-line"
        />
      </div>

      <!-- Кнопка закрытия в театральном режиме -->
      <button
        v-if="theaterMode"
        class="close-theater-btn"
        :class="{ visible: closeButtonVisible }"
        @click="toggleTheaterMode"
      >
        ✖
      </button>
    </div>

    <!-- Кнопки управления -->
    <div v-if="!theaterMode" class="controls">
      <div class="main-controls">
        <div
          v-if="!isMobile"
          ref="tooltipContainer"
          class="tooltip-container list-buttons-container"
          data-tooltip-container="favorite"
        >
          <button
            v-if="showFavoriteTooltip"
            class="favorite-btn"
            :class="{ active: movieInfo?.lists?.isFavorite }"
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
                <span class="material-icons">{{
                  movieInfo?.lists?.isAbandoned ? 'not_interested' : 'not_interested'
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
            <button class="center-btn" @click="centerPlayer">
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
          <div v-if="!isElectron" class="tooltip-container" data-tooltip-container="app_link">
            <button
              class="app-link-btn"
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
              :class="{ active: videoOverlayEnabled }"
              @mouseenter="showTooltip('overlay')"
              @mouseleave="activeTooltip = null"
              @click="toggleVideoOverlay"
            >
              <span class="material-icons">{{
                videoOverlayEnabled ? 'layers' : 'layers_clear'
              }}</span>
            </button>
            <div v-show="activeTooltip === 'overlay'" class="custom-tooltip" data-tooltip="overlay">
              {{ videoOverlayEnabled ? 'Скрыть оверлей видео' : 'Показать оверлей видео' }}
            </div>
          </div>
        </template>
      </div>

      <div v-if="!isMobile && !showFavoriteTooltip" class="desktop-list-buttons">
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
import { getPlayers } from '@/api/movies'
import { handleApiError } from '@/constants'
import { addToList, delFromList } from '@/api/user'
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import SliderRound from '@/components/slider/SliderRound.vue'
import { showMessageToast } from '@/helpers/ui'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { useAuthStore } from '@/store/auth'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlayerModal from '@/components/PlayerModal.vue'
import { parseTimingTextToSeconds, formatSecondsToTime } from '@/utils/dateUtils'

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

const playersInternal = ref([])
const selectedPlayerInternal = ref(null)
const iframeLoading = ref(true)
const theaterMode = ref(false)
const closeButtonVisible = ref(false)
const playerIframe = ref(null)
const containerRef = ref(null)
const showPlayerModal = ref(false)

// Переменные для ошибок
const errorMessage = ref('')
const errorCode = ref(null)

const maxPlayerHeightValue = ref(window.innerHeight * 0.9)
const maxPlayerHeight = computed(() => `${maxPlayerHeightValue.value}px`)
const isMobile = computed(() => mainStore.isMobile)
const isElectron = computed(() => !!window.electronAPI)

const activeTooltip = ref(null)
const tooltipHovered = ref(false)
let hideTimeout = null

const notificationRef = ref(null)

const tooltipContainer = ref(null)
const tooltip = ref(null)
const mirrorCheckInterval = ref(null)
const currentMirrorState = ref(false)
const currentCompressorState = ref(false)
const videoPositionInterval = ref(null)
const overlayTimingsCheckInterval = ref(null)
const lastOverlayTimingsCount = ref(0)

const audioContext = ref(null)
const compressorNode = ref(null)
const mediaSource = ref(null)
const gainNode = ref(null)
const bypassGainNode = ref(null)
const currentVideoElement = ref(null)

const videoOverlayEnabled = computed({
  get: () => playerStore.videoOverlayEnabled,
  set: (value) => playerStore.updateVideoOverlay(value)
})

const overlaySettings = computed({
  get: () => playerStore.overlaySettings,
  set: (value) => playerStore.updateOverlaySettings(value)
})
const currentVideoTime = ref(0)
const totalVideoDuration = ref(0)
const activeTimingTexts = ref([])
const playStartTime = ref(null)
const hasPlayedFor5Seconds = ref(false)
const currentOverlayElement = ref(null)
const overlayControlsTimeout = ref(null)
const overlayCreationInProgress = ref(false)

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

const aspectRatio = computed({
  get: () => playerStore.aspectRatio,
  set: (value) => playerStore.updateAspectRatio(value)
})

const isCentered = computed({
  get: () => playerStore.isCentered,
  set: (value) => playerStore.updateCentering(value)
})

const isInAnyList = computed(() => {
  return (
    props.movieInfo?.lists?.isFavorite ||
    props.movieInfo?.lists?.isWatching ||
    props.movieInfo?.lists?.isLater ||
    props.movieInfo?.lists?.isCompleted ||
    props.movieInfo?.lists?.isAbandoned
  )
})

const preferredPlayer = computed(() => playerStore.preferredPlayer)
const naturalHeight = ref(0)

const normalizeKey = (key) => key.toUpperCase()

const updateScaleFactor = () => {
  if (theaterMode.value || !containerRef.value) return
  const [w, h] = aspectRatio.value.split(':').map(Number)
  maxPlayerHeightValue.value = window.innerHeight * 0.9
  naturalHeight.value = Math.min(
    containerRef.value.clientWidth * (h / w),
    maxPlayerHeightValue.value
  )
}

const containerStyle = computed(() => {
  if (theaterMode.value) return {}
  const [w, h] = aspectRatio.value.split(':').map(Number)
  const maxWidth = maxPlayerHeightValue.value * (w / h)
  return {
    width: '100%',
    maxWidth: `${maxWidth}px`,
    maxHeight: maxPlayerHeight.value,
    margin: '0 auto',
    overflow: 'hidden'
  }
})

const iframeWrapperStyle = computed(() => {
  const [w, h] = aspectRatio.value.split(':').map(Number)
  return {
    position: 'relative',
    width: '100%',
    paddingTop: `${(h / w) * 100}%`
  }
})

const centerPlayer = () => {
  if (containerRef.value) {
    setTimeout(() => {
      nextTick(() => {
        containerRef.value.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        })
      })
    }, 500)
  }
}

const fetchPlayers = async () => {
  try {
    errorMessage.value = ''
    errorCode.value = null
    const players = await getPlayers(props.kpId)
    playersInternal.value = Object.entries(players).map(([key, value]) => ({
      key: key.toUpperCase(),
      ...value
    }))
    if (playersInternal.value.length > 0) {
      if (preferredPlayer.value) {
        const normalizedPreferred = normalizeKey(preferredPlayer.value)
        const preferred = playersInternal.value.find(
          (player) => normalizeKey(player.key) === normalizedPreferred
        )
        selectedPlayerInternal.value = preferred || playersInternal.value[0]
      } else {
        selectedPlayerInternal.value = playersInternal.value[0]
      }
      emit('update:selectedPlayer', selectedPlayerInternal.value)
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при загрузке плееров:', error)
  }
}

const openPlayerModal = () => {
  showPlayerModal.value = true
}

const closePlayerModal = () => {
  showPlayerModal.value = false
}

const initializeAudioContext = () => {
  try {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
    }

    if (!compressorNode.value) {
      compressorNode.value = audioContext.value.createDynamicsCompressor()
      compressorNode.value.threshold.value = -50
      compressorNode.value.knee.value = 40
      compressorNode.value.ratio.value = 12
      compressorNode.value.attack.value = 0
      compressorNode.value.release.value = 0.25

      gainNode.value = audioContext.value.createGain()
      bypassGainNode.value = audioContext.value.createGain()

      gainNode.value.gain.value = 0
      bypassGainNode.value.gain.value = 1

      compressorNode.value.connect(gainNode.value)
      gainNode.value.connect(audioContext.value.destination)

      bypassGainNode.value.connect(audioContext.value.destination)
    }

    return true
  } catch (e) {
    console.log('Error initializing audio context:', e)
    return false
  }
}

const setupVideoAudio = async (video) => {
  try {
    if (!audioContext.value || currentVideoElement.value === video) return true

    const iframe = playerIframe.value
    const iframeSrc = iframe?.src || ''

    if (
      iframeSrc.includes('videoframe') ||
      iframeSrc.includes('kinoserial.net') ||
      iframeSrc.includes('allarknow')
    ) {
      console.log('Player detected as unsupported for compressor:', iframeSrc)
      currentVideoElement.value = video
      mediaSource.value = null
      currentCompressorState.value = false

      if (isElectron.value) {
        window.electronAPI.showToast('Компрессор не поддерживается этим плеером')
      }
      return false
    }

    if (mediaSource.value) {
      try {
        mediaSource.value.disconnect()
      } catch {
        // ignore
      }
    }

    const attemptConnection = async (delay = 0) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        mediaSource.value = audioContext.value.createMediaElementSource(video)
        currentVideoElement.value = video

        mediaSource.value.connect(compressorNode.value)
        mediaSource.value.connect(bypassGainNode.value)

        console.log(`Video audio setup completed (attempt with ${delay}ms delay)`)
        return true
      } catch (e) {
        if (e.name === 'InvalidStateError' && e.message.includes('already connected')) {
          console.log(`MediaElementSource already connected (${delay}ms delay attempt)`)
          return false
        } else {
          throw e
        }
      }
    }

    if (await attemptConnection(0)) return true

    if (await attemptConnection(100)) return true

    if (await attemptConnection(300)) return true

    if (await attemptConnection(800)) return true

    console.log(
      'Video element has internal audio processing, compressor not available for this player'
    )
    currentVideoElement.value = video
    mediaSource.value = null
    currentCompressorState.value = false

    if (isElectron.value) {
      window.electronAPI.showToast('Компрессор не поддерживается этим плеером')
    }
    return false
  } catch (e) {
    console.log('Error setting up video audio:', e)
    return false
  }
}

const applyCompressorEffect = async (enabled) => {
  if (!playerIframe.value) return

  try {
    const iframe = playerIframe.value
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (!iframeDoc) return

    const videos = iframeDoc.querySelectorAll('video')
    if (videos.length === 0) return

    const video = videos[0]

    if (!initializeAudioContext()) return

    const audioSetupSuccess = await setupVideoAudio(video)
    if (!audioSetupSuccess || !mediaSource.value) {
      console.log('Compressor not available for this player')
      return
    }

    if (enabled && !currentCompressorState.value) {
      gainNode.value.gain.setValueAtTime(1, audioContext.value.currentTime)
      bypassGainNode.value.gain.setValueAtTime(0, audioContext.value.currentTime)
      currentCompressorState.value = true

      if (isElectron.value) {
        window.electronAPI.showToast('Компрессор включён')
      }
      console.log('Compressor enabled')
    } else if (!enabled && currentCompressorState.value) {
      gainNode.value.gain.setValueAtTime(0, audioContext.value.currentTime)
      bypassGainNode.value.gain.setValueAtTime(1, audioContext.value.currentTime)
      currentCompressorState.value = false

      if (isElectron.value) {
        window.electronAPI.showToast('Компрессор отключён')
      }
      console.log('Compressor disabled')
    }
  } catch (e) {
    console.log('Compressor error:', e)
    if (isElectron.value) {
      window.electronAPI.showToast('Ошибка при включении компрессора')
    }
  }
}

const toggleBlur = () => {
  if (isElectron.value) {
    window.electronAPI.sendHotKey('F2')
  } else {
    showMessageToast('Доступно только в приложении ReYohoho Desktop')
    window.open('https://t.me/ReYohoho/126', '_blank')
  }
}

const toggleCompressor = () => {
  if (isElectron.value) {
    compressorEnabled.value = !compressorEnabled.value
    applyCompressorEffect(compressorEnabled.value)
  } else {
    showMessageToast('Доступно только в приложении ReYohoho Desktop')
    window.open('https://t.me/ReYohoho/126', '_blank')
  }
}

const toggleMirror = () => {
  if (isElectron.value) {
    mirrorEnabled.value = !mirrorEnabled.value
    applyMirrorEffect(mirrorEnabled.value)
  } else {
    showMessageToast('Доступно только в приложении ReYohoho Desktop')
    window.open('https://t.me/ReYohoho/126', '_blank')
  }
}

const toggleTheaterMode = () => {
  theaterMode.value = !theaterMode.value
  if (theaterMode.value) {
    window.addEventListener('mousemove', showCloseButton)
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('no-scroll')
  } else {
    window.removeEventListener('mousemove', showCloseButton)
    document.removeEventListener('keydown', onKeyDown)
    document.body.classList.remove('no-scroll')
  }
  closeButtonVisible.value = theaterMode.value
  nextTick(() => centerPlayer())
}

const theaterModeCloseButtonTimeout = ref(null)
const showCloseButton = () => {
  theaterModeCloseButtonTimeout.value = setTimeout(() => {
    clearTimeout(theaterModeCloseButtonTimeout.value)
    closeButtonVisible.value = false
  }, 4000)
  closeButtonVisible.value = true
}

const dimmingEnabled = computed(() => mainStore.dimmingEnabled)
const toggleDimming = () => {
  if (!theaterMode.value) {
    mainStore.toggleDimming()
  }
}

const compressorEnabled = computed({
  get: () => playerStore.compressorEnabled,
  set: (value) => playerStore.updateCompressor(value)
})

const mirrorEnabled = computed({
  get: () => playerStore.mirrorEnabled,
  set: (value) => playerStore.updateMirror(value)
})

const applyMirrorEffect = (enabled) => {
  if (!playerIframe.value) return

  try {
    const iframe = playerIframe.value
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (!iframeDoc) return

    const videos = iframeDoc.querySelectorAll('video')
    if (videos.length > 0) {
      videos.forEach((video) => {
        if (enabled) {
          video.style.transform = 'scaleX(-1)'
        } else {
          video.style.transform = 'scaleX(1)'
        }
      })

      currentMirrorState.value = enabled

      if (isElectron.value) {
        const message = enabled ? 'Зеркало включено' : 'Зеркало отключено'
        window.electronAPI.showToast(message)
      }
    }
  } catch {
    // ignore
  }
}

const startMirrorMonitoring = () => {
  if (mirrorCheckInterval.value) {
    clearInterval(mirrorCheckInterval.value)
  }

  mirrorCheckInterval.value = setInterval(() => {
    if (!playerIframe.value) return

    try {
      const iframe = playerIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      if (!iframeDoc) return

      const videos = iframeDoc.querySelectorAll('video')
      if (videos.length > 0) {
        const video = videos[0]

        const transform = video.style.transform
        const isCurrentlyMirrored = transform === 'scaleX(-1)'

        if (mirrorEnabled.value && !isCurrentlyMirrored) {
          video.style.transform = 'scaleX(-1)'
          currentMirrorState.value = true
        } else if (!mirrorEnabled.value && isCurrentlyMirrored) {
          video.style.transform = 'scaleX(1)'
          currentMirrorState.value = false
        }

        if (currentVideoElement.value !== video) {
          currentVideoElement.value = null
          currentCompressorState.value = false

          if (compressorEnabled.value) {
            setTimeout(() => {
              applyCompressorEffect(true)
            }, 500)
          }
        } else if (compressorEnabled.value !== currentCompressorState.value && mediaSource.value) {
          console.log('Compressor state mismatch, reapplying')
          applyCompressorEffect(compressorEnabled.value)
        }
      }
    } catch {
      // ignore
    }
  }, 1000)
}

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
          videoOverlayEnabled.value &&
          !currentOverlayElement.value &&
          !overlayCreationInProgress.value
        ) {
          const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
          if (timeSinceLoad >= 3000) {
            try {
              createVideoOverlay(iframeDoc, video)
            } catch (error) {
              console.log('Error creating overlay:', error)
              overlayCreationInProgress.value = false
            }
          }
        }

        if (isElectron.value && !videoOverlayEnabled.value && currentOverlayElement.value) {
          setTimeout(() => {
            if (!videoOverlayEnabled.value && currentOverlayElement.value) {
              removeVideoOverlay()
            }
          }, 100)
        }

        if (isElectron.value && props.movieInfo?.nudity_timings) {
          const currentTime = video.currentTime
          const selectedTimings = []
          const activeTimingIds = []
          const isAutoBlurEnabled = blurIntervals.length > 0

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

                  if (!isAutoBlurEnabled) {
                    for (const [start, end] of parsedRanges) {
                      let status = 'normal'
                      if (currentTime >= start && currentTime <= end) {
                        status = 'active'
                        activeTimingIds.push(timing.id)
                      } else if (start > currentTime && start - currentTime <= 20) {
                        status = 'upcoming'
                      }

                      intervals.push({
                        text: `[${formatSecondsToTime(start)}-${formatSecondsToTime(end)}]`,
                        status: status
                      })
                    }
                  } else {
                    for (const [start, end] of parsedRanges) {
                      intervals.push({
                        text: `[${formatSecondsToTime(start)}-${formatSecondsToTime(end)}]`,
                        status: 'normal'
                      })
                    }
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
        }

        if (isElectron.value && currentOverlayElement.value && videoOverlayEnabled.value) {
          updateVideoOverlay()
        }

        if (!video.paused) {
          const currentTime = video.currentTime
          const duration = video.duration
          const progress = duration > 0 ? (currentTime / duration) * 100 : 0

          if (!hasPlayedFor5Seconds.value && currentTime >= 5) {
            if (!playStartTime.value) {
              const calculatedStartTime = Date.now() - currentTime * 1000
              const now = Date.now()
              const maxPastTime = 24 * 60 * 60 * 1000

              if (calculatedStartTime > now - maxPastTime && calculatedStartTime <= now) {
                playStartTime.value = calculatedStartTime
              } else {
                playStartTime.value = now
              }
            }
            hasPlayedFor5Seconds.value = true
          }

          if (isDebug) {
            console.log(
              `Video position: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s (${progress.toFixed(1)}%)`
            )

            if (blurIntervals.length > 0) {
              const activeIntervals = blurIntervals
                .map(
                  ([start, end]) => `${formatSecondsToTime(start)} - ${formatSecondsToTime(end)}`
                )
                .join(', ')
              console.log(`Active blur intervals: [${activeIntervals}]`)
            }
          }

          let shouldBlur = false
          for (const [start, end] of blurIntervals) {
            if (currentTime >= start && currentTime <= end) {
              shouldBlur = true
              break
            }
          }

          if (shouldBlur && !blurApplied && isElectron.value) {
            window.electronAPI.sendHotKey('F2')
            blurApplied = true
            console.log('Blur applied at', currentTime.toFixed(2), 'seconds')
          } else if (!shouldBlur && blurApplied) {
            window.electronAPI.sendHotKey('F2')
            blurApplied = false
            console.log('Blur removed at', currentTime.toFixed(2), 'seconds')
          }
        }
      }
    } catch (error) {
      console.log('Error monitoring video position:', error)
    }
  }, 100)
}

const onIframeLoad = () => {
  iframeLoading.value = false
  window.iframeLoadTime = Date.now()
  playStartTime.value = null
  hasPlayedFor5Seconds.value = false
  startMirrorMonitoring()
  startVideoPositionMonitoring()

  if (isElectron.value && videoOverlayEnabled.value && !currentOverlayElement.value) {
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
        console.log('Error creating overlay on iframe load:', error)
        overlayCreationInProgress.value = false
      }
    }, 3000)
  }
}

const onKeyDown = (event) => {
  if (event.key === 'Escape' && theaterMode.value) {
    toggleTheaterMode()
  } else if (event.altKey && event.keyCode === 84) {
    toggleTheaterMode()
  }
}

const setAspectRatio = (ratio) => {
  aspectRatio.value = ratio
  setTimeout(() => {
    if (isCentered.value) centerPlayer()
  }, 310)
}

const openAppLink = () => {
  const appUrl = `reyohoho://#${kp_id.value}`
  try {
    window.location.href = appUrl
  } catch (e) {
    console.error('Ошибка при открытии ссылки:', e)
  }
}

const copyMovieLink = () => {
  const movieLink = window.location.href
  navigator.clipboard.writeText(movieLink).then(() => {})
  notificationRef.value.showNotification('Ссылка на фильм скопирована')
}

function cleanName(name) {
  const cleanedName = name
    .replace(/^REYOHOHO_PLAYER>HDREZKA>/, 'HDRezka - ')
    .replace(/KODIK>/, 'Kodik - ')
    .trim()
  return cleanedName
}

const cleanupAudioContext = () => {
  try {
    if (mediaSource.value) {
      mediaSource.value.disconnect()
      mediaSource.value = null
    }
    if (audioContext.value) {
      audioContext.value.close()
      audioContext.value = null
    }
    compressorNode.value = null
    gainNode.value = null
    bypassGainNode.value = null
    currentVideoElement.value = null
    currentCompressorState.value = false
  } catch (e) {
    console.log('Error cleaning up audio context:', e)
  }
}

const handlePlayerSelect = (player) => {
  if (selectedPlayerInternal.value?.key === player.key) {
    closePlayerModal()
    return
  }

  selectedPlayerInternal.value = player
  iframeLoading.value = true
  currentMirrorState.value = false
  currentCompressorState.value = false
  currentVideoElement.value = null
  playStartTime.value = null
  hasPlayedFor5Seconds.value = false
  if (currentOverlayElement.value) {
    removeVideoOverlay()
  }
  if (mirrorCheckInterval.value) {
    clearInterval(mirrorCheckInterval.value)
    mirrorCheckInterval.value = null
  }
  if (videoPositionInterval.value) {
    clearInterval(videoPositionInterval.value)
    videoPositionInterval.value = null
  }
  if (!player.key.toLowerCase().includes('torrents')) {
    playerStore.updatePreferredPlayer(normalizeKey(player.key))
  }
  emit('update:selectedPlayer', player)
}

watch(selectedPlayerInternal, (newVal) => {
  if (newVal) {
    iframeLoading.value = true
    currentMirrorState.value = false
    currentCompressorState.value = false
    currentVideoElement.value = null
    playStartTime.value = null
    hasPlayedFor5Seconds.value = false
    if (currentOverlayElement.value) {
      removeVideoOverlay()
    }
    if (mirrorCheckInterval.value) {
      clearInterval(mirrorCheckInterval.value)
      mirrorCheckInterval.value = null
    }
    if (videoPositionInterval.value) {
      clearInterval(videoPositionInterval.value)
      videoPositionInterval.value = null
    }
    if (!newVal.key.toLowerCase().includes('torrents')) {
      playerStore.updatePreferredPlayer(normalizeKey(newVal.key))
    }
    emit('update:selectedPlayer', newVal)
  }
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      kp_id.value = newKpId
      currentMirrorState.value = false
      currentCompressorState.value = false
      currentVideoElement.value = null
      playStartTime.value = null
      hasPlayedFor5Seconds.value = false
      if (currentOverlayElement.value) {
        removeVideoOverlay()
      }
      if (mirrorCheckInterval.value) {
        clearInterval(mirrorCheckInterval.value)
        mirrorCheckInterval.value = null
      }
      if (videoPositionInterval.value) {
        clearInterval(videoPositionInterval.value)
        videoPositionInterval.value = null
      }
      lastOverlayTimingsCount.value = 0
      if (isCentered.value) centerPlayer()
    }
  },
  { immediate: true }
)

watch(videoOverlayEnabled, (enabled) => {
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
              if (timeSinceLoad >= 3000) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(checkAndCreate, 3000 - timeSinceLoad)
              }
            }
          }
        } catch (error) {
          console.log('Error creating overlay via watcher:', error)
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
      if (!videoOverlayEnabled.value) {
        videoOverlayEnabled.value = true
        if (window.electronAPI) {
          window.electronAPI.showToast('Оверлей автоматически включён - добавлены тайминги')
        }
      }
    }
  },
  { deep: true }
)

const aspectRatios = ['16:9', '12:5', '4:3']

const cycleAspectRatio = () => {
  const currentIndex = aspectRatios.indexOf(aspectRatio.value)
  const nextIndex = (currentIndex + 1) % aspectRatios.length
  setAspectRatio(aspectRatios[nextIndex])
}

const getListStatus = (listType) => {
  const statusMap = {
    [USER_LIST_TYPES_ENUM.FAVORITE]: props.movieInfo?.lists?.isFavorite || false,
    [USER_LIST_TYPES_ENUM.HISTORY]: props.movieInfo?.lists?.isHistory || false,
    [USER_LIST_TYPES_ENUM.LATER]: props.movieInfo?.lists?.isLater || false,
    [USER_LIST_TYPES_ENUM.COMPLETED]: props.movieInfo?.lists?.isCompleted || false,
    [USER_LIST_TYPES_ENUM.ABANDONED]: props.movieInfo?.lists?.isAbandoned || false,
    [USER_LIST_TYPES_ENUM.WATCHING]: props.movieInfo?.lists?.isWatching || false
  }

  return statusMap[listType] ?? false
}

const toggleList = async (type) => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a>',
      5000,
      { onClick: openLogin }
    )
    return
  }
  let hasError = false
  try {
    const listNames = {
      [USER_LIST_TYPES_ENUM.FAVORITE]: 'избранное',
      [USER_LIST_TYPES_ENUM.HISTORY]: 'историю',
      [USER_LIST_TYPES_ENUM.LATER]: 'список "Смотреть позже"',
      [USER_LIST_TYPES_ENUM.COMPLETED]: 'список "Просмотрено"',
      [USER_LIST_TYPES_ENUM.ABANDONED]: 'список "Брошено"',
      [USER_LIST_TYPES_ENUM.WATCHING]: 'список "Смотрю"'
    }

    if (getListStatus(type)) {
      await delFromList(kp_id.value, type)
      notificationRef.value.showNotification(`Удалено из ${listNames[type]}`)
    } else {
      await addToList(kp_id.value, type)
      notificationRef.value.showNotification(`Добавлено в ${listNames[type]}`)
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    notificationRef.value.showNotification(`${message} ${code}`)
  }
  if (!hasError) {
    emit('update:movieInfo')
  }
}

const openLogin = () => {
  router.push('/login')
}

const showFavoriteTooltip = computed(() => playerStore.showFavoriteTooltip)

const openSettings = () => {
  router.push('/settings')
  hideTooltip()
}

const togglePiP = async () => {
  if (!isElectron.value) {
    showMessageToast('Доступно только в приложении ReYohoho Desktop')
    window.open('https://t.me/ReYohoho/126', '_blank')
    return
  }

  if (!playerIframe.value) return

  try {
    const iframe = playerIframe.value
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (!iframeDoc) return

    const video = iframeDoc.querySelector('video')
    if (!video) return

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      } else {
        showMessageToast('Ваш браузер не поддерживает режим "Картинка в картинке"')
      }
    }
  } catch (error) {
    console.error('Error toggling PiP:', error)
    showMessageToast('Не удалось включить режим "Картинка в картинке"')
  }
}

const toggleVideoOverlay = () => {
  videoOverlayEnabled.value = !videoOverlayEnabled.value

  if (!videoOverlayEnabled.value) {
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
              if (timeSinceLoad >= 3000) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(createOverlayAfterDelay, 3000 - timeSinceLoad)
              }
            }
          }
        } catch (error) {
          console.log('Error creating overlay:', error)
          overlayCreationInProgress.value = false
        }
      }
    }
    createOverlayAfterDelay()
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
  modal.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.8) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  `

  const modalContent = iframeDoc.createElement('div')
  modalContent.style.cssText = `
    background: rgba(30, 30, 30, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border-radius: 16px !important;
    padding: 32px !important;
    max-width: 400px !important;
    width: 90% !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5) !important;
  `

  modalContent.innerHTML = `
    <h3 style="color: #ff6b35; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; text-align: center;">Настройки оверлея</h3>
    
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <label style="display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);">
        <input type="checkbox" id="showTitle" ${settings.showTitle ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ff6b35;">
        <span style="font-size: 16px;">Показывать название фильма</span>
      </label>
      
      <label style="display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);">
        <input type="checkbox" id="showDuration" ${settings.showDuration ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ff6b35;">
        <span style="font-size: 16px;">Показывать продолжительность</span>
      </label>
      
      <label style="display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);">
        <input type="checkbox" id="showStartTime" ${settings.showStartTime ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ff6b35;">
        <span style="font-size: 16px;">Показывать время начала</span>
      </label>
    </div>
    
    <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: center;">
      <button id="resetStartTime" style="background: rgba(255, 107, 53, 0.2); color: #ff6b35; border: 1px solid #ff6b35; border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
        Обновить время начала
      </button>
      <button id="saveSettings" style="background: #ff6b35; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: 500; transition: all 0.3s ease;">
        Сохранить
      </button>
      <button id="cancelSettings" style="background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
        Отмена
      </button>
    </div>
  `

  modal.appendChild(modalContent)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove()
    }
  })

  modalContent.querySelector('#resetStartTime').addEventListener('click', () => {
    playStartTime.value = Date.now() - currentVideoTime.value * 1000
    hasPlayedFor5Seconds.value = true
    window.electronAPI?.showToast('Время начала обновлено')
  })

  modalContent.querySelector('#saveSettings').addEventListener('click', () => {
    const newSettings = {
      showTitle: modalContent.querySelector('#showTitle').checked,
      showDuration: modalContent.querySelector('#showDuration').checked,
      showStartTime: modalContent.querySelector('#showStartTime').checked
    }
    overlaySettings.value = newSettings
    window.electronAPI?.showToast('Настройки оверлея сохранены')
    modal.remove()
  })

  modalContent.querySelector('#cancelSettings').addEventListener('click', () => {
    modal.remove()
  })

  const buttons = modalContent.querySelectorAll('button')
  buttons.forEach((button) => {
    button.addEventListener('mouseenter', () => {
      if (button.id === 'saveSettings') {
        button.style.background = '#e55a2b'
        button.style.transform = 'translateY(-1px)'
      } else if (button.id === 'resetStartTime') {
        button.style.background = 'rgba(255, 107, 53, 0.3)'
      } else {
        button.style.background = 'rgba(255, 255, 255, 0.15)'
      }
    })
    button.addEventListener('mouseleave', () => {
      if (button.id === 'saveSettings') {
        button.style.background = '#ff6b35'
        button.style.transform = 'translateY(0)'
      } else if (button.id === 'resetStartTime') {
        button.style.background = 'rgba(255, 107, 53, 0.2)'
      } else {
        button.style.background = 'rgba(255, 255, 255, 0.1)'
      }
    })
  })

  iframeDoc.body.appendChild(modal)
}

const formatPlayStartTime = (timestamp) => {
  const now = new Date()
  const startTime = new Date(timestamp)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startToday = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())

  const timeStr = startTime.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (startToday.getTime() === today.getTime()) {
    return timeStr
  } else {
    const dateStr = startTime.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit'
    })
    return `${dateStr} ${timeStr}`
  }
}

const createVideoOverlay = (iframeDoc, video) => {
  if (!videoOverlayEnabled.value) {
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
    overlay.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 999999999 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      visibility: visible !important;
      opacity: 1 !important;
    `
  }

  const mainInfo = iframeDoc.createElement('div')
  mainInfo.style.cssText = `
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 70%, transparent 100%) !important;
    color: white !important;
    padding: 20px !important;
    text-align: left !important;
    pointer-events: none !important;
  `

  const movieTitle = iframeDoc.createElement('div')
  movieTitle.style.cssText = `
    font-size: 20px !important;
    font-weight: 600 !important;
    margin-bottom: 8px !important;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
    line-height: 1.2 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    padding: 8px 12px !important;
    border-radius: 6px !important;
    display: inline-block !important;
    color: rgba(255, 255, 255, 0.6) !important;
  `

  const videoProgress = iframeDoc.createElement('div')
  videoProgress.style.cssText = `
    font-size: 18px !important;
    font-weight: 500 !important;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
    color: rgba(255, 255, 255, 0.6) !important;
  `

  const timingsPanel = iframeDoc.createElement('div')
  timingsPanel.style.cssText = `
    position: absolute !important;
    top: 20px !important;
    right: 110px !important;
    backdrop-filter: blur(10px) !important;
    border-radius: 12px !important;
    padding: 16px !important;
    min-width: 280px !important;
    max-width: 400px !important;
    pointer-events: none !important;
    display: none !important;
  `

  const timingsContent = iframeDoc.createElement('div')
  timingsContent.style.cssText = `
    font-size: 14px !important;
    color: rgba(255, 255, 255, 0.6) !important;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
    line-height: 1.4 !important;
    word-wrap: break-word !important;
  `

  const controlsContainer = iframeDoc.createElement('div')
  controlsContainer.style.cssText = `
    position: absolute !important;
    top: 20px !important;
    right: 20px !important;
    display: flex !important;
    gap: 8px !important;
    pointer-events: all !important;
  `

  const settingsBtn = iframeDoc.createElement('button')
  settingsBtn.style.cssText = `
    background: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 50% !important;
    width: 40px !important;
    height: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    font-size: 18px !important;
  `
  settingsBtn.innerHTML = '⚙️'
  settingsBtn.title = 'Настройки оверлея'

  const toggleBtn = iframeDoc.createElement('button')
  toggleBtn.style.cssText = `
    background: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 50% !important;
    width: 40px !important;
    height: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    font-size: 18px !important;
  `
  toggleBtn.innerHTML = '👁️'
  toggleBtn.title = 'Отключить оверлей'

  toggleBtn.addEventListener('click', () => {
    videoOverlayEnabled.value = false
  })

  settingsBtn.addEventListener('click', () => {
    showOverlaySettings()
  })
  ;[settingsBtn, toggleBtn].forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#ff6b35'
      btn.style.borderColor = '#ff6b35'
      btn.style.transform = 'scale(1.1)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.8)'
      btn.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      btn.style.transform = 'scale(1)'
    })
  })

  controlsContainer.appendChild(settingsBtn)
  controlsContainer.appendChild(toggleBtn)

  timingsPanel.appendChild(timingsContent)

  mainInfo.appendChild(movieTitle)
  mainInfo.appendChild(videoProgress)

  overlay.appendChild(mainInfo)
  overlay.appendChild(timingsPanel)
  overlay.appendChild(controlsContainer)

  controlsContainer.style.transition = 'opacity 0.3s ease'
  controlsContainer.style.opacity = '0.8'
  controlsContainer.style.visibility = 'visible'

  mainInfo.style.transition = 'opacity 0.3s ease'
  let hideMainInfoTimeout = null

  const handleMouseMove = () => {
    controlsContainer.style.opacity = '1'
    mainInfo.style.opacity = '0'

    clearTimeout(overlayControlsTimeout.value)
    clearTimeout(hideMainInfoTimeout)

    overlayControlsTimeout.value = setTimeout(() => {
      controlsContainer.style.opacity = '0.8'
    }, 3000)

    hideMainInfoTimeout = setTimeout(() => {
      mainInfo.style.opacity = '1'
    }, 2000)
  }

  iframeDoc.addEventListener('mousemove', handleMouseMove)

  overlay.addEventListener('mouseenter', () => {
    controlsContainer.style.opacity = '1'
    mainInfo.style.opacity = '0'
    clearTimeout(hideMainInfoTimeout)
  })

  overlay.addEventListener('mouseleave', () => {
    clearTimeout(overlayControlsTimeout.value)
    clearTimeout(hideMainInfoTimeout)
    controlsContainer.style.opacity = '0.8'
    mainInfo.style.opacity = '1'
  })

  overlay._mouseHandler = handleMouseMove

  const findBestContainer = (videoElement) => {
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
    const videoRect = overlay._videoElement.getBoundingClientRect()
    const containerRect = overlay._targetContainer.getBoundingClientRect()

    const relativeTop = videoRect.top - containerRect.top
    const relativeLeft = videoRect.left - containerRect.left

    overlay.style.cssText = `
      position: absolute !important;
      top: ${relativeTop}px !important;
      left: ${relativeLeft}px !important;
      width: ${videoRect.width}px !important;
      height: ${videoRect.height}px !important;
      pointer-events: none !important;
      z-index: 999999999 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      visibility: visible !important;
      opacity: 1 !important;
      box-sizing: border-box !important;
    `
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
    if (!currentOverlayElement.value || !videoOverlayEnabled.value) {
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
        console.log('Error re-adding overlay to DOM:', e)
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
      const videoRect = overlay._videoElement.getBoundingClientRect()
      const currentWidth = parseInt(computedStyle.width) || 0
      const currentHeight = parseInt(computedStyle.height) || 0

      if (
        Math.abs(currentWidth - videoRect.width) > 5 ||
        Math.abs(currentHeight - videoRect.height) > 5
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
            if (currentOverlayElement.value && videoOverlayEnabled.value) {
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
    if (currentOverlayElement.value && videoOverlayEnabled.value) {
      applyOverlayStyles()
    }
  }

  iframeDoc.defaultView.addEventListener('resize', resizeHandler)

  overlay._monitorInterval = overlayMonitorInterval
  overlay._mutationObserver = overlayObserver
  overlay._resizeHandler = resizeHandler
  overlay._iframeDoc = iframeDoc

  const initialProtectionInterval = setInterval(() => {
    if (!currentOverlayElement.value || !videoOverlayEnabled.value) {
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
  if (!currentOverlayElement.value || !videoOverlayEnabled.value) {
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
    overlay.style.display = 'flex !important'
    overlay.style.visibility = 'visible !important'
  }

  const movieTitle = mainInfo.children[0]
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
  } else {
    movieTitle.style.display = 'none'
  }

  const videoProgress = mainInfo.children[1]
  let progressHtml = ''

  if (overlaySettings.value.showDuration) {
    const currentTimeFormatted = formatSecondsToTime(currentVideoTime.value)
    const totalTimeFormatted = formatSecondsToTime(totalVideoDuration.value)
    progressHtml = `
      <span style="font-family: 'Courier New', monospace; background: rgba(0, 0, 0, 0.6); padding: 2px 8px; border-radius: 4px; color: rgba(255, 255, 255, 0.6);">${currentTimeFormatted}</span>
      <span style="opacity: 0.6;">/</span>
      <span style="font-family: 'Courier New', monospace; background: rgba(0, 0, 0, 0.6); padding: 2px 8px; border-radius: 4px; color: rgba(255, 255, 255, 0.6);">${totalTimeFormatted}</span>
    `
  }

  if (overlaySettings.value.showStartTime && playStartTime.value && hasPlayedFor5Seconds.value) {
    if (progressHtml) {
      progressHtml += `
      <span style="opacity: 0.6; margin: 0 4px;">•</span>
      `
    }
    const formattedTime = formatPlayStartTime(playStartTime.value)
    progressHtml += `
      <span style="color: rgba(255, 255, 255, 0.6); font-size: 16px; line-height: 1; vertical-align: middle;">Начало:</span>
      <span style="font-family: 'Courier New', monospace; background: rgba(0, 0, 0, 0.6); padding: 2px 8px; border-radius: 4px; color: rgba(255, 255, 255, 0.6); font-size: 16px; line-height: 1; vertical-align: middle;">${formattedTime}</span>
    `
  }

  if (progressHtml) {
    videoProgress.style.display = 'flex'
    videoProgress.innerHTML = progressHtml
  } else {
    videoProgress.style.display = 'none'
  }

  if (activeTimingTexts.value.length > 0) {
    const timingsContent = timingsPanel.children[0]
    timingsContent.innerHTML = ''

    const header = iframeDoc.createElement('span')
    header.textContent = 'Тайминги: '
    header.style.color = 'rgba(255, 255, 255, 0.6)'
    timingsContent.appendChild(header)

    activeTimingTexts.value.forEach((timing, timingIndex) => {
      if (timingIndex > 0) {
        const separator = iframeDoc.createElement('span')
        separator.textContent = ', '
        separator.style.color = 'rgba(255, 255, 255, 0.6)'
        timingsContent.appendChild(separator)
      }

      timing.intervals.forEach((interval, intervalIndex) => {
        if (intervalIndex > 0) {
          const intervalSeparator = iframeDoc.createElement('span')
          intervalSeparator.textContent = ', '
          intervalSeparator.style.color = 'rgba(255, 255, 255, 0.6)'
          timingsContent.appendChild(intervalSeparator)
        }

        const intervalSpan = iframeDoc.createElement('span')
        intervalSpan.textContent = interval.text

        if (interval.status === 'active') {
          intervalSpan.style.color = '#ff4444'
          intervalSpan.style.fontWeight = 'bold'
        } else if (interval.status === 'upcoming') {
          intervalSpan.style.color = '#ff6b35'
          intervalSpan.style.fontWeight = '500'
        } else {
          intervalSpan.style.color = 'rgba(255, 255, 255, 0.6)'
        }

        timingsContent.appendChild(intervalSpan)
      })
    })

    timingsPanel.style.display = 'block'
  } else {
    timingsPanel.style.display = 'none'
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
      if (currentOverlayElement.value._mouseHandler && currentOverlayElement.value._iframeDoc) {
        currentOverlayElement.value._iframeDoc.removeEventListener(
          'mousemove',
          currentOverlayElement.value._mouseHandler
        )
      }

      currentOverlayElement.value.remove()
    } catch (e) {
      console.log('Error removing overlay:', e)
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
  if (isMobile.value) aspectRatio.value = '4:3'
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  window.addEventListener('resize', updateTooltipPosition)
  if (isCentered.value) centerPlayer()

  window.toggleCompressor = toggleCompressor
  window.toggleMirror = toggleMirror

  if (isElectron.value) {
    overlayTimingsCheckInterval.value = setInterval(() => {
      const currentCount = window.overlayNudityTimings ? window.overlayNudityTimings.length : 0

      if (currentCount > lastOverlayTimingsCount.value) {
        lastOverlayTimingsCount.value = currentCount

        if (!videoOverlayEnabled.value) {
          videoOverlayEnabled.value = true
          if (window.electronAPI) {
            window.electronAPI.showToast('Оверлей автоматически включён - добавлены тайминги')
          }
        }
      } else {
        lastOverlayTimingsCount.value = currentCount
      }
    }, 1000)
  }

  if (isElectron.value && videoOverlayEnabled.value) {
    const initializeOverlay = () => {
      if (playerIframe.value && !currentOverlayElement.value) {
        try {
          const iframe = playerIframe.value
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
          if (iframeDoc) {
            const video = iframeDoc.querySelector('video')
            if (video) {
              const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
              if (timeSinceLoad >= 3000) {
                createVideoOverlay(iframeDoc, video)
              } else {
                setTimeout(initializeOverlay, 3000 - timeSinceLoad)
              }
            } else {
              const checkVideo = setInterval(() => {
                try {
                  const video = iframeDoc.querySelector('video')
                  if (video) {
                    clearInterval(checkVideo)
                    const timeSinceLoad = Date.now() - (window.iframeLoadTime || 0)
                    if (timeSinceLoad >= 3000) {
                      createVideoOverlay(iframeDoc, video)
                    } else {
                      setTimeout(() => createVideoOverlay(iframeDoc, video), 3000 - timeSinceLoad)
                    }
                  }
                } catch (e) {
                  console.log('Waiting for video element...', e)
                }
              }, 1000)
              setTimeout(() => clearInterval(checkVideo), 15000)
            }
          }
        } catch (error) {
          console.log('Error initializing overlay on mount:', error)
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
  window.removeEventListener('mousemove', showCloseButton)
  document.removeEventListener('keydown', onKeyDown)
  document.body.classList.remove('no-scroll')

  if (mirrorCheckInterval.value) {
    clearInterval(mirrorCheckInterval.value)
  }
  if (videoPositionInterval.value) {
    clearInterval(videoPositionInterval.value)
  }
  if (overlayTimingsCheckInterval.value) {
    clearInterval(overlayTimingsCheckInterval.value)
  }
  removeVideoOverlay()
  cleanupAudioContext()

  delete window.toggleCompressor
  delete window.toggleMirror
})
</script>

<style scoped>
.players-list {
  width: 100%;
  max-width: 800px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: auto;
  margin-bottom: 10px;
}

/* Стили для кнопки выбора плеера */
.player-btn {
  display: flex;
  align-items: center;
  justify-content: left;
  background: #3a3a3a;
  color: #fff;
  border: 2px solid #505050;
  border-radius: 5px;
  padding: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  width: 100%;
  max-width: 800px;
  text-align: left;
  font-size: 16px;
}

.player-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.player-btn:active {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.player-btn:focus {
  outline: none;
  box-shadow: 0 0 5px var(--accent-color);
}

.player-container {
  width: 100%;
  transition:
    max-width 0.3s ease-in-out,
    max-height 0.3s ease-in-out;
  overflow: hidden;
  padding-bottom: 10px;
}

.iframe-wrapper {
  transition:
    padding-top 0.3s ease-in-out,
    transform 0.3s ease-in-out;
  width: 100%;
}

.responsive-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  z-index: 4;
}

.responsive-iframe.dimmed {
  z-index: 7;
}

/* Стили для театрального режима */
.player-container.theater-mode {
  position: fixed;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: #000;
  margin: 0;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 7;
}

.player-container.theater-mode .iframe-wrapper {
  width: 100% !important;
  height: 100% !important;
  padding-top: 0 !important;
  flex-grow: 1;
}

.close-theater-btn {
  position: fixed;
  top: 20px;
  right: 80px;
  background: rgba(255, 0, 0, 0.7);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    background 0.3s,
    opacity 0.3s;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 8;
}

.close-theater-btn.visible {
  opacity: 1;
}

/* Делаем кнопку видимой при наведении на зону */
.close-theater-btn:hover,
.close-theater-btn::before:hover {
  background: var(--accent-color);
  opacity: 1;
}

html.no-scroll {
  overflow: hidden;
}

/* Блока управления */
.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0 auto;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 4;
}

.main-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #444;
  color: #fff;
  border: none;
  padding: 12px;
  font-size: 18px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  z-index: 4;
  width: 50px;
  height: 50px;
}

.controls button:hover {
  background-color: var(--accent-color);
  transform: translateY(-3px);
  box-shadow: 0 4px 10px var(--accent-semi-transparent);
}

.controls button:active {
  transform: translateY(0);
  box-shadow: none;
}

.controls button.active {
  background-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.material-icons {
  font-size: 24px;
}

.tooltip-container {
  position: relative;
  display: inline-block;
}

.custom-tooltip {
  position: absolute;
  left: 50%;
  background-color: rgba(30, 30, 30, 0.95);
  color: #fff;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(8px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background-color: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  z-index: -1;
}

.custom-tooltip[style*='bottom: 100%']::before {
  bottom: -5px;
  top: auto;
}

.custom-tooltip[style*='top: 100%']::before {
  top: -5px;
  bottom: auto;
}

.tooltip-container:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.advanced-tooltip {
  white-space: normal;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  top: calc(100% + 12px);
  pointer-events: all;
  text-align: center;
  min-width: 240px;
  background-color: rgba(30, 30, 30, 0.98);
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
  transform: translateX(-50%) translateY(8px);
}

.advanced-tooltip::before {
  top: -6px;
  width: 12px;
  height: 12px;
}

.tooltip-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  margin-top: 4px;
}

.aspect-ratio-dropdown {
  min-width: fit-content;
  width: max-content;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: rgba(30, 30, 30, 0.98);
  border-radius: 16px;
}

.aspect-ratio-option {
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  width: 100%;
}

.aspect-ratio-option:hover {
  background-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--accent-semi-transparent);
}

.aspect-ratio-option.active {
  background-color: var(--accent-color);
  color: white;
  font-weight: 500;
  box-shadow: 0 2px 12px var(--accent-semi-transparent);
}

.fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10;
}

.theater-mode-lock {
  pointer-events: none;
}

.theater-mode-unlock {
  pointer-events: all;
}

.aspect-ratio-dropdown-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  min-width: 60px;
}

.current-ratio {
  font-size: 14px;
  font-weight: 500;
}

.list-buttons-container {
  position: relative;
}

.list-buttons-dropdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  min-width: 240px;
  background-color: rgba(30, 30, 30, 0.98);
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
}

.list-button-item {
  width: 100%;
}

.list-button-item button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background-color: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
}

.list-button-item button:hover {
  background-color: var(--accent-color);
  transform: translateX(4px);
  box-shadow: 0 2px 8px var(--accent-semi-transparent);
}

.list-button-item button.active {
  background-color: var(--accent-color);
  color: white;
  box-shadow: 0 2px 12px var(--accent-semi-transparent);
}

.button-label {
  font-size: 15px;
  font-weight: 500;
  flex: 1;
}

.list-button-item .material-icons {
  font-size: 20px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-list-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 0 auto;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

@media (max-width: 768px) {
  .mobile-list-buttons {
    margin-top: 10px;
  }
}

.shortcut-hint {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
  font-weight: 400;
}

.electron-only {
  background-color: #333 !important;
  opacity: 0.6;
  cursor: not-allowed;
}

.electron-only:hover {
  transform: none !important;
  box-shadow: none !important;
  background-color: #333 !important;
}

.custom-tooltip:has(+ .electron-only) {
  color: rgba(255, 255, 255, 0.7);
}

.favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #444;
  color: #fff;
  border: none;
  padding: 12px;
  font-size: 18px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  z-index: 4;
  width: 50px;
  height: 50px;
  position: relative;
}

.favorite-btn:hover {
  background-color: var(--accent-color);
  transform: translateY(-3px);
  box-shadow: 0 4px 10px var(--accent-semi-transparent);
}

.dropdown-arrow {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: 16px;
  opacity: 0.7;
  pointer-events: none;
  transition: all 0.3s ease;
}

.dropdown-arrow.highlighted {
  opacity: 1;
  color: var(--accent-color);
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.desktop-list-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin: 0 auto;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.desktop-list-buttons .tooltip-container {
  margin: 0;
}

.desktop-list-buttons button {
  margin: 0;
}

.tooltip-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.tooltip-hint .material-icons {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
}

.settings-link {
  color: var(--accent-color);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.settings-link:hover {
  color: var(--accent-hover);
}

.auth-link {
  color: var(--accent-color);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.auth-link:hover {
  color: var(--accent-hover);
}
</style>
