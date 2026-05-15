<template>
  <div class="wrapper">
    <div class="top-100-page" tabindex="0">
      <div class="controls">
        <div class="filter-card time-card">
          <div class="button-group time-buttons">
            <i class="material-icons card-icon">schedule</i>
            <template v-for="(btn, idx) in timeFilters" :key="idx">
              <div v-if="btn.type === 'separator'" class="filter-separator"></div>
              <button
                v-else
                class="filter-btn time-btn"
                :class="{ active: activeTimeFilter === btn.apiUrl, disabled: loading }"
                :disabled="loading"
                @click="changeTimeFilter(btn.apiUrl)"
              >
                {{ btn.label }}
              </button>
            </template>
          </div>
        </div>

        <div class="filter-card type-card">
          <div class="button-group type-buttons">
            <i class="material-icons card-icon">movie</i>
            <button
              v-for="(btn, idx) in currentTypeFilters"
              :key="idx"
              class="filter-btn type-btn"
              :class="{ active: typeFilter === btn.value, disabled: loading }"
              :disabled="loading"
              @click="changeTypeFilter(btn.value)"
            >
              {{ btn.label }}
            </button>
          </div>
        </div>
      </div>

      <MovieList
        v-if="!errorMessage"
        :movies-list="visibleMovies"
        :is-history="false"
        :loading="loading"
      />
      <div v-if="canShowMore" class="load-more-wrap">
        <div ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></div>
        <button class="load-more-btn" type="button" :disabled="loadingMore" @click="showMore">
          {{ loadingMore ? 'Загружаем...' : 'Показать еще' }}
        </button>
      </div>
      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />
    </div>
  </div>
</template>

<script setup>
import { getDiscussedMovies, getMovies } from '@/api/movies'
import ErrorMessage from '@/components/ErrorMessage.vue'
import { MovieList } from '@/components/MovieList'
import { handleApiError } from '@/constants'
import { computed, nextTick, onMounted, onServerPrefetch, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const movies = ref([])
const loading = ref(false)
const activeTimeFilter = ref('24h')
const typeFilter = ref('all')
const lastNormalTypeFilter = ref('all')
const errorMessage = ref('')
const errorCode = ref(null)
const route = useRoute()
const router = useRouter()
const TOP_MOVIES_PAGE_SIZE = 36
const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const loadMoreSentinel = ref(null)
let loadMoreObserver = null

const timeFilters = [
  { label: '24 часа', apiUrl: '24h' },
  { label: '7 дней', apiUrl: '7d' },
  { label: '30 дней', apiUrl: '30d' },
  { label: 'Всё время', apiUrl: 'all' },
  { label: '---', apiUrl: 'separator', type: 'separator' },
  { label: 'Обсуждаемое', apiUrl: 'discussed' }
]

const normalTypeFilters = [
  { label: 'Все', value: 'all' },
  { label: 'Фильмы', value: 'movie' },
  { label: 'Сериалы', value: 'series' }
]

const discussedTypeFilters = [
  { label: 'Горячее', value: 'hot' },
  { label: 'Недавнее', value: 'recent' }
]

const currentTypeFilters = computed(() =>
  activeTimeFilter.value === 'discussed' ? discussedTypeFilters : normalTypeFilters
)
const visibleMovies = computed(() => movies.value)
const canShowMore = computed(() => !loading.value && hasMore.value && !errorMessage.value)

const dedupeMoviesByKpId = (items = []) => {
  const seen = new Set()
  const result = []

  for (const item of items) {
    const kpId = String(item?.kp_id || item?.kinopoisk_id || item?.id || '').trim()
    if (!kpId || seen.has(kpId)) continue
    seen.add(kpId)
    result.push(item)
  }

  return result
}

const resetPagination = () => {
  page.value = 1
  hasMore.value = true
}

const fetchMoviesPage = async (nextPage = 1) => {
  const request =
    activeTimeFilter.value === 'discussed'
      ? getDiscussedMovies(typeFilter.value, {
          page: nextPage,
          limit: TOP_MOVIES_PAGE_SIZE
        })
      : getMovies({
          activeTime: activeTimeFilter.value,
          typeFilter: typeFilter.value,
          page: nextPage,
          limit: TOP_MOVIES_PAGE_SIZE
        })

  const nextMovies = await request
  hasMore.value = Array.isArray(nextMovies) && nextMovies.length === TOP_MOVIES_PAGE_SIZE
  page.value = nextPage

  return dedupeMoviesByKpId(Array.isArray(nextMovies) ? nextMovies : [])
}

const showMore = async () => {
  if (loadingMore.value || loading.value || !hasMore.value) return

  loadingMore.value = true
  errorMessage.value = ''
  errorCode.value = null

  try {
    const nextMovies = await fetchMoviesPage(page.value + 1)
    if (nextMovies.length > 0) {
      movies.value = dedupeMoviesByKpId([...movies.value, ...nextMovies])
    } else {
      hasMore.value = false
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
  } finally {
    loadingMore.value = false
  }
}

const disconnectInfiniteScroll = () => {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
}

const setupInfiniteScroll = async () => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

  await nextTick()
  disconnectInfiniteScroll()

  if (!loadMoreSentinel.value) return

  loadMoreObserver = new window.IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        showMore()
      }
    },
    {
      rootMargin: '900px 0px',
      threshold: 0
    }
  )

  loadMoreObserver.observe(loadMoreSentinel.value)
}

