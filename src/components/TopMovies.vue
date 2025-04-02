<template>
  <div class="wrapper">
    <div class="top-100-page" tabindex="0">
      <div class="controls">
        <!-- Временные фильтры -->
        <div class="filter-card time-card">
          <div class="button-group time-buttons">
            <i class="material-icons card-icon">schedule</i>
            <button
              v-for="(btn, idx) in timeFilters"
              :key="idx"
              class="filter-btn time-btn"
              :class="{ active: activeTimeFilter === btn.apiUrl }"
              @click="changeTimeFilter(btn.apiUrl)"
            >
              {{ btn.label }}
            </button>
          </div>
        </div>

        <!-- Типовые фильтры -->
        <div class="filter-card type-card">
          <div class="button-group type-buttons">
            <i class="material-icons card-icon">movie</i>
            <button
              v-for="(btn, idx) in typeFilters"
              :key="idx"
              class="filter-btn type-btn"
              :class="{ active: typeFilter === btn.value }"
              @click="changeTypeFilter(btn.value)"
            >
              {{ btn.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Основной контент -->
      <MovieList
        v-if="!errorMessage"
        :movies-list="movies"
        :is-history="false"
        :loading="loading"
      />
      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />
    </div>
  </div>
</template>

<script setup>
import { getMovies, handleApiError } from '@/api/movies'
import { MovieList } from '@/components/MovieList'
import { onMounted, ref } from 'vue'
import ErrorMessage from '@/components/ErrorMessage.vue'

// Состояния
const movies = ref([])
const loading = ref(false)
const activeTimeFilter = ref('24h')
const typeFilter = ref('all')
const errorMessage = ref('')
const errorCode = ref(null)

// Фильтры по времени (реверснутый порядок)
const timeFilters = [
  { label: '24 часа', apiUrl: '24h' },
  { label: '7 дней', apiUrl: '7d' },
  { label: '30 дней', apiUrl: '30d' },
  { label: 'Всё время', apiUrl: 'all' }
]

// Фильтры по типу контента
const typeFilters = [
  { label: 'Все', value: 'all' },
  { label: 'Фильмы', value: 'movie' },
  { label: 'Сериалы', value: 'series' }
]

// Получение данных
const fetchMovies = async () => {
  loading.value = true
  errorMessage.value = ''
  errorCode.value = null

  try {
    movies.value = await getMovies({
      activeTime: activeTimeFilter.value,
      typeFilter: typeFilter.value
    })
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    movies.value = []
  } finally {
    loading.value = false
  }
}

// Обработчики
const changeTimeFilter = (apiUrl) => {
  activeTimeFilter.value = apiUrl
  fetchMovies()
}

const changeTypeFilter = (value) => {
  typeFilter.value = value
  fetchMovies()
}

onMounted(fetchMovies)
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
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  width: 100%;
  align-items: center;
  justify-content: center;
}

/* Карточки фильтров */
.filter-card {
  max-width: 500px;
  width: 100%;
  background: #252525;
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  margin: 0 auto;
  box-sizing: border-box; /* Добавлено */
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
  font-size: 24px;
  color: #ff6b35;
  transition: color 0.3s;
}

.type-card .card-icon {
  color: #4a90e2;
}

/* Группы кнопок */
.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: nowrap;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  justify-content: space-between;
  width: 100%;
  align-items: center;
}

.button-group::-webkit-scrollbar {
  display: none;
}

.filter-btn {
  padding: 10px 15px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #2d2d2d;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  white-space: nowrap;
  flex: 1 1 calc(25% - 10px);
  min-width: 100px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-sizing: border-box; /* Добавлено */
}

.filter-btn:hover {
  background: #3a3a3a;
}

.filter-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Активные состояния */
.time-btn.active {
  background: #ff6b35;
  border-color: #ff6b35;
  color: white;
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
}

.type-btn.active {
  background: #4a90e2;
  border-color: #4a90e2;
  color: white;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
}

/* Адаптивность */
@media (max-width: 620px) {
  .top-100-page {
    max-width: 100%;
    padding: 0 5px 5px 5px;
  }

  .filter-card {
    max-width: 100%;
    padding: 10px;
  }

  .controls {
    margin-bottom: 5px;
    gap: 5px;
  }

  .card-icon {
    display: none;
  }

  .filter-btn {
    flex: 1 1 48%;
  }
}

@media (max-width: 480px) {
  .filter-card {
    padding: 0px;
    margin: 0px;
    background: none;
  }

  .card-header {
    margin-bottom: 5px;
  }

  .button-group {
    flex-wrap: nowrap;
    justify-content: center;
    gap: 3px;
  }

  .filter-btn {
    flex: 1 1 45%;
    min-width: 30px;
    padding: 8px 8px;
    font-size: 0.8em;
    margin: 5px 0;
  }
}

@media (max-width: 400px) {
  .button-group {
    flex-wrap: wrap;
  }
}
</style>
