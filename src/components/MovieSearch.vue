<template>
  <div class="wrapper">
    <div class="mainpage">
      <section class="page-intro" aria-labelledby="home-title">
        <h1 id="home-title">Поиск фильмов и сериалов онлайн в ReYohoho</h1>
        <p class="page-intro__lead">
          Ищите фильмы и сериалы по названию, ID Кинопоиск, Shikimori или IMDb, открывайте
          карточки с рейтингами и быстро переходите к просмотру.
        </p>
        <p class="page-intro__text">
          На главной странице доступны история просмотров, популярное сейчас, быстрый поиск и
          навигация по основным разделам каталога.
        </p>
        <nav class="page-intro__links" aria-label="Основные разделы">
          <RouterLink to="/top">Популярное</RouterLink>
          <RouterLink to="/contact">Контакты</RouterLink>
        </nav>
      </section>
      <!-- Кнопки выбора типа поиска -->
      <div class="search-type-buttons">
        <button :class="{ active: searchType === 'title' }" @click="setSearchType('title')">
          Название
        </button>
        <button :class="{ active: searchType === 'kinopoisk' }" @click="setSearchType('kinopoisk')">
          ID Кинопоиск
        </button>
        <button :class="{ active: searchType === 'shikimori' }" @click="setSearchType('shikimori')">
          ID Shikimori
        </button>
        <button :class="{ active: searchType === 'imdb' }" @click="setSearchType('imdb')">
          ID IMDB
        </button>
        <button class="random-button" :disabled="randomLoading" @click="openRandomMovie">
          <i class="fas fa-dice"></i>
          {{ randomLoading ? 'Подбираем...' : 'Случайный фильм' }}
        </button>
      </div>

      <!-- Поиск -->
      <div class="search-container">
        <div class="input-wrapper">
          <input
            ref="searchInput"
            v-model="searchTerm"
            :placeholder="getPlaceholder()"
            class="search-input"
            :class="{ 'wrong-layout': showLayoutWarning }"
            :inputmode="searchType === 'title' ? 'text' : 'numeric'"
            @keydown.enter.prevent="search"
            @keydown.tab.prevent="handleTabKey"
            @keydown.down.prevent="focusFirstMovieCard"
            @input="handleInput"
          />
          <div class="icons">
            <button v-if="searchTerm" class="reset-button" @click="resetSearch">
              <i class="fas fa-times"></i>
            </button>
            <button class="search-button" @click="search">
              <i class="fas fa-search"></i>
            </button>
          </div>
          <div v-if="showLayoutWarning" class="layout-warning" :class="{ show: showLayoutWarning }">
            <i class="fas fa-keyboard"></i>
            Возможно, вы используете неправильную раскладку. Нажмите Tab для переключения на
            {{ suggestedLayout }} раскладку
          </div>
        </div>
      </div>

      <!-- Контейнер для истории и результатов -->
      <div class="content-container">
        <!-- История просмотра -->
        <div v-if="!searchTerm">
          <h2>
            История просмотра
            <span v-if="history.length > 0">
              <DeleteButton @click="showModal = true" />
              <BaseModal
                :is-open="showModal"
                message="Вы уверены, что хотите очистить историю?"
                @confirm="clearAllHistory"
                @close="showModal = false"
              />
            </span>
          </h2>
          <div v-if="loading" class="loading-container">
            <SpinnerLoading />
          </div>
          <div
            v-else-if="history.length === 0"
            class="empty-history"
          >
            <template v-if="topMovies.length > 0">
              <p>Здесь пока пусто</p>
              <h2>Популярное сейчас</h2>
              <MovieList :movies-list="topMovies" :is-history="false" :loading="false" />
            </template>
            <template v-else>
              <span class="material-icons">movie</span>
              <p>Здесь пока пусто</p>
            </template>
          </div>
          <MovieList
            v-else
            :movies-list="history"
            :is-history="true"
            :loading="false"
            @item-deleted="handleItemDeleted"
          />
        </div>
        <ErrorMessage
          v-if="!searchTerm && errorMessage"
          :message="errorMessage"
          :code="errorCode"
        />

        <!-- Результаты поиска -->
        <div v-if="searchPerformed">
          <h2>Результаты поиска</h2>
          <MovieList :movies-list="movies" :is-history="false" :loading="loading" />
          <div v-if="movies.length === 0 && !loading && !errorMessage" class="no-results">
            Ничего не найдено
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
    <FooterDonaters />

    <RandomMovieModal
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
import { getMyLists, delAllFromList } from '@/api/user'
import BaseModal from '@/components/BaseModal.vue'
import DeleteButton from '@/components/buttons/DeleteButton.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import FooterDonaters from '@/components/FooterDonaters.vue'
import { MovieList } from '@/components/MovieList/'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { hasConsecutiveConsonants, suggestLayout, convertLayout } from '@/utils/keyboardLayout'
import { normalizeBasePath } from '@/utils/basePath'
import debounce from 'lodash/debounce'
import { onMounted, onServerPrefetch, ref, watch, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import RandomMovieModal from '@/components/RandomMovieModal.vue'
import { getMovieSeoPath } from '@/utils/movieSeo'

const mainStore = useMainStore()
const authStore = useAuthStore()
const router = useRouter()

const searchType = ref('title')
const searchTerm = ref('')
const movies = ref([])
const loading = ref(false)
const searchPerformed = ref(false)
const showModal = ref(false)
const errorMessage = ref('')
const errorCode = ref(null)
const isMobile = computed(() => mainStore.isMobile)
const history = ref([])
const topMovies = ref([])

const showLayoutWarning = ref(false)
const suggestedLayout = ref('')

const showRandomModal = ref(false)
const randomMovie = ref(null)
const randomLoading = ref(false)
const randomError = ref('')

const searchInput = ref(null)
const siteOrigin = import.meta.env.VITE_SITE_ORIGIN || 'https://dav2010id.github.io'
const basePath = normalizeBasePath(import.meta.env.VITE_BASE_URL || '/reyohoho')
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

const loadHomeTopMovies = async () => {
  try {
    topMovies.value = await getMovies({
      activeTime: '24h',
      typeFilter: 'all'
    })
  } catch (error) {
    console.error('Ошибка загрузки топов для главной:', error)
    topMovies.value = []
  }
}

onServerPrefetch(loadHomeTopMovies)

watch(
  () => authStore.token,
  async (token) => {
    if (token) {
      loading.value = true
      try {
        history.value = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
      } catch (error) {
        const { message, code } = handleApiError(error)
        errorMessage.value = message
        errorCode.value = code
        console.error('Ошибка загрузки истории:', error)
        if (code === 401) {
          authStore.logout()
          await router.push('/login')
          router.go(0)
        }
      } finally {
        loading.value = false
      }
      return
    }

    history.value = mainStore.history
  },
  { immediate: true }
)

function handleItemDeleted(deletedItemId) {
  history.value = history.value.filter((item) => item.kp_id !== deletedItemId)
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

const handleTabKey = () => {
  if (showLayoutWarning.value) {
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
  searchTerm.value = ''
  movies.value = []
  searchPerformed.value = false
  showLayoutWarning.value = false
  errorMessage.value = ''
  errorCode.value = null
  searchInput.value?.focus()
}

const search = () => {
  debouncedPerformSearch.cancel()
  if (searchTerm.value) {
    errorMessage.value = ''
    errorCode.value = null
    performSearch()
  }
}

const performSearch = async () => {
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
      const response = await getKpIDfromIMDB(searchTerm.value)
      if (response.id_kp) {
        router.push(getMovieSeoPath({ kp_id: `${response.id_kp}` }))
      } else {
        throw new Error('Не найдено')
      }
      return
    }

    if (searchType.value === 'shikimori') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }

      try {
        const response = await getKpIDfromSHIKI(searchTerm.value)
        if (response.id_kp) {
          router.push(getMovieSeoPath({ kp_id: `${response.id_kp}` }))
          return
        }
      } catch (e) {
        console.log('Switch to kodik', e)
      }

      router.push({ name: 'movie-info-shiki', params: { shiki_id: `shiki${searchTerm.value}` } })
      return
    }
    if (searchType.value === 'title') {
      const response = await apiSearch(searchTerm.value)
      movies.value = response.map((movie) => ({
        ...movie,
        kp_id: movie.id.toString(),
        rating_kp: movie.raw_data?.rating !== 'null' ? movie.raw_data?.rating : null,
        type: movie.raw_data?.type
      }))
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при поиске:', error)
  } finally {
    loading.value = false
  }
}

