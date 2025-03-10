<template>
  <div>
    <div class="grid" v-show="!loading">
      <div
        v-for="(movie, index) in moviesList"
        :key="movie.kp_id"
        class="movie-card"
        :class="{ active: activeMovieIndex === index }"
        @click="handleMovieClick(movie, $event)"
        @contextmenu.prevent="handleMovieContextMenu(movie, $event)"
        :ref="(el) => (movieRefs[index] = el)"
        tabindex="0"
      >
      <div class="movie-poster-container">
        <div v-if="movie.poster || movie.cover">
          <img :src="movie.poster || movie.cover" :alt="movie.title" class="movie-poster" />
          <button
            v-if="isHistory"
            class="remove-button"
            @click.stop="removeFromHistory(movie.kp_id)"
          >
            <i class="fas fa-times"></i>
          </button>
            <div v-if="movie.rating_kp || movie.rating_imdb" class="ratings-overlay">
              <span v-if="movie.rating_kp" class="rating-kp">
                <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
                {{ movie.rating_kp }}
              </span>
              <span v-if="movie.rating_imdb" class="rating-imdb">
                <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
                {{ movie.rating_imdb }}
              </span>
              </div>
          </div>
        </div>

        <div class="movie-details">
          <div class="movie-header">
            <h3>{{ removeYearFromTitle(movie.title) }}</h3>
            <span class="year" v-if="movie.year">{{ movie.year }}</span>
          </div>
          
          <div v-if="!isHistory && movie.type" class="meta">
            <span class="type">{{ movie.type.replace("🎬", "") }}</span> 
          </div>
          
          <div v-if="!isHistory && movie.views_count" class="views">
            <span class="eye-icon">👁️</span>
            <span>{{ formatViews(movie.views_count) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Spinner v-if="loading" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex'; // Подключаем store
import Spinner from "@/components/SpinnerLoading.vue";

const props = defineProps({
  moviesList: Array,
  isHistory: Boolean,
  loading: Boolean
});

const router = useRouter();
const movieRefs = ref([]);
const activeMovieIndex = ref(null);
const store = useStore();

// Удаление года из названия фильма
const removeYearFromTitle = (title) => {
    if (title) {
      return title.replace(/\(\d{4}\)$/, '').trim();
    }
    return title; 
  };

// Форматирование просмотров
const formatViews = (views) => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views;
};

// Удаление фильма из истории
const removeFromHistory = (kp_id) => {
  store.dispatch('removeFromHistory', kp_id);
  store.dispatch('saveHistory');
};

// Открытие фильма в новой вкладке
const openMovieInNewTab = (movie) => {
  const url = router.resolve({ name: "movie-info", params: { kp_id: movie.kp_id } }).href;
  window.open(url, '_blank');
};

// Переход на страницу фильма
const goToMoviePage = (movie) => {
  router.push({ name: "movie-info", params: { kp_id: movie.kp_id } });
};

// Обработка клика левой кнопкой мыши
const handleMovieClick = (movie, event) => {
  if (event.ctrlKey || event.metaKey) {
    openMovieInNewTab(movie);
  } else {
    goToMoviePage(movie);
  }
};

// Обработка контекстного меню
const handleMovieContextMenu = (movie, event) => {
  event.preventDefault();
  openMovieInNewTab(movie);
};

// Обработка событий клавиатуры
const handleKeyDown = (event) => {
  if (!props.moviesList?.length) return;

  if (!event.target.classList.contains('movie-card')) {
    movieRefs.value[activeMovieIndex.value]?.focus();
  }

  switch (event.key) {
    case 'ArrowRight':
      activeMovieIndex.value = (activeMovieIndex.value + 1) % props.moviesList.length;
      break;
    case 'ArrowLeft':
      activeMovieIndex.value = (activeMovieIndex.value - 1 + props.moviesList.length) % props.moviesList.length;
      break;
    case 'ArrowUp':
      event.preventDefault();
      activeMovieIndex.value = Math.max(activeMovieIndex.value - 5, 0);
      break;
    case 'ArrowDown':
      event.preventDefault();
      activeMovieIndex.value = Math.min(activeMovieIndex.value + 5, props.moviesList.length - 1);
      break;
    case 'Home':
      activeMovieIndex.value = 0;
      break;
    case 'End':
      activeMovieIndex.value = props.moviesList.length - 1;
      break;
    case 'Enter':
      if (event.ctrlKey || event.metaKey) {
        openMovieInNewTab(props.moviesList[activeMovieIndex.value]);
      } else {
        goToMoviePage(props.moviesList[activeMovieIndex.value]);
      }
      break;
  }
};

// Автопрокрутка к активной карточке
watch(activeMovieIndex, (newIndex) => {
  if (movieRefs.value[newIndex]) {
    movieRefs.value[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    movieRefs.value[newIndex].focus();
  }
});

watch(() => props.loading, (newVal) => {
  console.log('Loading state changed:', newVal);
});

// Добавляем обработчик событий клавиатуры
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

// Удаляем обработчик при уничтожении компонента
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.grid {
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); /* Уменьшаем минимальную ширину */
  justify-content: center; /* Центрируем сетку */
  margin: 0 auto;
  width: 100%;
  padding: 0 15px;
  box-sizing: border-box;
}

/* Стили для контейнера карточек */
.cards-container {
    gap: 10px;
    justify-content: center;
    width: 100%;
}

/* Общие стили для карточек фильмов */
.movie-card {
    font-family: Arial, sans-serif;
    width: 100%;
    max-width: 240px;
    background: rgba(30, 30, 30, 0.6);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between; /* Разделяем контент внутри карточки */
    transition: transform 0.3s ease, box-shadow 0.3s ease, border 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}

/* Эффект при наведении: подъем и усиление тени */
.movie-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

/* Стили для фокуса и активного состояния карточек фильмов */
.movie-card:focus {
    outline: 2px solid white;
    outline-offset: 2px;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
    transition: border 0.2s ease; /* Плавное появление рамки */
    cursor: pointer;
}

/* Контейнер для постера */
.movie-poster-container {
    position: relative;
}

/* Контейнер для деталей фильма */
.movie-details {
    padding: 15px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

/* Заголовок фильма */
.movie-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
}

/* Ограничение количества строк у заголовка и обрезка текста */
.movie-header h3 {
    font-size: 1.1em;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
    max-height: 3.6em;
}

/* Стили для постера фильма */
.movie-poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
}

