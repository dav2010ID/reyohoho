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
      </div>

      <!-- Поиск -->
      <div class="search-container">
        <div class="input-wrapper">
          <input ref="searchInput" v-model="searchTerm" :placeholder="getPlaceholder()" class="search-input"
            :inputmode="searchType === 'title' ? 'text' : 'numeric'" @keydown.enter="search" @input="handleInput" />
          <div class="icons">
            <button v-if="searchTerm" @click="resetSearch" class="reset-button">
              <i class="fas fa-times"></i>
            </button>
            <button @click="search" class="search-button">
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
                :isOpen="showModal"
                message="Вы уверены, что хотите очистить историю?"
                @confirm="clearAllHistory"
                @close="showModal = false"
              />
            </span>
          </h2>
          <CardsMovie :moviesList="history" :isHistory="true" :loading="loading" />
        </div>

        <!-- Результаты поиска -->
        <div v-if="searchPerformed">
          <h2>Результаты поиска</h2>
          <CardsMovie :moviesList="movies" :isHistory="false" :loading="loading" />
          <div v-if="movies.length === 0 && !loading" class="no-results">
            Ничего не найдено
          </div>
        </div>

        <!-- Подсказка, когда ничего не введено в поиске -->
        <div v-if="searchTerm && !searchPerformed && !loading && !errorMessage" class="search-prompt">
          Нажмите кнопку "Поиск" или Enter для поиска
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
    <FooterDonaters />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import CardsMovie from "@/components/CardsMovie.vue";
import FooterDonaters from '@/components/FooterDonaters.vue';
import BaseModal from '@/components/BaseModal.vue';
import DeleteButton from "@/components/buttons/DeleteButton.vue";
import debounce from 'lodash/debounce';

const apiUrl = import.meta.env.VITE_APP_API_URL;
const store = useStore();
const router = useRouter();

const searchType = ref('title');
const searchTerm = ref('');
const movies = ref([]);
const loading = ref(false);
const searchPerformed = ref(false);
const showModal = ref(false);
const errorMessage = ref('');

const history = computed(() => store.state.history);

// Установка типа поиска
const setSearchType = (type) => {
  searchType.value = type;
  resetSearch();
};

const handleInput = (event) => {
  if (searchType.value !== 'title') {
    searchTerm.value = event.target.value.replace(/\D+/g, '');
  } else {
    searchTerm.value = event.target.value;
  }
}

// Получение placeholder для input
const getPlaceholder = () => {
  return {
    title: 'Введите название фильма',
    kinopoisk: 'Пример: 301 (Матрица)',
    shikimori: 'Пример: 28171 (Повар-боец Сома)'
  }[searchType.value] || 'Введите название фильма';
};

// Динамический inputmode: для поиска по ID — numeric, иначе — text
const inputMode = computed(() => {
  return (searchType.value === 'kinopoisk' || searchType.value === 'shikimori') ? 'numeric' : 'text';
});

// Очистка поиска
const resetSearch = () => {
  searchTerm.value = '';
  movies.value = [];
  searchPerformed.value = false;
};

const search = () => {
  if (searchTerm.value) {
    performSearch();
  } else {
    alert('Введите запрос для поиска');
  }
};

const performSearch = async () => {
  loading.value = true;
  searchPerformed.value = true;
  movies.value = [];

  try {
    if (searchType.value === 'kinopoisk' || searchType.value === 'shikimori') {
      if (!/^\d+$/.test(searchTerm.value)) {
        alert(`Введите числовой ID ${searchType.value === 'kinopoisk' ? 'Кинопоиска' : 'Shikimori'}`);
        return;
      }
      const idPrefix = searchType.value === 'shikimori' ? 'shiki' : '';
      router.push({ name: 'movie-info', params: { kp_id: `${idPrefix}${searchTerm.value}` } });
      return;
    }

    // Поиск по названию
    const response = await axios.get(`${apiUrl}/search/${searchTerm.value}`);
    movies.value = response.data.map(movie => ({ ...movie, kp_id: movie.id.toString() }));
  } catch (error) {
    console.error('Ошибка:', error);
    if (error.response.status === 500) {
            errorMessage.value = "Ошибка на сервере. Пожалуйста, попробуйте позже";
          }
    else {
      errorMessage.value = "Произошла ошибка";
    }
  } finally {
    loading.value = false;
  }
};

const clearAllHistory = () => {
  store.dispatch('clearAllHistory');
  showModal.value = false;
};

const debouncedPerformSearch = debounce(() => {
  if (searchTerm.value.length >= 3) {
    performSearch();
  } else if (searchTerm.value.length < 3) {
    movies.value = [];
    searchPerformed.value = false;
  }
}, 700);

onMounted(() => {
  const hash = window.location.hash
  if (hash.startsWith('#search=')) {
    const searchQuery = decodeURIComponent(hash.slice(8))
    searchTerm.value = searchQuery
    performSearch()
  }
})

// Автопоиск с задержкой (только для поиска по названию)
watch(searchTerm, () => {
  if (searchType.value === 'kinopoisk' || searchType.value === 'shikimori') {
    return;
  }
  debouncedPerformSearch();
});
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

.error-message {
  color: #ff4444;
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
  border: 1px solid #ff4444;
  border-radius: 5px;
  margin: 20px auto;
  max-width: 500px;
  background: rgba(255, 68, 68, 0.1);
}

@media (max-width: 600px) {
  .mainpage {
    padding-top: 50px;
    height: calc(100vh - 30px - 63px);
  }

  .search-container {
    padding: 5px;
  }
}
</style>