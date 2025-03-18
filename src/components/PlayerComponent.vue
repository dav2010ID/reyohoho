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
    <div ref="containerRef" :class="['player-container', { 'theater-mode': theaterMode }]"
      :style="!theaterMode ? containerStyle : {}">
      <div class="iframe-wrapper" :style="!theaterMode ? iframeWrapperStyle : {}">
        <!-- <div class="fullscreen" @mousemove="showCloseButton"></div> -->

        <iframe ref="playerIframe" :src="selectedPlayerInternal?.iframe" frameborder="0" @load="onIframeLoad"
          allowfullscreen class="responsive-iframe"
          :class="{ 'theater-mode-unlock': closeButtonVisible, 'theater-mode-lock': theaterMode }"></iframe>
        <SpinnerLoading v-if="iframeLoading" />
      </div>

      <!-- Кнопка закрытия в театральном режиме -->
      <button v-if="theaterMode" @click="toggleTheaterMode" class="close-theater-btn"
        :class="{ visible: closeButtonVisible }">
        ✖
      </button>
    </div>

    <!-- Кнопки управления -->
    <div v-if="!isMobile" class="controls">
      <button @click="toggleBlur" class="blur-btn">
        Блюр
      </button>
      <button @click="toggleCompressor" class="compressor-btn">
        Компрессор
      </button>
      <button @click="toggleMirror" class="mirror-btn">
        Зеркало
      </button>
      <button @click="toggleTheaterMode" class="theater-mode-btn">
        {{ theaterMode ? 'Выйти из театрального режима' : 'Включить театральный режим' }}
      </button>
      <button @click="setAspectRatio('16:9')" :class="['aspect-ratio-btn', { active: aspectRatio === '16:9' }]">
        16:9
      </button>
      <button @click="setAspectRatio('12:5')" :class="['aspect-ratio-btn', { active: aspectRatio === '12:5' }]">
        12:5
      </button>
      <button @click="setAspectRatio('4:3')" :class="['aspect-ratio-btn', { active: aspectRatio === '4:3' }]">
        4:3
      </button>
      <!-- Новая кнопка "Центр" -->
      <button @click="centerPlayer" class="center-btn">Центр</button>
      <!-- Переключатель автоцентрирования -->
      <SliderRound v-model="isCentered">Автоцентрирование плеера</SliderRound>
    </div>
  </template>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import axios from 'axios'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import SliderRound from '@/components/slider/SliderRound.vue'

const store = useStore()
const router = useRouter()

const props = defineProps({
  kp_id: String
});
const emit = defineEmits(['update:selectedPlayer']);

const playersInternal = ref([]);
const selectedPlayerInternal = ref(null);
const iframeLoading = ref(true);
const theaterMode = ref(false);
const closeButtonVisible = ref(false);
const playerIframe = ref(null);
const containerRef = ref(null);
const errorMessage = ref('');

const apiUrl = import.meta.env.VITE_APP_API_URL;
const maxPlayerHeightValue = ref(window.innerHeight * 0.9); // 90% от высоты экрана
const maxPlayerHeight = computed(() => `${maxPlayerHeightValue.value}px`);
const isMobile = ref(window.innerWidth <= 600);

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
    const response = await axios.post(
      `${apiUrl}/cache`,
      new URLSearchParams({
        kinopoisk: props.kp_id,
        type: 'movie'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    // Преобразуем объект с плеерами в массив объектов
    playersInternal.value = Object.entries(response.data).map(([key, value]) => ({
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
    if (error.response?.status === 403) {
      errorMessage.value = "Упс, недоступно по требованию правообладателя";
      if (error.response.status === 500) {
        errorMessage.value = "Ошибка на сервере. Пожалуйста, попробуйте позже";
      }
    } else {
      console.error('Ошибка при загрузке плееров:', error);
    }
  }
}

const onIframeLoad = () => {
  iframeLoading.value = false
  if (isCentered.value) {
    centerPlayer()
  }
}

const showMessageToast = (message) => {
  const messageElement = document.createElement('div');
  messageElement.style.position = 'fixed';
  messageElement.style.top = '0';
  messageElement.style.left = '0';
  messageElement.style.width = '100%';
  messageElement.style.height = '100%';
  messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  messageElement.style.color = 'white';
  messageElement.style.display = 'flex';
  messageElement.style.justifyContent = 'center';
  messageElement.style.alignItems = 'center';
  messageElement.style.fontSize = '2rem';
  messageElement.style.zIndex = '99000';
  messageElement.textContent = message;
  document.body.appendChild(messageElement);

  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, 2000);
}

const toggleBlur = () => {
  if (window.electronAPI) {
    window.electronAPI.sendHotKey("F2");
  } else {
    showMessageToast("Доступно только в приложении ReYohoho Desktop");
  }
}

const toggleCompressor = () => {
  if (window.electronAPI) {
    window.electronAPI.sendHotKey("F3");
  } else {
    showMessageToast("Доступно только в приложении ReYohoho Desktop");
  }
}

const toggleMirror = () => {
  if (window.electronAPI) {
    window.electronAPI.sendHotKey("F4");
  } else {
    showMessageToast("Доступно только в приложении ReYohoho Desktop");
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
}

const theaterModeCloseButtonTimeout = ref(null)
const showCloseButton = (event) => {
  theaterModeCloseButtonTimeout.value = setTimeout(() => {
    clearTimeout(theaterModeCloseButtonTimeout.value)
    closeButtonVisible.value = false
  }, 4000)
  closeButtonVisible.value = true
}

const onKeyDown = (event) => {
  if (event.key === 'Escape' && theaterMode.value) {
    toggleTheaterMode()
  }
}

const setAspectRatio = (ratio) => {
  aspectRatio.value = ratio
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

onMounted(() => {
  iframeLoading.value = true
  fetchPlayers()
  if (isMobile.value) {
    aspectRatio.value = '4:3'
  }
  updateScaleFactor()
  window.addEventListener('resize', updateScaleFactor)
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
  transition: all 0.3s ease;
  padding-bottom: 10px;
}

.iframe-wrapper {
  width: 100%;
  /* Высота определяется за счёт padding-top для сохранения пропорций */
}

.responsive-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.player-container.theater-mode {
  position: fixed;
  top: 0 !important;
  left: 0 !important;
  z-index: 9999;
  width: 100vw !important;
  height: 100vh !important;
  background: #000;
  margin: 0;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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
  /* Увеличиваем размер кнопки */
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    background 0.3s,
    opacity 0.3s;
  z-index: 1001;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

/* Расширяем зону активации */
.close-theater-btn::before {
  content: '';
  position: absolute;
  width: 80px;
  /* Увеличиваем невидимую область вокруг кнопки */
  height: 80px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Делаем кнопку видимой при наведении на зону */
.close-theater-btn:hover,
.close-theater-btn::before:hover {
  background: rgba(255, 0, 0, 1);
  opacity: 1;
}

.close-theater-btn.visible {
  opacity: 1;
}

html.no-scroll {
  overflow: hidden;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.blur-btn,
.mirror-btn,
.compressor-btn,
.theater-mode-btn,
.aspect-ratio-btn,
.center-btn {
  background-color: #444;
  color: #fff;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
  z-index: 10;
}

.blur-btn:hover,
.mirror-btn:hover,
.compressor-btn:hover,
.theater-mode-btn:hover,
.aspect-ratio-btn:hover,
.center-btn:hover {
  background-color: #666;
}

.aspect-ratio-btn.active {
  background-color: #4caf50;
}

/* Select */
.custom-select {
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
</style>
