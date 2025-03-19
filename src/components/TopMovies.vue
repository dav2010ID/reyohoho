<template>
  <div class="wrapper">
  <div class="top-100-page" tabindex="0">
    <!-- Меню с фильтрами и настройками -->
    <div class="controls">
      <div class="filters">
        <button
          v-for="(button, index) in timeFilters"
          :key="index"
          :class="{ active: activeTimeFilter === button.apiUrl }"
          @click="changeTimeFilter(button.apiUrl)"
        >
          {{ button.label }}
        </button>
      </div>

      <div class="type-filter">
        <select v-model="typeFilter" @change="fetchMovies" class="custom-select">
          <option value="all">Все</option>
          <option value="movie">Фильмы</option>
          <option value="series">Сериалы</option>
        </select>
      </div>
    </div>

    <!-- Контейнер для сетки фильмов и спиннера -->
    <CardsMovie :moviesList="movies" :isHistory="false" :loading="loading" />
  </div>
</div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import CardsMovie from "@/components/CardsMovie.vue";
import api from '@/api/axios';

// Состояния
const movies = ref([]);
const loading = ref(false);
const activeTimeFilter = ref("all");
const typeFilter = ref("all");

// Фильтры по времени
const timeFilters = [
  { label: "Всё время", apiUrl: "all" },
  { label: "30 дней", apiUrl: "30d" },
  { label: "7 дней", apiUrl: "7d" },
  { label: "24 часа", apiUrl: "24h" },
];

// Функция для получения фильмов
const fetchMovies = async () => {
  let response;
  loading.value = true;
  try {
    response = await api.get(`/top/${activeTimeFilter.value}?type=${typeFilter.value}`);
    movies.value = response.data;
  } catch (error) {
    console.error("Ошибка при загрузке фильмов:", error);
  } finally {
    loading.value = false;
  }
};

// Функция для изменения фильтра по времени
const changeTimeFilter = (apiUrl) => {
  activeTimeFilter.value = apiUrl;
  fetchMovies();
};

onMounted(() => {
  fetchMovies();
});
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

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.type-filter {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  max-width: 367.5px;
  width: 100%;
}

button {
  padding: 16px 16px;
  border: 1px solid #444;
  background-color: #1e1e1e;
  color: #fff;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

button:hover {
  background-color: #444;
  }

button.active {
  background-color: #fff;
  color: #000;
  }

  /* Select */
.custom-select {
    padding: 8px 16px;
    border: 1px solid #444;
    background-color: #1e1e1e;
    color: #fff;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s, border-color 0.3s;
    width: 100%;
    }

.custom-select:hover {
    border-color: #666;
    }

.custom-select:focus {
    border-color: #558839;
    }
</style>