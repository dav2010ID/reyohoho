<template>
  <div v-if="availableVideos.length" class="carousel-container">
    <h2>Трейлеры (YouTube)</h2>
    <div class="carousel-wrapper">
      <!-- Кнопка для прокрутки влево -->
      <button
        v-show="!isMobile && canScrollLeft"
        class="scroll-button left"
        @click="scrollCarousel(-1)"
      >
        <span class="material-symbols-outlined">arrow_back_ios</span>
      </button>

      <!-- Карусель с кастомным скроллом -->
      <div ref="carousel" class="carousel" @scroll="updateScroll">
        <div
          v-for="(video, index) in availableVideos"
          :key="index"
          class="carousel-item"
          @click="selectVideo(index)"
        >
          <img :src="`https://img.youtube.com/vi/${video.videoId}/0.jpg`" :alt="video.name" />
          <div class="video-name">{{ video.name }}</div>
        </div>
      </div>

      <!-- Кнопка для прокрутки вправо -->
      <button
        v-show="!isMobile && canScrollRight"
        class="scroll-button right"
        @click="scrollCarousel(1)"
      >
        <span class="material-symbols-outlined">arrow_forward_ios</span>
      </button>
    </div>
    <!-- Встроенный плеер -->
    <div v-if="activeVideoIndex !== null" class="video-player">
      <iframe :src="videos[activeVideoIndex].iframeUrl" frameborder="0" allowfullscreen></iframe>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useMainStore } from '@/store/main'

const mainStore = useMainStore()

const isMobile = computed(() => mainStore.isMobile)

const props = defineProps({
  videos: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select'])
const activeVideoIndex = ref(null)
const carousel = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

// Обновление состояния кнопок прокрутки
const updateScroll = () => {
  if (!carousel.value) return
  const { scrollLeft, scrollWidth, clientWidth } = carousel.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1
}

// Прокрутка карусели на ширину одного элемента (с учетом gap)
const scrollCarousel = (direction) => {
  if (!carousel.value) return
  const firstItem = carousel.value.querySelector('.carousel-item')
  if (!firstItem) return
  const itemWidth = firstItem.clientWidth + 16 // gap
  carousel.value.scrollBy({
    left: itemWidth * direction,
    behavior: 'smooth'
  })
}

// Выбор видео для отображения во встроенном плеере
const selectVideo = (index) => {
  activeVideoIndex.value = index
  emit('select', props.videos[index])
}

const handleResize = () => updateScroll()

const availableVideos = ref([])

const checkVideoAvailability = async (videoId) => {
  try {
    const response = await fetch(`https://img.youtube.com/vi/${videoId}/0.jpg`)
    return response.ok
  } catch {
    return false
  }
}

onMounted(async () => {
  const availabilityChecks = props.videos.map(async (video) => {
    const isAvailable = await checkVideoAvailability(video.videoId)
    return isAvailable ? video : null
  })

  const results = await Promise.all(availabilityChecks)
  availableVideos.value = results.filter(Boolean)
  updateScroll()
  window.addEventListener('resize', handleResize)
})

watch(
  () => props.videos,
  async (newVideos) => {
    const availabilityChecks = newVideos.map(async (video) => {
      const isAvailable = await checkVideoAvailability(video.videoId)
      return isAvailable ? video : null
    })

    const results = await Promise.all(availabilityChecks)
    availableVideos.value = results.filter(Boolean)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.carousel-container {
  margin: 2rem 0;
  padding: 0 20px;
}

.carousel-wrapper {
  position: relative;
  overflow: hidden;
}

/* Карусель с кастомным скроллом */
.carousel {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0;
  user-select: none;

  &::-webkit-scrollbar {
    width: 5px; /* Ширина вертикального скроллбара */
    height: 5px; /* Высота горизонтального скроллбара */
  }

  &::-webkit-scrollbar-track {
    background: transparent; /* Цвет фона */
    border-radius: 10px; /* Закругление углов */
  }

  &::-webkit-scrollbar-thumb {
    background: #494949; /* Цвет ползунка */
    border-radius: 10px; /* Закругление углов */
    border: 0; /* Отступ вокруг ползунка */
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555; /* Цвет ползунка при наведении */
  }
}

/* Кнопки прокрутки скрыты по умолчанию, появляются при наведении */
.scroll-button {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s;
  opacity: 0;
  pointer-events: none;
}

.carousel-wrapper:hover .scroll-button {
  opacity: 1;
  pointer-events: auto;
}

.scroll-button:hover {
  background: rgba(0, 0, 0, 0.7);
}

.scroll-button.left {
  left: 0;
}

.scroll-button.right {
  right: 0;
}

/* Стили карточки трейлера */
.carousel-item {
  flex: 0 0 auto;
  scroll-snap-align: start;
  width: 260px;
  background: #161616;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
  cursor: pointer;
  overflow: hidden;
}

.carousel-item:hover {
  transform: scale(1.03);
}

.carousel-item img {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.video-name {
  padding: 12px;
  background: #202020;
  color: #fff;
  font-size: 14px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

/* Увеличенный плеер */
.video-player {
  margin-top: 20px;
  max-width: 1200px;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 20px auto 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  overflow: hidden;
}

.video-player iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