const applyRouteFilters = (query) => {
  const nextTime = typeof query.time === 'string' && query.time ? query.time : '24h'
  const nextType = typeof query.type === 'string' && query.type ? query.type : null

  activeTimeFilter.value = nextTime

  if (nextTime === 'discussed') {
    typeFilter.value = nextType || 'hot'
    return
  }

  typeFilter.value = nextType || 'all'
  lastNormalTypeFilter.value = typeFilter.value
}

const fetchMovies = async () => {
  loading.value = true
  errorMessage.value = ''
  errorCode.value = null

  try {
    resetPagination()
    movies.value = await fetchMoviesPage(1)
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    movies.value = []
  } finally {
    loading.value = false
  }
}

applyRouteFilters(route.query)

onServerPrefetch(fetchMovies)

watch(canShowMore, (canLoad) => {
  if (canLoad) {
    setupInfiniteScroll()
  } else {
    disconnectInfiniteScroll()
  }
})

const changeTimeFilter = (apiUrl) => {
  const previousTimeFilter = activeTimeFilter.value
  activeTimeFilter.value = apiUrl

  if (apiUrl === 'discussed') {
    if (previousTimeFilter !== 'discussed') {
      lastNormalTypeFilter.value = typeFilter.value
    }
    typeFilter.value = 'hot'
  } else if (previousTimeFilter === 'discussed') {
    typeFilter.value = lastNormalTypeFilter.value
  }

  router
    .push({
      query: {
        ...route.query,
        time: activeTimeFilter.value,
        type: typeFilter.value
      }
    })
}

const changeTypeFilter = (value) => {
  typeFilter.value = value
  if (activeTimeFilter.value !== 'discussed') {
    lastNormalTypeFilter.value = value
  }

  router
    .push({
      query: {
        ...route.query,
        type: value
      }
    })
}

watch(
  () => route.query,
  (newQuery, oldQuery) => {
    if (newQuery.time === oldQuery?.time && newQuery.type === oldQuery?.type) {
      return
    }

    applyRouteFilters(newQuery)
    fetchMovies().then(setupInfiniteScroll)
  }
)

onMounted(() => {
  applyRouteFilters(route.query)
  if (!movies.value.length && !errorMessage.value) {
    fetchMovies().then(setupInfiniteScroll)
  } else {
    setupInfiniteScroll()
  }
})

onUnmounted(disconnectInfiniteScroll)
</script>

<style scoped>
.wrapper {
  display: flex;
  min-height: 100vh;
}

.top-100-page {
  flex: 1;
  padding-top: 20px;
  padding-bottom: 40px;
  max-width: calc(258px * 5);
  margin: 0 auto;
}

.controls {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-bottom: 20px;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  box-sizing: border-box;
}

.filter-card {
  width: auto;
  background: rgba(37, 37, 37, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  margin: 0;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.card-header {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  position: relative;
}

.card-title {
  font-weight: 600;
  color: #e0e0e0;
  font-size: 1.1em;
  position: relative;
  z-index: 1;
}

.card-title::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #ff6b35, #ff44cc);
  border-radius: 2px;
  opacity: 0.6;
  z-index: -1;
}

.card-icon {
  font-size: 18px;
  color: #ff6b35;
  transition: color 0.3s;
  margin-right: 4px;
  opacity: 0.8;
}

.type-card .card-icon {
  color: #4a90e2;
}

.button-group {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  justify-content: flex-start;
  align-items: center;
  padding: 2px;
}

.button-group::-webkit-scrollbar {
  display: none;
}

.filter-separator {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
  flex-shrink: 0;
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(45, 45, 45, 0.6);
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85em;
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: 80px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}

.filter-btn:hover {
  background: rgba(58, 58, 58, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.time-btn.active {
  background: var(--accent-color);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px var(--accent-transparent);
}

.type-btn.active {
  background: var(--accent-color);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px var(--accent-transparent);
}

@media (max-width: 1000px) {
  .controls {
    flex-direction: column;
    gap: 6px;
    padding: 0 10px;
  }

  .filter-card {
    width: 100%;
  }
}

@media (max-width: 700px) {
  .controls {
    padding: 0 5px;
    gap: 4px;
  }

  .filter-card {
    padding: 4px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .button-group {
    gap: 3px;
  }

  .filter-btn {
    padding: 6px 10px;
    min-width: 70px;
    font-size: 0.8em;
  }

  .card-icon {
    display: none;
  }
}

@media (max-width: 600px) {
  .button-group {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.filter-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
  transform: none !important;
}

.filter-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
  transform: none !important;
}

.load-more-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0 40px;
}

.load-more-sentinel {
  width: 100%;
  height: 1px;
}

.load-more-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  padding: 10px 18px;
}

.load-more-btn:hover {
  background: var(--accent-hover);
}

.load-more-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
