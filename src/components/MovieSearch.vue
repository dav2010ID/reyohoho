<template>
  <div class="wrapper">
    <div class="mainpage">
      <h1 class="visually-hidden">Поиск фильмов и сериалов онлайн</h1>
      <!-- Front-page header: wordmark, one search field with its mode switch, random pick. -->
      <div class="home-top">
        <span class="home-wordmark" aria-hidden="true">ReYohoho</span>
        <div class="search-bar" :class="{ 'wrong-layout': showLayoutWarning }" role="search">
          <div class="search-type-buttons" role="group" aria-label="Искать по">
            <button
              type="button"
              :class="{ active: searchType === 'title' }"
              :aria-pressed="searchType === 'title'"
              @click="setSearchType('title')"
            >
              Название
            </button>
            <button
              type="button"
              :class="{ active: searchType === 'kinopoisk' }"
              :aria-pressed="searchType === 'kinopoisk'"
              @click="setSearchType('kinopoisk')"
            >
              ID КП
            </button>
            <button
              v-if="shikiAvailable"
              type="button"
              :class="{ active: searchType === 'shikimori' }"
              :aria-pressed="searchType === 'shikimori'"
              @click="setSearchType('shikimori')"
            >
              ID Shikimori
            </button>
            <button
              v-if="imdbAvailable"
              type="button"
              :class="{ active: searchType === 'imdb' }"
              :aria-pressed="searchType === 'imdb'"
              @click="setSearchType('imdb')"
            >
              ID IMDb
            </button>
          </div>
          <div class="input-wrapper">
            <input
              ref="searchInput"
              v-model="searchTerm"
              :placeholder="getPlaceholder()"
              aria-label="Поиск фильмов и сериалов"
              class="search-input"
              :class="{ 'wrong-layout': showLayoutWarning }"
              :inputmode="searchType === 'title' ? 'text' : 'numeric'"
              @keydown.enter.prevent="search"
              @keydown.tab="handleTabKey"
              @keydown.down.prevent="focusFirstMovieCard"
              @input="handleInput"
            />
            <div class="icons">
              <button
                v-if="searchTerm"
                class="reset-button"
                aria-label="Очистить поиск"
                @click="resetSearch"
              >
                <i class="fas fa-times"></i>
              </button>
              <button class="search-button" aria-label="Найти фильм" @click="search">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div v-if="showLayoutWarning" class="layout-warning" :class="{ show: showLayoutWarning }">
            <i class="fas fa-keyboard"></i>
            Возможно, вы используете неправильную раскладку. Нажмите Tab для переключения на
            {{ suggestedLayout }} раскладку
          </div>
        </div>
        <button
          class="random-button"
          type="button"
          :disabled="randomLoading"
          @click="openRandomMovie"
        >
          <i class="fas fa-dice" aria-hidden="true"></i>
          {{ randomLoading ? 'Подбираем...' : 'Случайный' }}
        </button>
      </div>

      <!-- Контейнер для истории и результатов -->
      <div class="content-container">
        <HistoryMigrationNotice v-show="!searchTerm" />
        <!-- История просмотра -->
        <div v-show="!searchTerm">
          <div class="home-history-block">
            <div v-if="history.length > 0 || historyLoading" class="home-section-head">
              <h2>Продолжить просмотр</h2>
              <template v-if="history.length > 0">
                <button type="button" class="text-action" @click="showModal = true">
                  Очистить
                </button>
                <router-link
                  :to="{ name: 'lists', query: { type: USER_LIST_TYPES_ENUM.HISTORY } }"
                  class="text-action home-shelf__all"
                  >Весь список&nbsp;<span class="sym" aria-hidden="true">→</span></router-link
                >
                <RibbonNav
                  v-if="!isMobile"
                  container=".home-history-block"
                  scroller=".grid"
                  label="Продолжить просмотр"
                />
                <BaseModal
                  :is-open="showModal"
                  message="Вы уверены, что хотите очистить историю?"
                  @confirm="clearAllHistory"
                  @close="showModal = false"
                />
              </template>
            </div>
            <div v-if="historyLoading" class="loading-container">
              <SpinnerLoading />
            </div>
            <MovieList
              v-else-if="historyActivated && history.length"
              class="home-history"
              :movies-list="history"
              :is-history="true"
              :loading="false"
              ribbon
              @item-deleted="handleItemDeleted"
            />
          </div>
          <!-- Shelves: the Top-250 films and series as ribbons; the full lists live on /top. -->
          <div class="home-shelves">
            <section
              v-for="shelf in topShelves"
              :key="shelf.key"
              class="home-shelf"
              :class="`home-shelf--${shelf.key}`"
            >
              <div class="home-section-head">
                <h2>{{ shelf.title }}</h2>
                <router-link :to="shelf.link" class="text-action home-shelf__all"
                  >Весь список&nbsp;<span class="sym" aria-hidden="true">→</span></router-link
                >
                <RibbonNav
                  v-if="!isMobile"
                  :container="`.home-shelf--${shelf.key}`"
                  scroller=".grid"
                  :label="shelf.title"
                />
              </div>
              <MovieList
                :movies-list="shelf.movies"
                :is-history="false"
                :loading="false"
                :show-rank="isTopList"
                ribbon="posters"
              />
            </section>
            <div v-if="topShelvesLoading" class="home-shelf" aria-hidden="true">
              <div class="home-section-head"><span class="skeleton-title"></span></div>
              <div
                class="skeleton-row skeleton-row--ribbon"
                :class="`skeleton-row--${mainStore.cardSize}`"
              >
                <span v-for="n in 8" :key="n" class="skeleton-poster"></span>
              </div>
            </div>
            <div v-else-if="topShelvesFailed" class="home-load-more">
              <button class="home-load-more__button" type="button" @click="loadHomeShelves">
                Не удалось загрузить. Повторить
              </button>
            </div>
            <p
              v-else-if="!topShelves.length && !history.length && !historyLoading"
              class="home-empty"
            >
              Здесь пока пусто
            </p>
          </div>
        </div>
        <ErrorMessage
          v-if="!searchTerm && errorMessage"
          :message="errorMessage"
          :code="errorCode"
        />

        <!-- Результаты поиска -->
        <div v-if="searchPerformed" ref="searchResults">
          <div class="home-section-head">
            <h2>Результаты поиска</h2>
          </div>
          <MovieList
            v-if="movies.length > 0 || loading"
            :movies-list="movies"
            :is-history="false"
            :loading="loading"
            show-original-title
          />
          <div v-if="movies.length === 0 && !loading && !errorMessage" class="no-results">
            <span class="material-icons" aria-hidden="true">movie</span>
            <p>Ничего не найдено по «{{ searchTerm }}»</p>
            <div class="no-results__actions">
              <button
                v-if="convertedSearchTerm"
                type="button"
                class="no-results__action no-results__action--primary"
                @click="searchConverted"
              >
                Искать «{{ convertedSearchTerm }}»
              </button>
              <button type="button" class="no-results__action" @click="openRandomMovie">
                <i class="fas fa-dice" aria-hidden="true"></i> Случайный фильм
              </button>
            </div>
          </div>
          <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />
        </div>

        <!-- Подсказка, когда ничего не введено в поиске -->
        <div
          v-if="searchTerm && !searchPerformed && !loading && !errorMessage"
          class="search-prompt"
        >
          Нажмите кнопку "Поиск" или Enter для поиска
        </div>
      </div>
    </div>
    <component
      :is="RandomMovieModal"
      v-if="RandomMovieModal"
      :is-open="showRandomModal"
      :movie="randomMovie"
      :loading="randomLoading"
      :error="randomError"
      @close="closeRandomModal"
      @get-new-movie="fetchRandomMovie"
    />
  </div>
