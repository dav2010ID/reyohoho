<template>
  <div v-if="backgroundType !== 'none'" class="background-container">
    <!-- Динамический фон фильма - два слоя для плавного перехода -->
    <div v-if="showDynamicBackground"
      v-for="(bg, index) in dynamicBackgrounds"
      :key="index"
      class="background-layer dynamic-background"
      :class="{ 
        active: activeDynamicIndex === index,
        next: nextDynamicIndex === index
      }"
      :style="getBackgroundStyle(bg)"
    ></div>

    <!-- Фон со звёздами -->
    <div 
      v-if="showStarsBackground"
      class="background-layer stars-background"
      :style="backgroundStyle"
    ></div>

    <!-- Сообщение об ошибке -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, watchEffect } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

// Геттеры
const currentBackground = computed(() => store.state.background.currentMovieBackground)
const backgroundType = computed(() => store.state.background.backgroundType)
const starsBg = computed(() => store.state.background.starsBackground)
const error = computed(() => store.state.background.errorBackground)

// Логика отображения
const showDynamicBackground = computed(() => 
  backgroundType.value === 'dynamic' && currentBackground.value
)

const showStarsBackground = computed(() => backgroundType.value === 'stars')

// Стили
const backgroundStyle = computed(() => ({
  backgroundImage: `url(${starsBg.value})`,
  filter: `${store.state.background.isBlurEnabled ? 'blur(20px)' : ''}`,
}))

// Логика для плавного перехода динамического фона
const dynamicBackgrounds = ref([currentBackground.value, null]) // Два слоя для плавного перехода
const activeDynamicIndex = ref(0) // Индекс активного слоя
const nextDynamicIndex = ref(-1) // Индекс следующего слоя
const isTransitioning = ref(false) // Флаг для отслеживания перехода

const getBackgroundStyle = (url) => ({
  backgroundImage: `url(${url})`,
  filter: `brightness(20%) ${store.state.background.isBlurEnabled ? 'blur(20px)' : ''}`,
  transition: 'opacity 1.5s ease-in-out' // Увеличенное время
});

// Предзагрузка изображения
const preloadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.src = url
  img.onload = resolve
  img.onerror = reject
})

// Обработка изменения currentBackground
watch(currentBackground, async (newUrl) => {
  if (!newUrl || isTransitioning.value || newUrl === dynamicBackgrounds.value[activeDynamicIndex.value]) {
    return // Если фон не изменился или переход уже выполняется, ничего не делаем
  }

  isTransitioning.value = true
  nextDynamicIndex.value = (activeDynamicIndex.value + 1) % 2 // Переключаем на следующий слой

  // Предзагрузка нового изображения
  await preloadImage(newUrl)

  // Устанавливаем новое изображение в неактивный слой
  dynamicBackgrounds.value[nextDynamicIndex.value] = newUrl

  // Активируем переход
  activeDynamicIndex.value = nextDynamicIndex.value

  // Завершаем переход через 1 секунду
  setTimeout(() => {
    isTransitioning.value = false
  }, 1500)
})

// Загрузка данных
const fetchTopMovie = async () => {
  try {
    const response = await fetch('https://rh.aukus.su/top/24h')
    const data = await response.json()
    if (data?.[0]?.cover) {
      store.dispatch('background/updateMovieBackground', data[0].cover)
    }
  } catch (err) {
    store.commit('background/SET_BACKGROUND_ERROR', 'Ошибка загрузки')
  }
}

// Инициализация
onMounted(() => {
  if (!currentBackground.value && backgroundType.value === 'dynamic') {
    fetchTopMovie()
  }
})

watchEffect(() => {
  if (currentBackground.value === null && backgroundType.value === 'dynamic') {
    fetchTopMovie()
  }
})
</script>

<style scoped>
.background-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  overflow: hidden;
}

.background-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  background-size: cover;
  background-position: center;
}

.background-layer.active {
  opacity: 1;
  z-index: 2;
}

.background-layer.next {
  opacity: 0;
  z-index: 3;
}

.background-layer.active.next {
  opacity: 1;
  z-index: 4;
}

.dynamic-background {
  background-color: #000000;
}

.stars-background {
  opacity: 1;
  background: repeat top center;
}

.error-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #ff4444;
  font-size: 1rem;
  z-index: 100;
  text-align: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 20px;
  border-radius: 5px;
}
</style>