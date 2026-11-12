<template>
  <div class="wrapper">
    <div class="top-100-page" tabindex="0">
      <header v-if="isKinopoiskTop" class="top-header">
        <div class="top-heading">
          <h1>Топ-250</h1>
          <p>Лучшие {{ typeFilter === 'series' ? 'сериалы' : 'фильмы' }} по рейтингу зрителей</p>
        </div>
        <div class="top-tabs" role="group" aria-label="Тип подборки">
          <button
            v-for="btn in currentTypeFilters"
            :key="btn.value"
            class="filter-btn type-btn"
            :class="{ active: typeFilter === btn.value }"
            :aria-pressed="typeFilter === btn.value"
            :disabled="loading"
            @click="changeTypeFilter(btn.value)"
          >
            {{ btn.label }}
          </button>
        </div>
      </header>
      <h1 v-else class="visually-hidden">Популярные фильмы и сериалы</h1>
      <div v-if="!isKinopoiskTop" class="controls">
        <div v-if="!isKinopoiskTop" class="filter-card time-card">
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
        :show-rank="isKinopoiskTop"
      />
      <div v-if="canShowMore" class="load-more-wrap">
        <div ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true"></div>
        <div
          v-if="loadingMore"
          class="skeleton-row"
          :class="`skeleton-row--${mainStore.cardSize}`"
          aria-hidden="true"
        >
          <span v-for="n in 7" :key="n" class="skeleton-poster"></span>
        </div>
        <!-- Pages load on scroll; the button only retries a failed page and keeps the list. -->
        <button v-if="loadMoreFailed" class="load-more-btn" type="button" @click="retryShowMore">
          Не удалось загрузить. Повторить
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
import { useHead } from '@unhead/vue'
import { buildStaticPageHead } from '@/utils/staticSeo'
import { useMainStore } from '@/store/main'
import { usePublicPageState } from '@/composables/usePublicPageState'

const mainStore = useMainStore()
const isKinopoiskTop = computed(() => mainStore.contentApiProvider !== 'local')

useHead(() =>
  buildStaticPageHead({
    routePath: '/top',
    title: isKinopoiskTop.value
      ? 'Топ-250 фильмов и сериалов Кинопоиска - ReYohoho'
      : 'Популярные фильмы и сериалы онлайн - ReYohoho',
    description: isKinopoiskTop.value
      ? '250 лучших фильмов и сериалов по рейтингу Кинопоиска. Русские названия, постеры и рейтинги.'
      : 'Популярные фильмы и сериалы за сутки, неделю, месяц и всё время. Фильтры по типу и обсуждаемости на ReYohoho.'
  })
)

const movies = ref([])
const loading = ref(false)
import { DEFAULT_ACTIVE_TIME } from '@/constants'
const activeTimeFilter = ref(DEFAULT_ACTIVE_TIME)
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
const loadMoreFailed = ref(false)
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
  isKinopoiskTop.value
    ? normalTypeFilters.filter((filter) => filter.value !== 'all')
    : activeTimeFilter.value === 'discussed'
      ? discussedTypeFilters
      : normalTypeFilters
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
  loadMoreFailed.value = false
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
  if (loadingMore.value || loading.value || !hasMore.value || loadMoreFailed.value) return

  loadingMore.value = true

  try {
    const nextMovies = await fetchMoviesPage(page.value + 1)
    if (nextMovies.length > 0) {
      movies.value = dedupeMoviesByKpId([...movies.value, ...nextMovies])
    } else {
      hasMore.value = false
    }
  } catch (error) {
    console.error('Ошибка догрузки топа:', error)
    loadMoreFailed.value = true
  } finally {
    loadingMore.value = false
  }
}

const retryShowMore = () => {
  loadMoreFailed.value = false
  showMore()
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
  if (isKinopoiskTop.value) {
    activeTimeFilter.value = 'top250'
    typeFilter.value = query.type === 'series' ? 'series' : 'movie'
    lastNormalTypeFilter.value = typeFilter.value
    return
  }
  const nextTime = typeof query.time === 'string' && query.time ? query.time : DEFAULT_ACTIVE_TIME
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
const publicPage = usePublicPageState(`top:${route.fullPath}`)
const initialPage = publicPage.read()
if (initialPage && isKinopoiskTop.value) {
  movies.value = initialPage.movies
  hasMore.value = initialPage.hasMore
  page.value = initialPage.page
}

onServerPrefetch(async () => {
  await fetchMovies()
  if (!errorMessage.value)
    publicPage.save({ movies: movies.value, hasMore: hasMore.value, page: page.value })
})

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

  router.push({
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

  router.push({
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
  // Prerendered cards use the default remote provider, not persisted local preferences.
  if (!isKinopoiskTop.value || (!movies.value.length && !errorMessage.value)) {
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
  min-width: 0;
  min-height: 100vh;
}

.top-100-page {
  flex: 1;
  min-width: 0;
  padding-top: var(--page-top);
  padding-bottom: 40px;
  width: 100%;
  margin: 0 auto;
}

.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 24px;
  padding: 0 24px;
  margin-bottom: 24px;
}

.top-heading {
  min-width: 0;
}

.top-heading h1 {
  margin: 0;
  font-size: var(--fs-2xl);
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.top-heading p {
  margin: 6px 0 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
  line-height: 1.5;
}

.top-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-s);
  background: rgba(255, 255, 255, 0.05);
}

.top-tabs .type-btn {
  min-width: 0;
  min-height: 38px;
  padding: 0 16px;
  border: none;
  border-radius: var(--radius-s);
  background: none;
  box-shadow: none;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-weight: 500;
  transform: none;
}

.top-tabs .type-btn:hover {
  color: #fff;
}

.top-tabs .type-btn:hover:not(.active) {
  background: none;
  box-shadow: none;
  transform: none;
}

.top-tabs .type-btn.active {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: none;
  color: #fff;
}

.top-tabs .type-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
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
  border-radius: var(--radius-l);
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
  border-radius: var(--radius-m);
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
  background: var(--accent-solid);
  border-color: transparent;
  color: var(--accent-contrast);
  box-shadow: 0 2px 8px var(--accent-transparent);
}

.type-btn.active {
  background: var(--accent-solid);
  border-color: transparent;
  color: var(--accent-contrast);
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
  .top-header {
    padding: 0 12px;
    margin-bottom: 16px;
  }

  .top-tabs {
    width: 100%;
    box-sizing: border-box;
  }

  .top-tabs .type-btn {
    flex: 1;
    min-height: 44px;
  }

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
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.load-more-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 28px 16px;
  box-sizing: border-box;
  width: 100%;
  max-height: 300px;
  padding: 0 24px;
  overflow: hidden;
}

.skeleton-row--small {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.skeleton-row--large {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.skeleton-poster {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-m);
  background: linear-gradient(100deg, #141414 30%, #1e1e1e 50%, #141414 70%) 0 0 / 200% 100%;
  animation: top-skeleton-shimmer 1.4s linear infinite;
}

@keyframes top-skeleton-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 620px) {
  .skeleton-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 10px;
    max-height: 200px;
    padding: 0 12px;
  }

  .skeleton-row--large {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 12px;
    max-height: 280px;
  }
}
</style>
