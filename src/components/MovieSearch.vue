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
        <input
          ref="searchInput"
          v-model="searchTerm"
          :placeholder="getPlaceholder()"
          class="search-input"
          @keydown.enter="search"
        />
        <div class="icons">
          <button
            v-if="searchTerm"
            @click="resetSearch"
            class="reset-button"
          >
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
      <h2>История просмотра
        <span>
          <button @click="clearAllHistory" class="clear-history-button">
            Очистить
          </button>
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
    <div v-if="searchTerm && !searchPerformed && !loading" class="search-prompt">
      Нажмите кнопку "Поиск" или Enter для поиска
    </div>
  </div>
</div>
<FooterDonaters />
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import CardsMovie from "@/components/CardsMovie.vue";
import FooterDonaters from '@/components/FooterDonaters.vue';
import debounce from 'lodash/debounce';

const apiUrl = import.meta.env.VITE_APP_API_URL;
const store = useStore();
const router = useRouter();

const searchType = ref('title');
const searchTerm = ref('');
const movies = ref([]);
const loading = ref(false);
const searchPerformed = ref(false);

const history = computed(() => store.state.history);

const setSearchType = (type) => {
  searchType.value = type;
  resetSearch();
};

const getPlaceholder = () => {
  return {
    title: 'Введите название фильма',
    kinopoisk: 'Введите ID Кинопоиск',
    shikimori: 'Введите ID Shikimori'
  }[searchType.value] || 'Введите название фильма';
};

onMounted(() => {
  store.dispatch('loadHistory');
});

const performSearch = debounce(async () => {
  if (!searchTerm.value || searchTerm.value.length < 3) return;

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
    
    const response = await axios.get(`${apiUrl}/search/${searchTerm.value}`);
    movies.value = response.data.map(movie => ({ ...movie, kp_id: movie.id.toString() }));
  } catch (error) {
    console.error('Ошибка:', error);
    movies.value = [];
    if (error.response?.status) {
      router.push(`/${error.response.status}`);
    }
  } finally {
    loading.value = false;
  }
}, 300);

watch(searchTerm, (newVal, oldVal) => {
  if (newVal.length >= 3) {
    performSearch();
  } else if (newVal.length < 3 && oldVal.length >= 3) {
    // Очищаем результаты если текст стал короче 3 символов
    movies.value = [];
    searchPerformed.value = false;
  }
});

const search = () => {
  if (searchTerm.value) {
    performSearch.flush();
  }
};

const resetSearch = () => {
  searchTerm.value = '';
  movies.value = [];
  searchPerformed.value = false;
};

const clearAllHistory = () => {
  if (confirm('Вы уверены, что хотите очистить историю?')) {
    store.dispatch('clearAllHistory');
  }
};
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

.clear-history-button {
  padding: 10px;
  font-size: 20px;
  border: none;
  background: rgba(255, 0, 0, 0.2);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  border: 1px solid #ccc;
}

.clear-history-button:hover {
  background-color: #ff0000;
}

@media (max-width: 600px) {
  .mainpage{
    padding-top: 50px;
    height: calc(100vh - 30px - 63px);
  }
  .search-container {
    padding: 5px;
}
}
</style>