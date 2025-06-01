<template>
  <div class="wrapper">
    <div class="top-100-page" tabindex="0">
      <div class="controls">
        <!-- Временные фильтры -->
        <div class="filter-card time-card">
          <div class="button-group time-buttons">
            <i class="material-icons card-icon">schedule</i>
            <template v-for="(btn, idx) in timeFilters" :key="idx">
              <div v-if="btn.type === 'separator'" class="filter-separator"></div>
              <button
                v-else
                class="filter-btn time-btn"
                :class="{ active: activeTimeFilter === btn.apiUrl }"
                @click="changeTimeFilter(btn.apiUrl)"
              >
                {{ btn.label }}
              </button>
            </template>
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
import { getMovies } from '@/api/movies'
import { handleApiError } from '@/constants'
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
  { label: 'Всё время', apiUrl: 'all' },
  { label: '---', apiUrl: 'separator', type: 'separator' },
  { label: 'Обсуждаемое', apiUrl: 'discussed' }
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
  flex-direction: row;
  gap: 8px;
  margin-bottom: 20px;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  box-sizing: border-box;
}

/* Карточки фильтров */
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

/* Группы кнопок */
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

/* Активные состояния */
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

/* Адаптивность */
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
</style>