</template>

<script setup>
import {
  apiSearch,
  getKpIDfromIMDB,
  getKpIDfromSHIKI,
  getMovies,
  getRandomMovie,
  getKpInfo
} from '@/api/movies'
import { handleApiError } from '@/constants'
import { legacyMovieMethodAvailable } from '@/api/movieCapabilities'
import { getLegacyShikiId } from '@/helpers/hashHandler'
import { getMyLists, delAllFromList } from '@/api/user'
import BaseModal from '@/components/BaseModal.vue'
import RibbonNav from '@/components/movie/RibbonNav.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import { MovieList } from '@/components/MovieList/'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { USER_LIST_TYPES_ENUM, DEFAULT_ACTIVE_TIME } from '@/constants'
import { hasConsecutiveConsonants, suggestLayout, convertLayout } from '@/utils/keyboardLayout'
import { normalizeBasePath } from '@/utils/basePath'
import debounce from 'lodash.debounce'
import { computed, onMounted, onServerPrefetch, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import HistoryMigrationNotice from '@/components/HistoryMigrationNotice.vue'
import { getMovieSeoPath } from '@/utils/movieSeo'
import { debugLog } from '@/utils/logger'
import { createLatestRequestGuard } from '@/utils/latestRequest'
import { normalizeRandomMovie } from '@/utils/randomMovie'
import { isRequestCanceled } from '@/utils/requestCancellation'
import { logoutAndRedirect } from '@/utils/authSession'
import { usePublicPageState } from '@/composables/usePublicPageState'

const mainStore = useMainStore()
const authStore = useAuthStore()
const router = useRouter()

const searchType = ref('title')
const shikiAvailable = computed(() => legacyMovieMethodAvailable('getKpIDfromSHIKI'))
const imdbAvailable = computed(() => legacyMovieMethodAvailable('getKpIDfromIMDB'))
const searchTerm = ref('')
const movies = ref([])
const loading = ref(false)
const historyLoading = ref(false)
const searchPerformed = ref(false)
const showModal = ref(false)
const errorMessage = ref('')
const errorCode = ref(null)
const isMobile = computed(() => mainStore.isMobile)
const history = ref([])
// Personal history is client data. Mount its cards only after the first display.
const historyActivated = ref(false)
const deletedHistoryIds = ref(new Set())
const HOME_SHELF_SIZE = 20
const topShelves = ref([])
const topShelvesLoading = ref(false)
const topShelvesFailed = ref(false)
// The same list is called the same everywhere: Kinopoisk providers serve the Top-250.
const isTopList = computed(() => mainStore.contentApiProvider !== 'local')
const topListTitle = computed(() => (isTopList.value ? 'Топ-250' : 'Популярное'))
const shelfDefinitions = computed(() =>
  isTopList.value
    ? [
        {
          key: 'movie',
          title: 'Топ-250 · Фильмы',
          link: '/top',
          params: { activeTime: 'top250', typeFilter: 'movie' }
        },
        {
          key: 'series',
          title: 'Топ-250 · Сериалы',
          link: '/top?type=series',
          params: { activeTime: 'top250', typeFilter: 'series' }
        }
      ]
    : [
        {
          key: 'popular',
          title: topListTitle.value,
          link: '/top',
          params: { activeTime: DEFAULT_ACTIVE_TIME, typeFilter: 'all' }
        }
      ]
)
const publicPage = usePublicPageState('home')
const initialPage = publicPage.read()
if (Array.isArray(initialPage?.shelves) && mainStore.contentApiProvider !== 'local') {
  topShelves.value = initialPage.shelves
}
const searchRequestGuard = createLatestRequestGuard()
const randomRequestGuard = createLatestRequestGuard()

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

const showLayoutWarning = ref(false)
const suggestedLayout = ref('')

// Loaded on the first "Случайный", then kept mounted for its transitions.
const RandomMovieModal = shallowRef(null)
const loadRandomMovieModal = async () => {
  if (RandomMovieModal.value) return
  try {
    RandomMovieModal.value = (await import('@/components/RandomMovieModal.vue')).default
  } catch (error) {
    console.error('Не удалось загрузить окно случайного фильма:', error)
  }
}
const showRandomModal = ref(false)
const randomMovie = ref(null)
const randomLoading = ref(false)
const randomError = ref('')

const searchInput = ref(null)
const searchResults = ref(null)
const siteOrigin = import.meta.env.VITE_SITE_ORIGIN || 'https://reyhoho.fun'
const basePath = normalizeBasePath(import.meta.env.VITE_BASE_URL || '/')
const canonicalUrl = `${siteOrigin}${basePath || ''}/`
const homeTitle = 'ReYohoho - поиск фильмов и сериалов онлайн бесплатно'
const homeDescription =
  'ReYohoho - онлайн-поиск фильмов и сериалов с быстрым переходом к просмотру, рейтингами, подборками, историей просмотров и удобной навигацией.'

useHead({
  title: homeTitle,
  link: [
    { rel: 'canonical', href: canonicalUrl },
    { rel: 'alternate', hreflang: 'ru', href: canonicalUrl },
    { rel: 'alternate', hreflang: 'x-default', href: canonicalUrl }
  ],
  meta: [
    { name: 'description', content: homeDescription },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: 'ReYohoho - поиск фильмов и сериалов онлайн' },
    { property: 'og:description', content: homeDescription },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:locale', content: 'ru_RU' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: 'ReYohoho - поиск фильмов и сериалов онлайн' },
    { name: 'twitter:description', content: homeDescription }
  ],
  script: [
    {
      type: 'application/ld+json',
      textContent: JSON.stringify([
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'ReYohoho',
          url: canonicalUrl,
          logo: `${siteOrigin}${basePath || ''}/icons/icon-192x192.png`
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'ReYohoho',
          url: canonicalUrl,
          inLanguage: 'ru',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${canonicalUrl}#search={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        }
      ])
    }
  ]
})

