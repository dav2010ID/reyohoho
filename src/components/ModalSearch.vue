<template>
  <div class="search" @click="closeModal">
    <div v-dialog-focus="closeModal" aria-label="Поиск фильмов" class="search__content" @click.stop>
      <!-- Поиск -->
      <div class="input-wrapper">
        <input
          ref="searchInput"
          v-model="searchTerm"
          placeholder="Введите название фильма"
          class="search-input"
          :class="{ 'wrong-layout': showLayoutWarning }"
          @keydown.enter="search"
          @keydown.tab="handleTabKey"
          @keydown.down.prevent="focusFirstMovieCard"
          @input="handleInput"
        />
        <div v-if="showLayoutWarning" class="layout-warning" :class="{ show: showLayoutWarning }">
          <i class="fas fa-keyboard"></i>
          Возможно, вы используете неправильную раскладку. Нажмите Tab для переключения на
          {{ suggestedLayout }} раскладку
        </div>
      </div>

      <!-- Результаты поиска -->
      <div v-if="!errorMessage" class="search__results-wrapper">
        <div class="search__results">
          <!-- Empty query: the last five watched titles are one keypress away. -->
          <template v-if="!searchTerm || searchTerm.length < 2">
            <div v-if="recentHistory.length" class="recent">
              <p class="recent__title">Недавно смотрели</p>
              <router-link
                v-for="movie in recentHistory"
                :key="movie.kp_id"
                class="search__movie movie"
                :to="getMoviePath(movie)"
                @click="closeModal"
              >
                <img
                  :src="resolvePosterByMovie(movie)"
                  :alt="movie.title ? `Постер ${movie.title}` : 'Постер фильма'"
                  class="movie__poster"
                  width="120"
                  height="180"
                  @error="setImageFallback"
                />
                <div class="movie__info">
                  <div class="movie__title">{{ movie.title }}</div>
                  <div v-if="movie.year" class="movie__meta">
                    <span class="movie__year">{{ movie.year }}</span>
                  </div>
                </div>
              </router-link>
            </div>
            <div v-else class="no-results">Начните вводить название</div>
          </template>

          <template v-else-if="loading">
            <div v-for="idx in [0, 1, 2, 3]" :key="idx" class="movie-skeleton">
              <div class="movie-skeleton__poster"></div>
              <div class="movie-skeleton__content">
                <div class="movie-skeleton__title"></div>
                <div class="movie-skeleton__meta">
                  <div class="movie-skeleton__rating"></div>
                </div>
              </div>
            </div>
          </template>

          <div v-else-if="movies.length === 0 && !loading" class="no-results">
            Для просмотра ничего не найдено
          </div>

          <div v-else>
            <router-link
              v-for="movie in movies"
              :key="movie.id"
              class="search__movie movie"
              :to="getMoviePath(movie)"
              @click="closeModal"
            >
              <img
                :src="movie.poster"
                :alt="
                  getMovieName(movie.raw_data)
                    ? `Постер ${getMovieName(movie.raw_data)}`
                    : 'Постер фильма'
                "
                class="movie__poster"
                width="120"
                height="180"
              />
              <div class="movie__info">
                <div class="movie__title">
                  {{ getMovieName(movie.raw_data) }}
                </div>
                <div class="movie__meta">
                  <span class="movie__rating" :class="getRatingColor(movie.raw_data?.rating)">
                    {{ movie.raw_data?.rating !== 'null' ? (movie.raw_data?.rating ?? '-') : '-' }}
                  </span>
                  <span class="movie__type"> {{ TYPES_ENUM[movie.raw_data?.type] ?? '-' }}, </span>
                  <span class="movie__year">
                    {{ movie.year }}
                  </span>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

      <button class="btn--close" type="button" aria-label="Закрыть" @click="closeModal">
        <i class="fas fa-close"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { apiSearch } from '@/api/movies'
import ErrorMessage from '@/components/ErrorMessage.vue'
import { TYPES_ENUM } from '@/constants'
import { handleApiError } from '@/constants'
import { useNavbarStore } from '@/store/navbar'
import { hasConsecutiveConsonants, suggestLayout, convertLayout } from '@/utils/keyboardLayout'
import debounce from 'lodash.debounce'
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useMainStore } from '@/store/main'
import { getRatingColor } from '@/utils/ratingUtils'
import { getMovieName } from '@/utils/textUtils'
import { getMovieSeoPath } from '@/utils/movieSeo'
import { resolvePosterByMovie, setImageFallback } from '@/utils/mediaUtils'
import { createLatestRequestGuard } from '@/utils/latestRequest'
import { useRouter } from 'vue-router'

const navbarStore = useNavbarStore()

const searchTerm = ref('')
const movies = ref([])
const getMoviePath = (movie) => getMovieSeoPath(movie)
const loading = ref(false)
const searchRequestGuard = createLatestRequestGuard()

