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
      <div
        class="iframe-wrapper"
        :class="{ pm_video: shouldShowPmVideo }"
        :style="!theaterMode ? iframeWrapperStyle : {}"
      >
        <!-- <div class="fullscreen" @mousemove="showCloseButton"></div> -->

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
        <SpinnerLoading v-if="iframeLoading" />
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

const audioContext = ref(null)
const compressorNode = ref(null)
const mediaSource = ref(null)
const gainNode = ref(null)
const bypassGainNode = ref(null)
const currentVideoElement = ref(null)

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
          console.log('Video element changed, reinitializing compressor')
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

const onIframeLoad = () => {
  iframeLoading.value = false
  startMirrorMonitoring()
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

const shouldShowPmVideo = computed(() => {
  if (isElectron.value) return false
  return !selectedPlayerInternal.value?.key?.toUpperCase().includes('TORRENTS')
})

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
  if (mirrorCheckInterval.value) {
    clearInterval(mirrorCheckInterval.value)
    mirrorCheckInterval.value = null
  }
  playerStore.updatePreferredPlayer(normalizeKey(player.key))
  emit('update:selectedPlayer', player)
}

watch(selectedPlayerInternal, (newVal) => {
  if (newVal) {
    iframeLoading.value = true
    currentMirrorState.value = false
    currentCompressorState.value = false
    currentVideoElement.value = null
    if (mirrorCheckInterval.value) {
      clearInterval(mirrorCheckInterval.value)
      mirrorCheckInterval.value = null
    }
    playerStore.updatePreferredPlayer(normalizeKey(newVal.key))
    emit('update:selectedPlayer', newVal)

    if (newVal.key.toUpperCase().includes('TORRENTS')) {
      const rocketmeFon = document.querySelector('.rocketme_fon')
      if (rocketmeFon) {
        rocketmeFon.style.display = 'none'
      }
      const pmPreloader = document.querySelector('.pm_preloader')
      if (pmPreloader) {
        pmPreloader.style.display = 'none'
      }
    } else {
      const rocketmeFon = document.querySelector('.rocketme_fon')
      if (rocketmeFon) {
        rocketmeFon.style.display = ''
      }
      const pmPreloader = document.querySelector('.pm_preloader')
      if (pmPreloader) {
        pmPreloader.style.display = ''
      }
    }
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
      if (mirrorCheckInterval.value) {
        clearInterval(mirrorCheckInterval.value)
        mirrorCheckInterval.value = null
      }
      if (isCentered.value) centerPlayer()
    }
  },
  { immediate: true }
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

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  if (isMobile.value) aspectRatio.value = '4:3'
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  window.addEventListener('resize', updateTooltipPosition)
  if (isCentered.value) centerPlayer()
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
  cleanupAudioContext()
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