const loadHomeShelves = async () => {
  topShelvesLoading.value = true
  topShelvesFailed.value = false
  const definitions = shelfDefinitions.value
  const results = await Promise.allSettled(
    definitions.map((shelf) => getMovies({ ...shelf.params, page: 1, limit: HOME_SHELF_SIZE }))
  )
  topShelves.value = definitions
    .map((shelf, index) => ({
      key: shelf.key,
      title: shelf.title,
      link: shelf.link,
      movies:
        results[index].status === 'fulfilled' && Array.isArray(results[index].value)
          ? dedupeMoviesByKpId(results[index].value).slice(0, HOME_SHELF_SIZE)
          : []
    }))
    .filter((shelf) => shelf.movies.length > 0)
  const rejected = results.filter((result) => result.status === 'rejected')
  rejected.forEach((result) => console.error('Ошибка загрузки полки главной:', result.reason))
  topShelvesFailed.value = topShelves.value.length === 0 && rejected.length > 0
  topShelvesLoading.value = false
}

onServerPrefetch(async () => {
  await loadHomeShelves()
  publicPage.save({ shelves: topShelves.value })
})

watch(
  () => authStore.token,
  async (token) => {
    if (token) {
      history.value = mainStore.history
      historyLoading.value = mainStore.history.length === 0
      try {
        const serverHistory = (await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)).filter(
          (item) => !deletedHistoryIds.value.has(String(item.kp_id))
        )
        mainStore.setHistory(serverHistory)
        history.value = serverHistory
      } catch (error) {
        const { message, code } = handleApiError(error)
        errorMessage.value = message
        errorCode.value = code
        console.error('Ошибка загрузки истории:', error)
        if (code === 401) {
          await logoutAndRedirect({ authStore, router })
        }
      } finally {
        historyLoading.value = false
      }
      return
    }

    history.value = mainStore.history
  },
  { immediate: true }
)