// Глобальные переменные для ошибок
const errorMessage = ref('')
const errorCode = ref(null)

const searchInput = ref(null)
const activeMovieIndex = ref(null)

const showLayoutWarning = ref(false)
const suggestedLayout = ref('')
const store = useMainStore()
const recentHistory = computed(() => (store.isHistoryAllowed ? store.history.slice(0, 5) : []))
const isMobile = computed(() => store.isMobile)

onMounted(async () => {
  await nextTick()
  document.addEventListener('keydown', handleKeyDown)
  searchInput.value?.focus()
  // A query typed elsewhere (the 404 page) opens the modal already searching.
  const prefill = navbarStore.takeSearchPrefill()
  if (prefill) {
    searchTerm.value = prefill
    search()
  }
})

onUnmounted(() => {
  debouncedPerformSearch.cancel()
  searchRequestGuard.invalidate()
  document.removeEventListener('keydown', handleKeyDown)
})

// Очистка поиска
const resetSearch = () => {
  searchRequestGuard.invalidate()
  loading.value = false
  searchTerm.value = ''
  movies.value = []
  errorMessage.value = ''
  errorCode.value = null
  showLayoutWarning.value = false
}

const search = () => {
  debouncedPerformSearch.cancel()
  if (searchTerm.value) {
    performSearch()
  }
}

const performSearch = async () => {
  const requestId = searchRequestGuard.begin()
  const signal = searchRequestGuard.getSignal(requestId)
  const requestedTerm = searchTerm.value
  loading.value = true
  movies.value = []

  // Сброс предыдущих ошибок
  errorMessage.value = ''
  errorCode.value = null

  try {
    // Поиск по названию
    const results = await apiSearch(requestedTerm, { signal })
    if (!searchRequestGuard.isLatest(requestId)) return
    movies.value = (results || []).map((movie) => ({ ...movie, kp_id: movie.id.toString() }))
  } catch (error) {
    if (!searchRequestGuard.isLatest(requestId)) return
    // Используем универсальный обработчик ошибок
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при выполнении поиска:', error)
    movies.value = []
  } finally {
    if (searchRequestGuard.isLatest(requestId)) {
      loading.value = false
    }
  }
}

const debouncedPerformSearch = debounce(() => {
  if (searchTerm.value.length >= 2) {
    performSearch()
  } else if (searchTerm.value.length < 2) {
    searchRequestGuard.invalidate()
    loading.value = false
    movies.value = []
  }
}, 700)

// Any navigation (a result, the rail, the tab bar, browser back) closes the modal.
const router = useRouter()
const removeAfterEach = router?.afterEach(() => navbarStore.closeSearchModal())
onUnmounted(() => removeAfterEach?.())

const closeModal = (event) => {
  // Escape через v-dialog-focus вызывает без события
  const isPlainClick = !event || (event.button === 0 && !event.ctrlKey && !event.metaKey)

  // Если это обычный клик или Escape, скрываем попап
  if (isPlainClick) {
    navbarStore.closeSearchModal() // Используем метод из хранилища для закрытия модалки
    resetSearch()
  }
}

const handleInput = (event) => {
  searchTerm.value = event.target.value
  if (isMobile.value) return
  showLayoutWarning.value = hasConsecutiveConsonants(searchTerm.value)
  if (showLayoutWarning.value) {
    suggestedLayout.value = suggestLayout(searchTerm.value)
  }
}

const handleTabKey = (event) => {
  if (showLayoutWarning.value && !event.shiftKey) {
    event.preventDefault()
    searchTerm.value = convertLayout(searchTerm.value)
    showLayoutWarning.value = false
  }
}

const focusFirstMovieCard = () => {
  if (movies.value.length > 0) {
    const firstMovieCard = document.querySelector('.search__movie')
    if (firstMovieCard) {
      firstMovieCard.focus()
      activeMovieIndex.value = 0
    }
  }
}

