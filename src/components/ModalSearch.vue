<template>
  <div class="search" @click="closeModal">
    <div class="search__content" @click.stop>
      <!-- Поиск -->
      <div class="input-wrapper">
        <input
          ref="searchInput"
          v-model="searchTerm"
          placeholder="Введите название фильма"
          class="search-input"
          @keydown.enter="search"
        />
      </div>

      <!-- Результаты поиска -->
      <div class="search__results-wrapper">
        <div class="search__results">
          <div v-if="searchTerm?.length < 3" class="no-results">Здесь появятся результаты поиска</div>

          <template v-else-if="loading">
            <div class="movie-skeleton" v-for="idx in [0, 1, 2, 3]" :key="idx">
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
              class="search__movie movie"
              :to="{ name: 'movie-info', params: { kp_id: movie.kp_id } }"
              @click="closeModal"
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

      <button @click="closeModal" class="btn btn--close">
        <i class="fas fa-close"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import debounce from 'lodash/debounce'
import { inRange } from 'lodash'

const emit = defineEmits(['closeModal'])

const apiUrl = import.meta.env.VITE_APP_API_URL
const router = useRouter()

const searchTerm = ref('')
const movies = ref([])
const loading = ref(false)

const TYPES_ENUM = {
  FILM: 'фильм',
  TV_SERIES: 'сериал',
  VIDEO: 'видео'
}

// Очистка поиска
const resetSearch = () => {
  searchTerm.value = ''
  movies.value = []
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

const closeModal = (event) => {
  const isLeftClick = event.button === 0

  // Проверяем, что не зажаты Ctrl или Cmd
  const isNotModified = !event.ctrlKey && !event.metaKey

  // Если это обычный клик, скрываем попап
  if ((isLeftClick && isNotModified) || !event) {
    emit('closeModal')
    resetSearch()
  }
}

// Автопоиск с задержкой
watch(searchTerm, () => {
  debouncedPerformSearch()
})
</script>

<style lang="scss" scoped>
.search {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;

  &__content {
    position: relative;
    display: flex;
    flex-direction: column;
    background: rgba(30, 30, 30, 0.96);
    padding: 20px;
    border-radius: 8px;
    max-width: 80%;
    width: 100%;
    max-height: 90vh;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

    @media screen and (max-width: 600px) {
      max-width: 400px;
    }

    @media (min-width: 768px) {
      max-width: 600px;
    }

    @media (min-width: 1200px) {
      max-width: 800px;
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
  margin-top: 20px;
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

.btn {
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

  &--search {
    position: absolute;
    right: 5px;
    top: 11px;
  }

  &--close {
    position: absolute;
    top: 8px;
    right: 6px;
  }

  i {
    font-size: 18px;
    display: block;
    width: 20px;
    height: 20px;
  }
}

.movie-skeleton {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 16px;
  gap: 12px;
  border-radius: 10px;
  background: rgba(34, 34, 34, 0.5); // Цвет фона, похожий на реальный элемент

  &__poster {
    width: 32px;
    height: 48px; // Высота постерa
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
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
    border-radius: 4px;
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
    border-radius: 4px;
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
</style>