watch(
  () => mainStore.history,
  (newHistory) => {
    history.value = newHistory
  },
  { deep: true }
)

function handleItemDeleted(deletedItemId) {
  deletedHistoryIds.value.add(String(deletedItemId))
  history.value = history.value.filter((item) => String(item.kp_id) !== String(deletedItemId))
}

// Установка типа поиска
const setSearchType = (type) => {
  searchType.value = type
  resetSearch()
  showLayoutWarning.value = false
}

const handleInput = (event) => {
  errorMessage.value = ''
  errorCode.value = null

  if (searchType.value === 'title') {
    searchTerm.value = event.target.value
    if (isMobile.value) return
    showLayoutWarning.value = hasConsecutiveConsonants(searchTerm.value)
    if (showLayoutWarning.value) {
      suggestedLayout.value = suggestLayout(searchTerm.value)
    }
  } else {
    searchTerm.value = event.target.value.replace(/\D+/g, '')
  }
}

const handleTabKey = (event) => {
  if (showLayoutWarning.value && !event.shiftKey) {
    event.preventDefault()
    searchTerm.value = convertLayout(searchTerm.value)
    showLayoutWarning.value = false
  }
}

// Получение placeholder для input
const getPlaceholder = () => {
  return (
    {
      title: 'Введите название фильма',
      kinopoisk: 'Пример: 301 (Матрица)',
      shikimori: 'Пример: 28171 (Повар-боец Сома)',
      imdb: 'Пример: 0198781 (Корпорация монстров)'
    }[searchType.value] || 'Введите название фильма'
  )
}