const handleKeyDown = (event) => {
  if (!movies.value?.length) return

  if (!event.target?.classList?.contains('search__movie')) {
    return
  }

  switch (event.key) {
    case 'ArrowRight':
      activeMovieIndex.value = (activeMovieIndex.value + 1) % movies.value.length
      break
    case 'ArrowLeft':
      activeMovieIndex.value =
        (activeMovieIndex.value - 1 + movies.value.length) % movies.value.length
      break
    case 'ArrowUp':
      event.preventDefault()
      if (activeMovieIndex.value <= 0) {
        const searchInput = document.querySelector('.search-input')
        if (searchInput) {
          searchInput.focus()
        }
      } else {
        activeMovieIndex.value = Math.max(activeMovieIndex.value - 1, 0)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      activeMovieIndex.value = Math.min(activeMovieIndex.value + 1, movies.value.length - 1)
      break
    case 'Home':
      activeMovieIndex.value = 0
      break
    case 'End':
      activeMovieIndex.value = movies.value.length - 1
      break
  }
}

watch(activeMovieIndex, (newIndex) => {
  if (newIndex !== null) {
    const movieCards = document.querySelectorAll('.search__movie')
    if (movieCards[newIndex]) {
      movieCards[newIndex].focus()
    }
  }
})

// Автопоиск с задержкой
watch(searchTerm, () => {
  debouncedPerformSearch()
})
</script>

<style lang="scss" scoped>
.btn--close {
  position: absolute;
  top: -6px;
  right: -7px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 2px;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  i {
    display: block;
    width: 20px;
    height: 20px;
    font-size: 18px;
  }
}

.search {
  /* Mounted inside the navigation, which uses the handwritten menu font. */
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  /* Above the rail and the tab bar, so the backdrop covers the whole app. */
  z-index: calc(var(--z-sidebar) + 10);

  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background: rgba(30, 30, 30, 0.96);
    padding: 20px;
    border-radius: var(--radius-m);
    width: min(800px, calc(100vw - 32px));
    max-height: 90vh;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    @media screen and (max-width: 600px) {
      width: calc(100vw - 24px);
      padding: 14px;
    }

    @media (min-width: 768px) {
      width: min(600px, calc(100vw - 32px));
    }

    @media (min-width: 1200px) {
      width: min(800px, calc(100vw - 32px));
    }
  }

  &__results-wrapper {
    flex: 1;
    overflow-y: auto; // Прокрутка только для результатов
    margin-top: 20px;
    max-height: calc(90vh - 120px); // Ограничение высоты (учитывая высоту инпута и отступы)
  }

  &__results {
    color: #fff;
    width: 100%;
    box-sizing: border-box;

    /* Сообщение "Ничего не найдено" */
    .recent__title {
      margin: 4px 0 8px;
      color: var(--text-faint);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .no-results {
      width: 100%;
      text-align: center;
      font-size: 18px;
      margin: 20px auto;
    }
  }

  .movie {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 10px 14px;
    gap: 12px;
    cursor: pointer;
    text-decoration: none;
    color: #fff;
    border-radius: var(--radius-m);
    outline: none;
    margin: 2px 4px 8px 0;
    min-height: 68px;
    box-sizing: border-box;

    &:hover {
      background: rgba(34, 34, 34, 0.98);
    }

    &:focus {
      background: rgba(34, 34, 34, 0.98);
      box-shadow: 0 0 0 2px var(--accent-color);
    }

    &__poster {
      width: 32px;
      height: 48px;
      flex: 0 0 32px;
      object-fit: cover;
      border-radius: var(--radius-s);
      background: rgba(255, 255, 255, 0.08);
    }

    &__info {
      min-width: 0;
      padding-top: 2px;
    }

    &__title {
      font-size: 15px;
      line-height: 18px;
      font-weight: 600;
      padding: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }

    /* Year, type and score are secondary to the title. */
    &__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 3px;
      color: var(--text-dim);
      font-size: var(--fs-s);
      line-height: 18px;
    }

    &__rating {
      &.low {
        color: #ff6b6b;
      }

      &.medium {
        color: #ffd93d;
      }

      &.high {
        color: #51cf66;
      }
    }
  }
}

.input-wrapper {
  position: relative;
  width: 100%;
  margin-top: 20px;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: var(--radius-l);
  background: rgba(30, 30, 30, 0.8);
  color: #fff;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-ui);
    box-shadow: 0 0 0 2px var(--accent-transparent);
  }

  &.wrong-layout {
    border-color: #ff8c00;
    box-shadow: 0 0 5px rgba(255, 140, 0, 0.2);
  }
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
  border-radius: var(--radius-m);
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

.movie-skeleton {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 16px;
  gap: 12px;
  border-radius: var(--radius-l);
  background: rgba(34, 34, 34, 0.5); // Цвет фона, похожий на реальный элемент

  &__poster {
    width: 32px;
    height: 48px; // Высота постерa
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-s);
    animation: shimmer 1.5s infinite linear;
  }

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title {
    width: 70%;
    height: 18px; // Высота заголовка
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-s);
    animation: shimmer 1.5s infinite linear;
  }

  &__meta {
    display: flex;
    gap: 7px;
  }

  &__rating {
    width: 40px;
    height: 14px; // Высота рейтинга
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-s);
    animation: shimmer 1.5s infinite linear;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.movie-skeleton__poster,
.movie-skeleton__title,
.movie-skeleton__rating {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.1) 25%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}

.filter-select:focus {
  border-color: var(--accent-ui);
}

.status.completed {
  color: var(--accent-text);
}
</style>
