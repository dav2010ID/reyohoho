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
    <div v-if="!isMobile" class="controls">
      <div class="tooltip-container">
        <button
          class="dimming-btn"
          :class="{ active: dimmingEnabled }"
          @mouseenter="showTooltip('dimming')"
          @mouseleave="activeTooltip = null"
          @click="toggleDimming"
        >
          <span class="material-icons">{{ dimmingEnabled ? 'light_mode' : 'dark_mode' }}</span>
        </button>
        <div v-show="activeTooltip === 'dimming'" class="custom-tooltip">
          {{ dimmingEnabled ? 'Отключить затемнение' : 'Включить затемнение' }}
        </div>
      </div>

      <div class="tooltip-container">
        <button
          class="blur-btn"
          @mouseenter="showTooltip('blur')"
          @mouseleave="activeTooltip = null"
          @click="toggleBlur"
        >
          <span class="material-icons">blur_on</span>
        </button>
        <div v-show="activeTooltip === 'blur'" class="custom-tooltip">
          {{ isElectron ? 'Блюр' : 'Блюр, функция доступна в приложении' }}
        </div>
      </div>

      <div class="tooltip-container">
        <button
          class="material-symbols-outlined"
          @mouseenter="showTooltip('compressor')"
          @mouseleave="activeTooltip = null"
          @click="toggleCompressor"
        >
          <span class="material-icons">graphic_eq</span>
        </button>
        <div v-show="activeTooltip === 'compressor'" class="custom-tooltip">
          {{ isElectron ? 'Компрессор' : 'Компрессор, функция доступна в приложении' }}
        </div>
      </div>

      <div class="tooltip-container">
        <button
          class="mirror-btn"
          @mouseenter="showTooltip('mirror')"
          @mouseleave="activeTooltip = null"
          @click="toggleMirror"
        >
          <span class="material-icons">flip</span>
        </button>
        <div v-show="activeTooltip === 'mirror'" class="custom-tooltip">
          {{ isElectron ? 'Зеркало' : 'Зеркало, функция доступна в приложении' }}
        </div>
      </div>

      <div class="tooltip-container">
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
        <div v-show="activeTooltip === 'theater'" class="custom-tooltip">
          {{ theaterMode ? 'Выйти из театрального режима' : 'Театральный режим' }}
        </div>
      </div>

      <!-- Кнопки соотношения сторон -->
      <div v-for="ratio in ['16:9', '12:5', '4:3']" :key="ratio" class="tooltip-container">
        <button
          :class="['aspect-ratio-btn', { active: aspectRatio === ratio }]"
          @mouseenter="showTooltip(ratio)"
          @mouseleave="activeTooltip = null"
          @click="setAspectRatio(ratio)"
        >
          {{ ratio }}
        </button>
        <div v-show="activeTooltip === ratio" class="custom-tooltip">
          Установить соотношение {{ ratio }}
        </div>
      </div>

      <!-- Кнопка центрирования с SliderRound в подсказке -->
      <div
        class="tooltip-container"
        @mouseenter="showTooltip('centering')"
        @mouseleave="tryHideTooltip"
      >
        <button class="center-btn" @click="centerPlayer">
          <span class="material-icons">center_focus_strong</span>
        </button>
        <div
          v-show="activeTooltip === 'centering'"
          class="custom-tooltip advanced-tooltip"
          @mouseenter="keepTooltipVisible"
          @mouseleave="hideTooltip"
        >
          Отцентрировать плеер
          <SliderRound v-model="isCentered" title="Автоцентрирование плеера" />
          <span class="tooltip-title">Автоцентрирование плеера</span>
        </div>
      </div>

      <!-- Кнопка для открытия в приложении -->
      <div v-if="!isElectron" class="tooltip-container">
        <button
          class="app-link-btn"
          @mouseenter="showTooltip('app_link')"
          @mouseleave="activeTooltip = null"
          @click="openAppLink"
        >
          <span class="material-icons">open_in_new</span>
        </button>
        <div v-show="activeTooltip === 'app_link'" class="custom-tooltip">Открыть в приложении</div>
      </div>

      <!-- Кнопка для копирования ссылки на фильм (только в Electron) -->
      <div v-if="isElectron" class="tooltip-container">
        <button
          class="copy-link-btn"
          @mouseenter="showTooltip('copy_link')"
          @mouseleave="activeTooltip = null"
          @click="copyMovieLink"
        >
          <span class="material-icons">content_copy</span>
        </button>
        <div v-show="activeTooltip === 'copy_link'" class="custom-tooltip">Скопировать ссылку</div>
      </div>
    </div>

    <Notification ref="notificationRef" />
  </template>