// Очистка поиска
const resetSearch = () => {
  searchRequestGuard.invalidate()
  loading.value = false
  searchTerm.value = ''
  movies.value = []
  searchPerformed.value = false
  showLayoutWarning.value = false
  errorMessage.value = ''
  errorCode.value = null
  searchInput.value?.focus()
}

// Empty results: offer the same query typed in the other keyboard layout.
const convertedSearchTerm = computed(() => {
  if (searchType.value !== 'title' || !searchTerm.value) return ''
  const converted = convertLayout(searchTerm.value)
  // Offer it only when the result reads as words, not as stray brackets and symbols.
  const readable = /^[\p{L}\p{N}\s.,:!?'-]+$/u.test(converted)
  return readable && converted !== searchTerm.value ? converted : ''
})

const searchConverted = () => {
  searchTerm.value = convertedSearchTerm.value
  search()
}

const search = () => {
  debouncedPerformSearch.cancel()
  if (searchTerm.value) {
    errorMessage.value = ''
    errorCode.value = null
    performSearch()
  }
}

watch([shikiAvailable, imdbAvailable], () => {
  if (
    (searchType.value === 'shikimori' && !shikiAvailable.value) ||
    (searchType.value === 'imdb' && !imdbAvailable.value)
  )
    setSearchType('title')
})

const performSearch = async () => {
  const requestId = searchRequestGuard.begin()
  const signal = searchRequestGuard.getSignal(requestId)
  const requestedTerm = searchTerm.value
  loading.value = true
  searchPerformed.value = true
  movies.value = []

  try {
    if (searchType.value === 'kinopoisk') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }
      router.push(getMovieSeoPath({ kp_id: searchTerm.value }))
      return
    }

    if (searchType.value === 'imdb') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }

      let response = null
      try {
        response = await getKpIDfromIMDB(requestedTerm, { signal })
        if (!searchRequestGuard.isLatest(requestId)) return
      } catch (error) {
        if (!searchRequestGuard.isLatest(requestId)) return
        if (error.response?.status === 404) {
          errorMessage.value = 'IMDb ID не найден'
          errorCode.value = 404
          return
        }
        throw error
      }

      if (response.id_kp) {
        router.push(getMovieSeoPath({ kp_id: `${response.id_kp}` }))
      } else {
        errorMessage.value = 'IMDb ID не найден'
        errorCode.value = 404
      }
      return
    }

    if (searchType.value === 'shikimori') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }

      try {
        const response = await getKpIDfromSHIKI(requestedTerm, { signal })
        if (!searchRequestGuard.isLatest(requestId)) return
        const kpId = response?.id_kp || response?.kinopoisk_id
        if (kpId) {
          router.push(getMovieSeoPath({ kp_id: `${kpId}` }))
          return
        }
      } catch (e) {
        debugLog('Switch to kodik', e)
      }

      if (!searchRequestGuard.isLatest(requestId)) return
      router.push({ name: 'movie-info-shiki', params: { shiki_id: requestedTerm } })
      return
    }
    if (searchType.value === 'title') {
      const response = await apiSearch(requestedTerm, { signal })
      if (!searchRequestGuard.isLatest(requestId)) return
      movies.value = response.map((movie) => ({
        ...movie,
        kp_id: movie.id.toString(),
        rating_kp:
          movie.rating_kp ?? (movie.raw_data?.rating !== 'null' ? movie.raw_data?.rating : null),
        type: movie.raw_data?.type
      }))
    }
  } catch (error) {
    if (!searchRequestGuard.isLatest(requestId)) return
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    if (code !== 404) {
      console.error('Ошибка при поиске:', error)
    }
  } finally {
    if (searchRequestGuard.isLatest(requestId)) {
      loading.value = false
    }
  }
}

