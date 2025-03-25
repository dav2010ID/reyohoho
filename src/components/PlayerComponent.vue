<template>
  <div v-if="errorMessage" class="error-message">
    {{ errorMessage }}
  </div>

  <template v-else>
    <div class="players-list">
      <span>Плеер:</span>
      <select v-model="selectedPlayerInternal" class="custom-select">
        <option v-for="player in playersInternal" :key="player.key" :value="player">
          {{
            player.key === player.translate
              ? player.translate.toUpperCase()
              : player.key + ' - ' + player.translate.toUpperCase()
          }}
        </option>
      </select>
    </div>

    <!-- Единый контейнер плеера -->
    <div
      ref="containerRef"
      :class="['player-container', { 'theater-mode': theaterMode }]"
      :style="!theaterMode ? containerStyle : {}"
    >
      <div class="iframe-wrapper" :style="!theaterMode ? iframeWrapperStyle : {}">
        <!-- <div class="fullscreen" @mousemove="showCloseButton"></div> -->

        <iframe
          ref="playerIframe"
          :src="selectedPlayerInternal?.iframe"
          frameborder="0"
          allowfullscreen
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

      <!-- Новая кнопка для открытия в приложении -->
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
    </div>
  </template>
</template>

<script setup>
import { getPlayers } from '@/api/movies'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import SliderRound from '@/components/slider/SliderRound.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'

const store = useStore()
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
const errorMessage = ref('')

const maxPlayerHeightValue = ref(window.innerHeight * 0.9) // 90% от высоты экрана
const maxPlayerHeight = computed(() => `${maxPlayerHeightValue.value}px`)
const isMobile = computed(() => store.state.isMobile)
// Надо перенести в хранилище аналогично мобильной версии
const isElectron = computed(() => {
  return !!window.electronAPI
})

// Подсказки
const activeTooltip = ref(null)
const tooltipHovered = ref(false)
let hideTimeout = null

const showTooltip = (tooltipName) => {
  activeTooltip.value = tooltipName
  tooltipHovered.value = false
  clearTimeout(hideTimeout)
}

const tryHideTooltip = () => {
  // Если курсор не над подсказкой - скрываем через 300мс (для плавности)
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

// Используем геттер для получения aspectRatio из хранилища
const aspectRatio = computed({
  get: () => store.getters['player/aspectRatio'],
  set: (value) => store.dispatch('player/updateAspectRatio', value)
})

// Используем геттер для получения isCentered из хранилища
const isCentered = computed({
  get: () => store.getters['player/isCentered'],
  set: (value) => store.dispatch('player/updateCentering', value)
})

// Используем геттер для получения предпочтительного плеера из хранилища
const preferredPlayer = computed(() => store.getters['player/preferredPlayer'])

// Естественная (рассчитанная) высота плеера исходя из текущей ширины контейнера
const naturalHeight = ref(0)

// Функция приведения к верхнему регистру
const normalizeKey = (key) => {
  return key.toUpperCase()
}

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
  const container = containerRef.value
  if (container) {
    nextTick(() => {
      container.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    })
  }
}

const fetchPlayers = async () => {
  try {
    console.log(props.kpId)

    const players = await getPlayers(props.kpId)

    // Преобразуем объект с плеерами в массив объектов
    playersInternal.value = Object.entries(players).map(([key, value]) => ({
      key: key.toUpperCase(),
      ...value
    }))

    // Выбираем плеер:
    if (playersInternal.value.length > 0) {
      if (preferredPlayer.value) {
        // Приводим preferredPlayer к верхнему регистру и удаляем цифры
        const normalizedPreferredPlayer = normalizeKey(preferredPlayer.value)
        // Ищем плеера, чей ключ совпадает с предпочтительным плеером
        const preferred = playersInternal.value.find(
          (player) => normalizeKey(player.key) === normalizedPreferredPlayer
        )
        selectedPlayerInternal.value = preferred || playersInternal.value[0]
      } else {
        selectedPlayerInternal.value = playersInternal.value[0]
      }
      emit('update:selectedPlayer', selectedPlayerInternal.value)
    }
  } catch (error) {
    if (error.response) {
      switch (error.response.status) {
        case 403:
          errorMessage.value = 'Упс, недоступно по требованию правообладателя'
          break
        case 500:
          errorMessage.value = 'Ошибка на сервере. Пожалуйста, попробуйте позже'
          break
        case 404:
          errorMessage.value = 'Такого не нашлось, повторите поиск'
          break
        default:
          errorMessage.value = `Произошла ошибка: ${error.response.status}`
      }
    } else {
      errorMessage.value = `Ошибка: ${error.message}`
    }
    console.error('Ошибка при загрузке плееров:', error)
  }
}

const showMessageToast = (message) => {
  const messageElement = document.createElement('div')
  messageElement.style.position = 'fixed'
  messageElement.style.top = '0'
  messageElement.style.left = '0'
  messageElement.style.width = '100%'
  messageElement.style.height = '100%'
  messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
  messageElement.style.color = 'white'
  messageElement.style.display = 'flex'
  messageElement.style.justifyContent = 'center'
  messageElement.style.alignItems = 'center'
  messageElement.style.fontSize = '2rem'
  messageElement.style.zIndex = '99000'
  messageElement.textContent = message
  document.body.appendChild(messageElement)

  setTimeout(() => {
    document.body.removeChild(messageElement)
  }, 2000)
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
  // Вызываем центрирование после закрытия театрального режима. Возможно временное решение
  nextTick(() => {
    centerPlayer()
  })
}

const theaterModeCloseButtonTimeout = ref(null)
const showCloseButton = () => {
  theaterModeCloseButtonTimeout.value = setTimeout(() => {
    clearTimeout(theaterModeCloseButtonTimeout.value)
    closeButtonVisible.value = false
  }, 4000)
  closeButtonVisible.value = true
}

const dimmingEnabled = computed(() => store.state.dimmingEnabled)
const toggleDimming = () => {
  // Затемнение включается только в обычном режиме
  if (!theaterMode.value) {
    store.commit('toggleDimming')
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
    if (isCentered.value) {
      centerPlayer()
    }
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

// При изменении выбранного плеера сохраняем его ключ в preferredPlayer
watch(selectedPlayerInternal, (newVal) => {
  if (newVal) {
    const normalizedKey = normalizeKey(newVal.key)
    store.dispatch('player/updatePreferredPlayer', normalizedKey)
  }
  iframeLoading.value = true
  emit('update:selectedPlayer', newVal)
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      kp_id.value = newKpId
      if (isCentered.value) {
        centerPlayer()
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  if (isMobile.value) {
    aspectRatio.value = '4:3'
  }
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
  if (isCentered.value) {
    centerPlayer()
  }
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
  max-width: 700px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: auto;
  margin-bottom: 10px;
}

/* Select */
.custom-select {
  font-size: 16px;
  padding: 8px 16px;
  border: 1px solid #444;
  background-color: #1e1e1e;
  color: #fff;
  border-radius: 5px;
  cursor: pointer;
  transition:
    background-color 0.3s,
    border-color 0.3s;
  width: 100%;
}

.custom-select:hover {
  border-color: #666;
}

.custom-select:focus {
  border-color: #558839;
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

.error-message {
  color: #ff4444;
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
  border: 1px solid #ff4444;
  border-radius: 5px;
  margin: 20px auto;
  max-width: 500px;
  background: rgba(255, 68, 68, 0.1);
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