</template>

<script setup>
import { getPlayers } from '@/api/movies'
import { handleApiError } from '@/constants'
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import SliderRound from '@/components/slider/SliderRound.vue'
import { showMessageToast } from '@/helpers/ui'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlayerModal from '@/components/PlayerModal.vue'

const mainStore = useMainStore()
const playerStore = usePlayerStore()
const route = useRoute()
const kp_id = ref(route.params.kp_id)

const props = defineProps({
  kpId: String
})
const emit = defineEmits(['update:selectedPlayer'])

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

const showTooltip = (tooltipName) => {
  activeTooltip.value = tooltipName
  tooltipHovered.value = false
  clearTimeout(hideTimeout)
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
    nextTick(() => {
      containerRef.value.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    })
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

const handlePlayerSelect = (player) => {
  selectedPlayerInternal.value = player
  iframeLoading.value = true
  playerStore.updatePreferredPlayer(normalizeKey(player.key))
  emit('update:selectedPlayer', player)
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
    window.electronAPI.sendHotKey('F3')
  } else {
    showMessageToast('Доступно только в приложении ReYohoho Desktop')
    window.open('https://t.me/ReYohoho/126', '_blank')
  }
}

const toggleMirror = () => {
  if (isElectron.value) {
    window.electronAPI.sendHotKey('F4')
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

const onKeyDown = (event) => {
  if (event.key === 'Escape' && theaterMode.value) {
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

const onIframeLoad = () => {
  iframeLoading.value = false
}

function cleanName(name) {
  return name
    .replace(/^REYOHOHO_PLAYER>HDREZKA>/, '')
    .replace(/KODIK>/, 'KODIK - ')
    .trim()
}

watch(selectedPlayerInternal, (newVal) => {
  if (newVal) {
    iframeLoading.value = true
    playerStore.updatePreferredPlayer(normalizeKey(newVal.key))
    emit('update:selectedPlayer', newVal)
  }
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      kp_id.value = newKpId
      if (isCentered.value) centerPlayer()
    }
  },
  { immediate: true }
)

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  if (isMobile.value) aspectRatio.value = '4:3'
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  if (isCentered.value) centerPlayer()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScaleFactor)
  window.removeEventListener('mousemove', showCloseButton)
  document.removeEventListener('keydown', onKeyDown)
  document.body.classList.remove('no-scroll')
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
  background: #505050;
  border-color: #17850b;
}

.player-btn:active {
  background: #17850b;
  border-color: #17850b;
}

.player-btn:focus {
  outline: none;
  box-shadow: 0 0 5px #17850b;
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
  background: rgba(255, 0, 0, 1);
  opacity: 1;
}

html.no-scroll {
  overflow: hidden;
}

/* Блока управления */
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 0 auto;
  border-radius: 10px;
  backdrop-filter: blur(10px);
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
  background-color: #555;
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.controls button:active {
  transform: translateY(0);
  box-shadow: none;
}

.controls button.active {
  background-color: #4caf50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.7);
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
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: #fff;
  padding: 5px;
  border-radius: 4px;
  font-size: 16px;
  white-space: nowrap;
  margin-top: 8px;
  pointer-events: none;
  text-align: center;
}

.advanced-tooltip {
  white-space: normal;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  top: calc(100% + 5px);
  pointer-events: all;
  text-align: center;
}

.tooltip-title {
  font-size: 16px;
  text-align: center;
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
</style>