const clearAllHistory = async () => {
  historyLoading.value = true
  if (authStore.token) {
    try {
      await delAllFromList(USER_LIST_TYPES_ENUM.HISTORY)
      deletedHistoryIds.value.clear()
      mainStore.clearAllHistory()
      history.value = []
      if (!topShelves.value.length) {
        loadHomeShelves()
      }
      historyLoading.value = false
      showModal.value = false
    } catch (error) {
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      console.error('Ошибка загрузки истории:', error)
      if (code === 401) {
        await logoutAndRedirect({ authStore, router })
      }
      historyLoading.value = false
      showModal.value = false
    }
  } else {
    mainStore.clearAllHistory()
    history.value = []
    if (!topShelves.value.length) {
      loadHomeShelves()
    }
    historyLoading.value = false
    showModal.value = false
  }
}

const debouncedPerformSearch = debounce(() => {
  if (searchTerm.value.length >= 2) {
    performSearch()
  } else if (searchTerm.value.length < 2) {
    searchRequestGuard.invalidate()
    loading.value = false
    movies.value = []
    searchPerformed.value = false
  }
}, 700)

onMounted(() => {
  if (!topShelves.value.length) loadHomeShelves()
  const hash = window.location.hash
  const shikiId = getLegacyShikiId(hash)
  if (hash.startsWith('#search=')) {
    const searchQuery = decodeURIComponent(hash.replace('#search=', ''))
    searchTerm.value = searchQuery
    performSearch()
  } else if (imdbAvailable.value && hash.startsWith('#imdb=')) {
    const imdbId = decodeURIComponent(hash.replace('#imdb=', ''))
    setSearchType('imdb')
    searchTerm.value = imdbId
    performSearch()
  } else if (shikiAvailable.value && shikiId) {
    setSearchType('shikimori')
    searchTerm.value = shikiId
    performSearch()
  }
  if (!searchTerm.value) historyActivated.value = true
  // On phones focus would open the keyboard over the shelves (App sets isMobile after this mounts).
  if (window.innerWidth >= 600) searchInput.value?.focus()
})

// "Все результаты по «…»" in the search modal links here with #search= while home is open.
const removeSearchHashHook = router.afterEach?.((to) => {
  if (to.name !== 'home' || !to.hash?.startsWith('#search=')) return
  const query = decodeURIComponent(to.hash.replace('#search=', ''))
  if (!query || query === searchTerm.value) return
  setSearchType('title')
  searchTerm.value = query
  performSearch()
})

onUnmounted(() => {
  removeSearchHashHook?.()
  randomRequestGuard.invalidate()
  debouncedPerformSearch.cancel()
  searchRequestGuard.invalidate()
})

// Автопоиск с задержкой (только для поиска по названию)
watch(searchTerm, () => {
  if (!searchTerm.value) historyActivated.value = true
  if (searchType.value !== 'title') {
    return
  }
  debouncedPerformSearch()
})

const focusFirstMovieCard = () => {
  if (movies.value.length > 0) {
    const firstMovieCard = searchResults.value?.querySelector('.movie-card')
    if (firstMovieCard) {
      firstMovieCard.focus()
    }
  }
}

const openRandomMovie = () => {
  loadRandomMovieModal()
  showRandomModal.value = true
  fetchRandomMovie()
}

const closeRandomModal = () => {
  randomRequestGuard.invalidate()
  randomLoading.value = false
  showRandomModal.value = false
  randomMovie.value = null
  randomError.value = ''
}