/* Контейнер для всех карточек */
.cards-container {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: stretch; /* Выравнивание по вертикали */
    justify-content: center;
    width: 100%;
}

/* Кнопка удаления из истории */
.remove-button {
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.movie-card:hover .remove-button {
  opacity: 1;
}

.remove-button:hover {
  background-color: rgba(255, 0, 0, 0.7);
}

.ratings-overlay {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  gap: 10px;
  background: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 5px;
  justify-content: center;
  align-items: center;
}

.rating-kp,
.rating-imdb {
  font-size: 1.2em;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 5px; /* Расстояние между иконкой и текстом */
}

.rating-logo {
  width: 20px; /* Размер иконок */
  height: auto;
  display: inline-block;
}

.year,
.type,
.views,
.eye-icon {
  font-size: 0.9em;
  color: #ccc;
}

.meta {
  margin-bottom: 10px;
}

.views {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Мобильная версия */
@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 5px; 
  }

  .ratings-overlay {
    bottom: 3px;
    left: 0;
    padding: 4px 8px;
    font-size: 0.8em;
    border-radius: 0;
    }

  .movie-card {
    flex-direction: row;
    align-items: flex-start;
    height: 180px;
    width: 100%;
    max-width: none;
    border-radius: 15px;
    }    

  .movie-poster-container {
    width: 120px; /* Ширина постера увеличена */
    }

  .movie-poster {
    width: 120px;
    aspect-ratio: 2 / 3;
    border-radius: 10px 0 0 10px;
    }  

  .movie-details {
    padding: 10px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    }

  .movie-header h3 {
    font-size: 1.2em;
    -webkit-line-clamp: 2;
    max-height: 2.4em;
    }

  .rating-logo {
    width: 15px; /* Размер иконок */
    height: auto;
    display: inline-block;
  }

  .year,
  .type,
  .views {
    font-size: 1em; /* Увеличенный шрифт */
  }

  .eye-icon {
    font-size: 1.2em; /* Увеличенный шрифт */
  }
}
</style>
