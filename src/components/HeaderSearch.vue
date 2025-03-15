<template>
  <div class="search" :class="{ 'search--bar-toggled': searchBarVisible }" ref="searchBar">
    <!-- Поиск -->
    <transition name="fade">
      <div class="search__container" v-if="searchBarVisible">
        <div class="input-wrapper">
          <input
            ref="searchInput"
            v-model="searchTerm"
            placeholder="Введите название фильма"
            class="search-input"
            @keydown.enter="search"
          />
          <button @click="search" class="search-button">
            <i class="fas fa-search"></i>
          </button>
        </div>

        <!-- Результаты поиска -->
        <div class="search__results">
          <div v-if="!searchCounter" class="no-results">Здесь появятся результаты поиска</div>
          <div v-else-if="movies.length === 0 && !loading" class="no-results">
            Для просмотра ничего не найдено
          </div>
          <div v-else>
            <router-link
              v-for="movie in movies"
              class="search__movie movie"
              :to="{ name: 'movie-info', params: { kp_id: movie.kp_id } }"
              @click="toggleSearchBar"
            >
              <img :src="movie.poster" alt="poster" class="movie__poster" />
              <div class="movie__info">
                <div class="movie__title">
                  {{ movie.raw_data?.name_ru ?? movie.raw_data?.name_en }}
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
    </transition>

    <button class="search__toggle" @click="toggleSearchBar">
      <i class="fa" :class="{ 'fa-search': !searchBarVisible, 'fa-close': searchBarVisible }"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import debounce from 'lodash/debounce'
import { inRange } from 'lodash'

const apiUrl = import.meta.env.VITE_APP_API_URL
const router = useRouter()

const searchTerm = ref('')
const movies = ref([])
const loading = ref(false)

const searchBar = ref(null)
// Каунтер чтобы показывать сообщение что ничего не найдено только после первого поиска
const searchCounter = ref(0)

const TYPES_ENUM = {
  FILM: 'фильм',
  TV_SERIES: 'сериал',
  VIDEO: 'видео'
}

// Очистка поиска
const resetSearch = () => {
  searchTerm.value = ''
  movies.value = []
  searchCounter.value = 0
}

// Активация поля поиска в хэдере
const searchBarVisible = ref(false)
const toggleSearchBar = (event) => {
  const isLeftClick = event.button === 0

  // Проверяем, что не зажаты Ctrl или Cmd
  const isNotModified = !event.ctrlKey && !event.metaKey

  // Если это обычный клик, скрываем попап
  if (isLeftClick && isNotModified) {
    searchBarVisible.value = !searchBarVisible.value
    if (!searchBarVisible.value) {
      resetSearch()
    }
  }
}

const search = () => {
  if (searchTerm.value) {
    performSearch()
  } else {
    alert('Введите запрос для поиска')
  }
}

const performSearch = async () => {
  loading.value = true
  movies.value = []
  searchCounter.value += 1

  try {
    // Поиск по названию
    const response = await axios.get(`${apiUrl}/search/${searchTerm.value}`)
    movies.value = response.data.map((movie) => ({ ...movie, kp_id: movie.id.toString() }))
  } catch (error) {
    console.error('Ошибка:', error)
    movies.value = []
    if (error.response?.status) {
      router.push(`/${error.response.status}`)
    }
  } finally {
    loading.value = false
  }
}

const debouncedPerformSearch = debounce(() => {
  if (searchTerm.value.length >= 3) {
    performSearch()
  } else if (searchTerm.value.length < 3) {
    movies.value = []
  }
}, 700)

const getRatingColor = (rating) => {
  if (!rating || inRange(rating, 5.1, 6.9)) {
    return 'medium'
  }

  if (inRange(rating, 0.1, 5.0)) {
    return 'low'
  }

  if (inRange(rating, 7.0, 10.0)) {
    return 'high'
  }
}

// Закрываем поиск, если кликнули вне его области
const handleClickOutside = (event) => {
  if (searchBar.value && !searchBar.value.contains(event.target)) {
    searchBarVisible.value = false
  }
}

// Добавляем и удаляем обработчики событий при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Автопоиск с задержкой
watch(searchTerm, () => {
  debouncedPerformSearch()
})
</script>

<style lang="scss" scoped>
.search {
  width: auto;
  display: flex;
  flex-wrap: nowrap;
  min-height: 50px;
  position: relative;
  align-items: center;
  justify-content: flex-end;

  &--bar-toggled {
    /* padding: 4.5px 5px 4.5px 0; */
    @media screen and (max-width: 600px) {
      padding: 0;
    }
  }

  &__toggle {
    background: none;
    border: 0;
    color: #fff;
    cursor: pointer;
    margin: 0 20px;
    width: 25px;
  }

  &__container {
    display: flex;
    width: 60%;
    max-width: 600px;
    position: relative;

    @media screen and (max-width: 600px) {
      width: 100%;
      max-width: calc(100% - 130px);
    }
  }

  &__results {
    position: absolute;
    background: rgba(30, 30, 30, 0.96);
    color: #fff;
    border-radius: 10px;
    width: 100%;
    top: 45px;
    border: 1px solid #ccc;
    z-index: 1000;
    box-sizing: border-box;

    /* Сообщение "Ничего не найдено" */
    .no-results {
      width: 100%;
      text-align: center;
      font-size: 18px;
      margin: 20px auto;
    }
  }

  .movie {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 10px 16px;
    gap: 12px;
    cursor: pointer;
    text-decoration: none;
    color: #fff;
    border-radius: 10px;

    &:hover {
      background: rgba(34, 34, 34, 0.98);
    }

    &__poster {
      width: 32px;
    }

    &__title {
      font-size: 15px;
      line-height: 18px;
      font-weight: 500;
      padding: 0;
      margin: 0;
    }

    &__meta {
      display: flex;
      gap: 7px;
      margin-top: 3px;
    }

    &__rating {
      &.low {
        color: red;
      }

      &.high {
        color: green;
      }
    }
  }
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
  transition: all 0.3s ease;

  &:focus {
    border-color: #558839;
    outline: none;
  }
}

.search-button {
  position: absolute;
  right: 5px;
  top: 11px;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 2px;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  i {
    font-size: 18px;
    display: block;
    width: 20px;
    height: 20px;
  }
}

/* Стили для анимации fade */
.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-leave-active {
  transition: all 0s;
}

.fade-enter-from {
  opacity: 0;
}

.fade-enter-to {
  opacity: 1;
}
</style>