const fetchRandomMovie = async () => {
  const requestId = randomRequestGuard.begin()
  const signal = randomRequestGuard.getSignal(requestId)
  randomLoading.value = true
  randomError.value = ''
  randomMovie.value = null

  try {
    const response = await getRandomMovie({ signal })
    if (!randomRequestGuard.isLatest(requestId)) return
    if (!response?.kp_id) throw new Error('Random movie has no identifier')

    try {
      const kpInfo = await getKpInfo(response.kp_id, { signal, timeout: 15000 })
      if (!randomRequestGuard.isLatest(requestId)) return
      randomMovie.value = normalizeRandomMovie(response, kpInfo || {})
    } catch (error) {
      if (isRequestCanceled(error) || !randomRequestGuard.isLatest(requestId)) return
      randomMovie.value = normalizeRandomMovie(response)
    }
  } catch (error) {
    if (isRequestCanceled(error) || !randomRequestGuard.isLatest(requestId)) return
    randomError.value = 'Не удалось подобрать фильм. Попробуйте ещё раз чуть позже.'
    console.error('Ошибка при получении случайного фильма:', error)
  } finally {
    if (randomRequestGuard.isLatest(requestId)) randomLoading.value = false
  }
}
</script>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.mainpage {
  flex: 1;
  padding-bottom: 40px;
}

/* Front-page header: wordmark left, one 48px search field, random pick at the end. */
.home-top {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: var(--page-top) 24px 0;
}

.home-wordmark {
  flex-shrink: 0;
  color: #fff;
  font-family: 'Neucha', sans-serif;
  font-size: var(--fs-2xl);
  line-height: 1;
}

.search-bar {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  max-width: 640px;
  min-height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: var(--surface-raised);
  transition: border-color 0.2s ease;
}

.search-bar:focus-within {
  border-color: var(--accent-ui);
}

.search-bar.wrong-layout {
  border-color: #ff8c00;
}

/* Segmented mode switch inside the field. */
.search-type-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  margin-left: 4px;
  padding: 3px;
  border-radius: var(--radius-s);
  background: rgba(255, 255, 255, 0.05);
}

.search-type-buttons button {
  min-height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-s);
  background: none;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.search-type-buttons button:hover {
  color: #fff;
}

