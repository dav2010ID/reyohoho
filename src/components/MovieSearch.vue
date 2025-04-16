<template>
  <div class="wrapper">
    <div class="mainpage">
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
      </div>

      <!-- Поиск -->
      <div class="search-container">
        <div class="input-wrapper">
          <input
            ref="searchInput"
            v-model="searchTerm"
            :placeholder="getPlaceholder()"
            class="search-input"
            :inputmode="searchType === 'title' ? 'text' : 'numeric'"
            @keydown.enter="search"
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
        </div>
      </div>

      <!-- Контейнер для истории и результатов -->
      <div class="content-container">
        <!-- История просмотра -->
        <div v-if="!searchTerm && history.length > 0">
          <h2>
            История просмотра
            <span>
              <DeleteButton @click="showModal = true" />
              <BaseModal
                :is-open="showModal"
                message="Вы уверены, что хотите очистить историю?"
                @confirm="clearAllHistory"
                @close="showModal = false"
              />
            </span>
          </h2>
          <MovieList
            :movies-list="history"
            :is-history="true"
            :loading="loading"
            @item-deleted="handleItemDeleted"
          />
        </div>
        <ErrorMessage v-if="!searchTerm && errorMessage" :message="errorMessage" :code="errorCode" />

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
  </div>
</template>

<script setup>
import { apiSearch, getKpIDfromIMDB, getKpIDfromSHIKI } from '@/api/movies'
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
import debounce from 'lodash/debounce'
import { watchEffect, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

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

const history = ref([])

watchEffect(async () => {
  loading.value = true
  if (authStore.token) {
    try {
      history.value = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
      loading.value = false
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
    }
  } else {
    history.value = mainStore.history
    loading.value = false
  }
})

function handleItemDeleted(deletedItemId) {
  history.value = history.value.filter((item) => item.kp_id !== deletedItemId)
}

// Установка типа поиска
const setSearchType = (type) => {
  searchType.value = type
  resetSearch()
}

const handleInput = (event) => {
  if (searchType.value === 'title') {
    searchTerm.value = event.target.value
  } else {
    searchTerm.value = event.target.value.replace(/\D+/g, '')
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
}

const search = () => {
  debouncedPerformSearch.cancel()
  if (searchTerm.value) {
    performSearch()
  } else {
    alert('Введите запрос для поиска')
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
      router.push({ name: 'movie-info', params: { kp_id: searchTerm.value } })
      return
    }

    if (searchType.value === 'imdb') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }
      const response = await getKpIDfromIMDB(searchTerm.value)
      if (response.id_kp) {
        router.push({ name: 'movie-info', params: { kp_id: `${response.id_kp}` } })
      } else {
        throw new Error('Не найдено')
      }
      return
    }

    if (searchType.value === 'shikimori') {
      if (!/^\d+$/.test(searchTerm.value)) {
        searchTerm.value = searchTerm.value.replace(/\D/g, '')
      }
      const response = await getKpIDfromSHIKI(searchTerm.value)
      if (response.id_kp) {
        router.push({ name: 'movie-info', params: { kp_id: `${response.id_kp}` } })
      } else {
        throw new Error('Не найдено')
      }
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
})

// Автопоиск с задержкой (только для поиска по названию)
watch(searchTerm, () => {
  if (searchType.value !== 'title') {
    return
  }
  debouncedPerformSearch()
})
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
  background-color: #ffffff;
}

.search-type-buttons button:hover {
  color: #ffffff;
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
  border-color: #558839;
  outline: none;
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

@media (max-width: 600px) {
  .mainpage {
    padding-top: 0;
    height: calc(100vh - 30px - 63px);
  }

  .search-container,
  .search-type-buttons {
    padding: 0;
  }
}
</style>