const clearAllHistory = async () => {
  loading.value = true
  if (authStore.token) {
    try {
      await delAllFromList(USER_LIST_TYPES_ENUM.HISTORY)
      history.value = []
      if (!topMovies.value.length) {
        await loadHomeTopMovies()
      }
      loading.value = false
      showModal.value = false
    } catch (error) {
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      console.error('Ошибка загрузки истории:', error)
      if (code === 401) {
        authStore.logout()
        await router.push('/login')
        router.go(0)
      }
      loading.value = false
      showModal.value = false
    }
  } else {
    mainStore.clearAllHistory()
    if (!topMovies.value.length) {
      await loadHomeTopMovies()
    }
    loading.value = false
    showModal.value = false
  }
}

const debouncedPerformSearch = debounce(() => {
  if (searchTerm.value.length >= 2) {
    performSearch()
  } else if (searchTerm.value.length < 2) {
    movies.value = []
    searchPerformed.value = false
  }
}, 700)

onMounted(() => {
  if (!topMovies.value.length) {
    loadHomeTopMovies()
  }
  const hash = window.location.hash
  if (hash.startsWith('#search=')) {
    const searchQuery = decodeURIComponent(hash.replace('#search=', ''))
    searchTerm.value = searchQuery
    performSearch()
  } else if (hash.startsWith('#imdb=')) {
    const imdbId = decodeURIComponent(hash.replace('#imdb=', ''))
    setSearchType('imdb')
    searchTerm.value = imdbId
    performSearch()
  } else if (hash.startsWith('#shiki')) {
    const shikiId = decodeURIComponent(hash.replace('#shiki', ''))
    setSearchType('shikimori')
    searchTerm.value = shikiId
    performSearch()
  }
  searchInput.value?.focus()
})