.search-type-buttons button.active {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.search-type-buttons button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.input-wrapper {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 46px;
  padding: 0 96px 0 12px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 16px;
}

.search-input::placeholder {
  color: var(--text-faint);
}

.search-input:focus {
  outline: none;
}

.icons {
  position: absolute;
  top: 50%;
  right: 2px;
  display: flex;
  align-items: center;
  gap: 0;
  transform: translateY(-50%);
}

.reset-button,
.search-button {
  width: 44px;
  height: 44px;
  padding: 12px;
  border: none;
  background: none;
  color: #fff;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.reset-button:hover,
.search-button:hover {
  opacity: 1;
}

.reset-button i,
.search-button i {
  display: block;
  width: 20px;
  height: 20px;
  font-size: 18px;
}

.random-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font-size: var(--fs-m);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.random-button i {
  color: var(--accent-text);
}

.random-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.random-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.random-button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Section heads: left-aligned title with optional actions at the end. */
.home-section-head {
  display: flex;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  margin: 40px 0 16px;
  padding: 0 24px;
}

.home-section-head h2 {
  margin: 0;
  color: #fff;
  font-size: var(--fs-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.home-section-head :deep(.ribbon-nav) {
  margin-left: auto;
}

.text-action {
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--text-dim);
  font-size: var(--fs-s);
  cursor: pointer;
}

.text-action:hover {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.text-action:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Empty search result */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 8px 24px 32px;
  box-sizing: border-box;
  color: #fff;
  font-size: var(--fs-l);
}

.no-results .material-icons {
  color: var(--text-faint);
  font-size: 40px;
}

.no-results p {
  margin: 0;
  overflow-wrap: anywhere;
}

.no-results__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.no-results__action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font-size: var(--fs-m);
  cursor: pointer;
}

.no-results__action--primary {
  border-color: var(--accent-solid);
  background: var(--accent-solid);
  color: var(--accent-contrast);
  font-weight: 600;
}

.no-results__action:hover {
  background: rgba(255, 255, 255, 0.06);
}

.no-results__action--primary:hover {
  background: var(--accent-solid-hover);
}

.search-prompt {
  margin-top: 32px;
  padding: 0 24px;
  color: var(--text-dim);
  font-size: var(--fs-m);
}

.layout-warning {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 140, 0, 0.5);
  border-radius: var(--radius-m);
  background: #1e1408;
  color: #ff8c00;
  font-size: 14px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.layout-warning.show {
  opacity: 1;
  transform: translateY(0);
}

.layout-warning i {
  color: #ff8c00;
  font-size: 16px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
}

.home-shelves {
  min-height: 200px;
}

.home-shelf__all {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  color: var(--text-dim);
  text-decoration: none;
  white-space: nowrap;
}

.home-shelf__all:hover,
.home-shelf__all:focus-visible {
  color: #fff;
}

.home-shelf__all ~ :deep(.ribbon-nav) {
  margin-left: 0;
}

.skeleton-title {
  width: 220px;
  height: 24px;
  border-radius: var(--radius-s);
  background: #141414;
}

.home-empty {
  margin: 40px 24px 0;
  color: var(--text-dim);
  font-size: var(--fs-m);
}

.home-load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 20px 0 10px;
}

.home-load-more__button {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.home-load-more__button:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* Skeleton posters while the next page loads. */
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

/* Shelf placeholder: the same posters in one row, sized like the shelf. */
.skeleton-row--ribbon {
  --shelf-card: 168px;
  display: flex;
  gap: 16px;
  max-height: none;
}

.skeleton-row--ribbon.skeleton-row--small {
  --shelf-card: 140px;
}

.skeleton-row--ribbon.skeleton-row--large {
  --shelf-card: 320px;
}

.skeleton-row--ribbon .skeleton-poster {
  flex: 0 0 var(--shelf-card);
}

.skeleton-poster {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-m);
  background: linear-gradient(100deg, #141414 30%, #1e1e1e 50%, #141414 70%) 0 0 / 200% 100%;
  animation: skeleton-shimmer 1.4s linear infinite;
}

@keyframes skeleton-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-poster {
    animation: none;
  }
}

@media (max-width: 900px) {
  .home-top {
    flex-wrap: wrap;
    gap: 12px 16px;
  }

  .search-bar {
    flex-basis: 100%;
    order: 3;
    max-width: none;
  }
}

@media (max-width: 620px) {
  .home-top {
    padding: var(--page-top) 12px 0;
  }

  .home-wordmark {
    font-size: var(--fs-xl);
  }

  .random-button {
    margin-left: auto;
    padding: 0 12px;
    font-size: var(--fs-s);
  }

  /* Phones: the mode switch sits above the field so the input keeps its width. */
  .search-bar {
    flex-wrap: wrap;
    gap: 6px;
    padding: 0;
    border: none;
    background: transparent;
  }

  .search-type-buttons {
    order: -1;
    width: 100%;
    margin: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .search-type-buttons button {
    flex: 1 0 auto;
    min-height: 44px;
  }

  .input-wrapper {
    flex-basis: 100%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: var(--radius-m);
    background: var(--surface-raised);
  }

  .search-bar:focus-within {
    border-color: transparent;
  }

  .search-bar:focus-within .input-wrapper {
    border-color: var(--accent-ui);
  }

  .search-bar.wrong-layout .input-wrapper {
    border-color: #ff8c00;
  }

  .home-section-head {
    margin: 28px 0 12px;
    padding: 0 12px;
  }

  .home-section-head h2 {
    font-size: var(--fs-l);
  }

  .no-results,
  .search-prompt {
    padding-right: 12px;
    padding-left: 12px;
  }

  .skeleton-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 10px;
    max-height: 200px;
    padding: 0 12px;
  }

  .skeleton-row--ribbon {
    --shelf-card: 118px;
    gap: 10px;
  }

  .skeleton-row--ribbon.skeleton-row--small {
    --shelf-card: 96px;
  }

  .skeleton-row--ribbon.skeleton-row--large {
    --shelf-card: 240px;
  }
}
</style>
