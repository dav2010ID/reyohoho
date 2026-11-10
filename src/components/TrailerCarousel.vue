<template>
  <section v-if="availableVideos.length" class="carousel-container">
    <h2 class="trailers-title">
      Трейлеры <span class="trailers-count">{{ availableVideos.length }}</span>
    </h2>
    <div class="carousel-wrapper">
      <!-- Кнопка для прокрутки влево -->
      <button
        v-show="!isMobile && canScrollLeft"
        class="scroll-button left"
        aria-label="Прокрутить трейлеры влево"
        @click="scrollCarousel(-1)"
      >
        <span class="material-symbols-outlined">arrow_back_ios</span>
      </button>

      <!-- Карусель с кастомным скроллом -->
      <div ref="carousel" class="carousel" @scroll="updateScroll">
        <button
          v-for="(video, index) in availableVideos"
          :key="video.videoId"
          type="button"
          class="carousel-item"
          :class="{ 'is-active': index === activeVideoIndex }"
          :aria-label="`Смотреть: ${video.name}`"
          @click="selectVideo(index)"
        >
          <span class="thumbnail">
            <img
              :src="`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`"
              :alt="video.name"
              loading="lazy"
              decoding="async"
            />
            <span class="play-badge" aria-hidden="true"><i class="fas fa-play"></i></span>
          </span>
          <span class="video-name">{{ video.name }}</span>
        </button>
      </div>

      <!-- Кнопка для прокрутки вправо -->
      <button
        v-show="!isMobile && canScrollRight"
        class="scroll-button right"
        aria-label="Прокрутить трейлеры вправо"
        @click="scrollCarousel(1)"
      >
        <span class="material-symbols-outlined">arrow_forward_ios</span>
      </button>
    </div>
    <!-- Встроенный плеер -->
    <div v-if="activeVideo" class="video-player">
      <iframe
        :src="activeVideo.iframeUrl"
        :title="activeVideo.name || 'Трейлер YouTube'"
        frameborder="0"
        allowfullscreen
      ></iframe>
    </div>
  </section>
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
  },
  activeVideoIndex: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['select'])
const activeVideoIndex = ref(props.activeVideoIndex)
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

const availableVideos = ref([])
// Indexes refer to the visible list: unavailable trailers are not shown.
const activeVideo = computed(() =>
  activeVideoIndex.value === null ? null : availableVideos.value[activeVideoIndex.value] || null
)

// Выбор видео для отображения во встроенном плеере
const selectVideo = (index) => {
  activeVideoIndex.value = index
  emit('select', availableVideos.value[index])
}

const handleResize = () => updateScroll()

const checkVideoAvailability = async (videoId) => {
  if (!videoId || videoId === 'undefined') return false
  try {
    const response = await fetch(`https://img.youtube.com/vi/${videoId}/0.jpg`)
    return response.ok
  } catch {
    return false
  }
}

const loadAvailableVideos = async (videos) => {
  const results = await Promise.all(
    videos.map(async (video) => ((await checkVideoAvailability(video.videoId)) ? video : null))
  )
  availableVideos.value = results.filter(Boolean)
}

onMounted(async () => {
  await loadAvailableVideos(props.videos)
  updateScroll()
  window.addEventListener('resize', handleResize)
})

watch(
  () => props.videos,
  (newVideos) => loadAvailableVideos(newVideos)
)

watch(
  () => props.activeVideoIndex,
  (newIndex) => {
    activeVideoIndex.value = newIndex
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.trailers-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
  color: #fff;
  font-size: 1.35rem;
  line-height: 1.1;
  letter-spacing: -0.02em;

  &::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--accent-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent-color) 55%, transparent);
  }
}

.trailers-count {
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
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
  padding: 4px 2px 10px;
  user-select: none;

  &::-webkit-scrollbar {
    height: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: #494949;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
}

/* Кнопки прокрутки скрыты по умолчанию, появляются при наведении */
.scroll-button {
  position: absolute;
  top: 0;
  bottom: 10px;
  width: 50px;
  border: none;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.75), transparent);
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

.scroll-button.left {
  left: 0;
}

.scroll-button.right {
  right: 0;
  background: linear-gradient(270deg, rgba(0, 0, 0, 0.75), transparent);
}

/* Карточка трейлера */
.carousel-item {
  flex: 0 0 auto;
  width: 280px;
  padding: 0;
  scroll-snap-align: start;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.carousel-item:hover,
.carousel-item:focus-visible,
.carousel-item.is-active {
  transform: translateY(-4px);
  border-color: var(--accent-color);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.35),
    0 0 18px var(--accent-semi-transparent);
}

.thumbnail {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  background: #111;
}

.thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-badge {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.85);
  color: #fff;
  font-size: 18px;
  backdrop-filter: blur(2px);
  transition:
    background-color 0.25s ease,
    transform 0.25s ease;

  i {
    margin-left: 3px;
  }
}

.carousel-item:hover .play-badge,
.carousel-item.is-active .play-badge {
  background: var(--accent-color);
  transform: scale(1.08);
}

.video-name {
  display: block;
  padding: 10px 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Увеличенный плеер */
.video-player {
  width: 100%;
  max-width: 1200px;
  aspect-ratio: 16 / 9;
  margin: 18px auto 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.video-player iframe {
  width: 100%;
  height: 100%;
  border: none;
}

@media (max-width: 620px) {
  .trailers-title {
    font-size: 1.15rem;
  }

  .carousel {
    gap: 12px;
  }

  .carousel-item {
    width: 220px;
  }

  .play-badge {
    width: 44px;
    height: 44px;
    font-size: 15px;
  }
}
</style>