// Автопоиск с задержкой (только для поиска по названию)
watch(searchTerm, () => {
  if (searchType.value !== 'title') {
    return
  }
  debouncedPerformSearch()
})

const focusFirstMovieCard = () => {
  if (movies.value.length > 0) {
    const firstMovieCard = document.querySelector('.movie-card')
    if (firstMovieCard) {
      firstMovieCard.focus()
    }
  }
}

const openRandomMovie = () => {
  showRandomModal.value = true
  fetchRandomMovie()
}

const closeRandomModal = () => {
  showRandomModal.value = false
  randomMovie.value = null
  randomError.value = ''
}

const fetchRandomMovie = async () => {
  randomLoading.value = true
  randomError.value = ''

  try {
    const response = await getRandomMovie()

    if (response.kp_id) {
      try {
        const kpInfo = await getKpInfo(response.kp_id)
        randomMovie.value = {
          ...response,
          description: kpInfo.description,
          budget: kpInfo.budget,
          fees_world: kpInfo.fees_world,
          fees_russia: kpInfo.fees_russia,
          premiere_ru: kpInfo.premiere_ru,
          premiere_world: kpInfo.premiere_world,
          age_rating: kpInfo.age_rating,
          duration: kpInfo.duration,
          total_rating: kpInfo.total_rating
        }
      } catch {
        randomMovie.value = response
      }
    } else {
      randomMovie.value = response
    }
  } catch (error) {
    const { message } = handleApiError(error)
    randomError.value = message
    console.error('Ошибка при получении случайного фильма:', error)
  } finally {
    randomLoading.value = false
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
  padding-top: 20px;
  padding-bottom: 40px;
}

.page-intro {
  max-width: 980px;
  margin: 0 auto 24px;
  padding: 0 20px;
  text-align: center;
  color: #fff;
}

.page-intro h1 {
  margin: 0 0 12px;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.15;
}

.page-intro__lead,
.page-intro__text {
  max-width: 760px;
  margin: 0 auto 10px;
  font-size: 16px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
}

.page-intro__links {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.page-intro__links a {
  color: var(--accent-color);
  font-weight: 600;
  text-decoration: none;
}

.page-intro__links a:hover {
  text-decoration: underline;
}

/* Общие стили */
.search-type-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding-top: 10px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.search-type-buttons button {
  padding: 5px 10px;
  font-size: 16px;
  border: none;
  background: none;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.search-type-buttons button::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 100%;
  height: 2px;
  background-color: transparent;
  transition: background-color 0.3s ease;
}

.search-type-buttons button.active::after {
  background-color: var(--accent-color);
}

.search-type-buttons button:hover {
  color: #ffffff;
}

.random-button {
  background: var(--accent-color) !important;
  color: white !important;
  border-radius: 8px;
  padding: 8px 16px !important;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.random-button:hover:not(:disabled) {
  background: var(--accent-hover-color) !important;
  transform: translateY(-1px);
}

.random-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.random-button::after {
  display: none;
}

.search-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.input-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 10px;
  background: rgba(30, 30, 30, 0.8);
  color: #fff;
  transition: border-color 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-transparent);
}

.search-input.wrong-layout {
  border-color: #ff8c00;
  box-shadow: 0 0 5px rgba(255, 140, 0, 0.2);
}

.icons {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
}

.reset-button,
.search-button {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 2px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.reset-button:hover,
.search-button:hover {
  opacity: 1;
}

.reset-button i,
.search-button i {
  font-size: 18px;
  display: block;
  width: 20px;
  height: 20px;
}

h2 {
  display: flex;
  font-size: 20px;
  margin-bottom: 20px;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

/* Сообщение "Ничего не найдено" */
.no-results {
  width: 100%;
  text-align: center;
  color: #fff;
  font-size: 18px;
  margin-top: 20px;
}

/* Подсказка для поиска */
.search-prompt {
  text-align: center;
  color: #fff;
  font-size: 18px;
  margin-top: 20px;
}

.layout-warning {
  position: absolute;
  bottom: -40px;
  left: 0;
  right: 0;
  text-align: center;
  color: #ff8c00;
  font-size: 14px;
  background: rgba(255, 140, 0, 0.15);
  padding: 8px 12px;
  border-radius: 5px;
  pointer-events: none;
  border: 1px solid rgba(255, 140, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  z-index: 1;
  backdrop-filter: blur(5px);
}

.layout-warning.show {
  opacity: 1;
  transform: translateY(0);
}

.layout-warning i {
  font-size: 16px;
  color: #ff8c00;
}

.layout-warning {
  color: #ff8c00;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  width: 100%;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #888;
  gap: 15px;
}

.empty-history .material-icons {
  font-size: 64px;
  color: #888;
  opacity: 0.7;
}

.empty-history p {
  font-size: 18px;
  margin: 0;
  color: #888;
}

.empty-history > div {
  width: 100%;
}

@media (max-width: 600px) {
  .mainpage {
    padding-top: 0;
    height: calc(100vh - 30px - 63px);
  }

  .page-intro {
    padding: 16px 16px 0;
    margin-bottom: 20px;
  }

  .search-container,
  .search-type-buttons {
    padding: 0;
  }
}
</style>
