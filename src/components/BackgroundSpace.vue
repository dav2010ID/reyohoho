<template>
  <LavaLampBackground v-if="backgroundType === 'lava-lamp'" />
  <div v-else-if="backgroundType !== 'disabled'" class="background-container">
    <div
      v-for="(bg, index) in backgrounds"
      :key="index"
      class="background-layer"
      :class="{ active: activeIndex === index }"
      :style="getLayerStyle(index)"
    ></div>
  </div>
</template>

<script setup>
import LavaLampBackground from './LavaLampBackground.vue'
import { getMovies } from '@/api/movies'
import { useBackgroundStore } from '@/store/background'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const backgroundStore = useBackgroundStore()
const route = useRoute()
const router = useRouter()

const backgrounds = ref(['', ''])
const activeIndex = ref(0)
const isFetching = ref(false) // Флаг для отслеживания состояния запроса

const backgroundUrl = computed(() => backgroundStore.backgroundUrl)
const backgroundType = computed(() => backgroundStore.backgroundType)
const isBlurActive = computed(() => backgroundStore.isBlurActive)

const CACHE_KEY = 'topMoviePoster'

const getLayerStyle = (index) => {
  const brightnessFilter = backgroundType.value === 'stars' ? 'brightness(100%)' : 'brightness(20%)'
  const blurFilter = isBlurActive.value ? 'blur(20px)' : 'blur(0px)'

  return {
    backgroundImage: `url(${backgrounds.value[index]})`,
    filter: `${brightnessFilter} ${blurFilter}`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
}

const fetchTopMovie = async () => {
  if (isFetching.value) return
  isFetching.value = true

  try {
    const topMovies = await getMovies({ activeTime: '24h', limit: 1 })

    if (topMovies?.[0]?.cover) {
      const expiresAt = new Date().setHours(24, 0, 0, 0)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ url: topMovies[0].cover, expiresAt }))
      backgroundStore.updateTopMoviePoster(topMovies[0].cover)
    }
  } catch (err) {
    console.error('Ошибка:', err)
  } finally {
    isFetching.value = false
  }
}

const checkCachedTopMovie = () => {
  const cached = localStorage.getItem(CACHE_KEY)
  if (!cached) return false

  try {
    const { url, expiresAt } = JSON.parse(cached)
    if (Date.now() < expiresAt) {
      backgroundStore.updateTopMoviePoster(url)
      return true
    }
    localStorage.removeItem(CACHE_KEY)
  } catch (e) {
    localStorage.removeItem(CACHE_KEY)
    throw new Error(e)
  }
  return false
}

onMounted(async () => {
  'mounted'
  backgrounds.value = [backgroundUrl.value, backgroundUrl.value]
  await router.isReady()
  ;('route check')

  if (route.path.includes('movie')) return
  ;('route check passed')

  if (backgroundType.value !== 'disabled') {
    ;('first if')

    const hasValidCache = checkCachedTopMovie()
    ;('valid cache')

    if (!hasValidCache && !isFetching.value) {
      ;('second if')
      await fetchTopMovie()
    }
  }
})

watch(route, async (newRoute) => {
  if (newRoute.path.includes('movie')) return

  if (backgroundType.value === 'dynamic') {
    const hasValidCache = checkCachedTopMovie()
    if (!hasValidCache && !isFetching.value) {
      await fetchTopMovie()
    }
  }
})

watch(backgroundUrl, (newUrl) => {
  if (!newUrl) return

  const img = new Image()
  img.src = newUrl
  img.onload = () => {
    const inactiveIndex = activeIndex.value ^ 1
    backgrounds.value[inactiveIndex] = newUrl
    activeIndex.value = inactiveIndex
  }
})

watch(backgroundType, (newType) => {
  // Если тип фона изменился на 'dynamic', обновляем фон
  if (newType === 'dynamic') {
    const hasValidCache = checkCachedTopMovie()
    if (!hasValidCache && !isFetching.value) {
      fetchTopMovie()
    }
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
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition:
    filter 0.6s ease-in-out,
    opacity 0.6s ease-in-out;
  background-size: cover;
  background-position: center;
  will-change: opacity, filter;
}

.background-layer.active {
  opacity: 1;
}
</style>
