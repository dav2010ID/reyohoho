<template>
  <div class="movie-info">
    <div class="content">
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-if="movieInfo" class="content-card">
        <div class="content-header">
          <div v-if="movieInfo.logo_url">
            <img :src="movieInfo.logo_url" alt="Логотип фильма" class="content-logo" />
          </div>
          <div v-else>
            <h1 class="content-title">{{ movieInfo.name_ru }}</h1>
          </div>
          <p v-if="movieInfo.name_en" class="content-subtitle">{{ movieInfo.name_en }}</p>
        </div>

        <div class="ratings-links" v-if="movieInfo.rating_kinopoisk || movieInfo.rating_imdb">
          <a
            :href="`https://www.kinopoisk.ru/film/${kp_id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="rating-link"
          >
            <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
            <span v-if="movieInfo.rating_kinopoisk">{{ movieInfo.rating_kinopoisk }}/10</span>
            <img src="/src/assets/icon-external-link.png" alt="Внешняя ссылка" class="external-link-icon" />
          </a>
          <a
            v-if="movieInfo.imdb_id && movieInfo.rating_imdb"
            :href="`https://www.imdb.com/title/${movieInfo.imdb_id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="rating-link"
          >
            <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
            <span>{{ movieInfo.rating_imdb }}/10</span>
            <img src="/src/assets/icon-external-link.png" alt="Внешняя ссылка" class="external-link-icon" />
          </a>
          <a
            v-if="movieInfo.imdb_id"
            :href="`https://www.imdb.com/title/${movieInfo.imdb_id}/parentalguide`"
            target="_blank"
            rel="noopener noreferrer"
            class="rating-link"
          >
            <span>Parents Guide</span>
            <img src="/src/assets/icon-external-link.png" alt="Внешняя ссылка" class="external-link-icon" />
          </a>
        </div>

        <!-- Интеграция компонента плеера -->
        <PlayerComponent 
          :kp_id="kp_id"
          :key="kp_id"
        />

        <div class="additional-info">
          <h2 class="additional-info-title">Подробнее</h2>
          <div class="info-content">
            <div class="details-container">
              <ul class="info-list">
                <li v-if="movieInfo.year"><strong>Год выпуска:</strong> {{ movieInfo.year }}</li>
                <li v-if="movieInfo.name_original"><strong>Оригинальное название:</strong> {{ movieInfo.name_original }}</li>
                <li v-if="movieInfo.countries?.length">
                  <strong>Страна производства:</strong> {{ movieInfo.countries.map(item => item.country).join(', ') }}
                </li>
                <li v-if="movieInfo.genres?.length">
                  <strong>Жанры:</strong> {{ movieInfo.genres.map(item => item.genre).join(', ') }}
                </li>
                <li v-if="movieInfo.film_length"><strong>Продолжительность:</strong> {{ movieInfo.film_length }} мин.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="content-info">
          <p v-if="movieInfo.description" class="content-description-text">
            {{ movieInfo.description }}
          </p>
          <p v-if="movieInfo.short_description" class="content-short-description">
            {{ movieInfo.short_description }}
          </p>
        </div>

        <!-- Секция с сиквелами и приквелами -->
        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <h2>Сиквелы и приквелы</h2>
          <CardsMovie :moviesList="sequelsAndPrequels" :loading="false" :isHistory="false" />
        </div>

        <!-- Секция с похожими фильмами -->
        <div v-if="similars.length" class="related-movies">
          <h2>Похожие фильмы</h2>
          <CardsMovie :moviesList="similars" :loading="false" :isHistory="false" />
        </div>
      </div>
    </div>
    <BackgroundComponent 
      :external-background-url="movieInfo?.cover_url || movieInfo?.poster_url" 
      :is-background-active="isBackgroundActive"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import BackgroundComponent from "@/components/BackgroundSpace.vue";
import PlayerComponent from '@/components/PlayerComponent.vue';
import CardsMovie from "@/components/CardsMovie.vue";
import { useStore } from 'vuex';

const store = useStore();
const route = useRoute();
const kp_id = ref(route.params.kp_id);
const errorMessage = ref('');
const movieInfo = ref(null);
const apiUrl = import.meta.env.VITE_APP_API_URL;
const isBackgroundActive = ref(false);


const transformMoviesData = (movies) => {
  return (movies || []).map(movie => ({
    kp_id: movie.film_id,
    poster: movie.poster_url_preview || movie.poster_url,
    title: movie.name_ru,
  }));
};

// Функция для загрузки информации о фильме
const fetchMovieInfo = async () => {
  try {
    const response = await axios.get(`${apiUrl}/kp_info2/${kp_id.value}`);
    movieInfo.value = response.data;

    // Подготовка объекта для истории
    const movieToSave = {
      kp_id: kp_id.value,
      title: movieInfo.value?.name_ru,
      poster: movieInfo.value?.poster_url || movieInfo.value?.cover_url,
    };

    if (movieToSave.kp_id && movieToSave.title) {
      store.dispatch('addToHistory', { ...movieToSave }); // Копируем объект, чтобы Vuex видел изменение
    }
  } catch (error) {
    console.error('Ошибка при загрузке информации о фильме:', error);
    errorMessage.value = 'Ошибка загрузки информации о фильме';
  }
};

// Преобразуем данные для компонентов
const sequelsAndPrequels = computed(() => transformMoviesData(movieInfo.value?.sequels_and_prequels));
const similars = computed(() => transformMoviesData(movieInfo.value?.similars));

onMounted(async () => {
  isBackgroundActive.value = true;
  await fetchMovieInfo();
});

onUnmounted(() => {
  isBackgroundActive.value = false;
});

// Следим за изменением ID фильма
watch(() => route.params.kp_id, async (newKpId) => {
  if (newKpId && newKpId !== kp_id.value) {
    kp_id.value = newKpId;
    await fetchMovieInfo();
  }
}, { immediate: true });
</script>

<style scoped>
/* Стили для информации о фильме */
.content-card {
  overflow: hidden;
  padding: 20px;
  color: #e0e0e0;
}

.content-header {
  text-align: center;
  margin-bottom: 20px;
}

.content-title {
  font-size: 36px;
  margin: 0 0 10px;
}

.content-logo {
  max-height: 80px;
  object-fit: contain;
  width: 100%;
}

.content-subtitle {
  font-size: 20px;
  color: #bbb;
}

.ratings-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 15px 0;
}

.rating-link {
  display: inline-flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  font-weight: bold;
}

.rating-logo {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.external-link-icon {
  width: 20px;
  height: auto;
  margin-left: 5px;
}

.additional-info {
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 16px;
}

.additional-info-title {
  margin: 0 0 15px;
  font-size: 22px;
  text-align: left;
  color: #fff;
}

.info-content {
  display: flex;
  gap: 20px;
}

.details-container {
  flex: 3;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-list li {
  margin-bottom: 8px;
}

.content-info {
  font-size: 16px;
  line-height: 1.6;
  color: #ccc;
}

.content-description-text,
.content-short-description {
  margin: 0 0 10px;
}

.error-message {
  color: #ff4444;
  background-color: rgba(255, 230, 230, 0.1);
  padding: 10px;
  border-radius: 5px;
  margin: 20px auto;
  max-width: 400px;
  border: 1px solid #ff4444;
}

/* Стили для секций с похожими фильмами */
.related-movies {
  margin-top: 30px;
}

.related-movies h2 {
  color: #fff;
  margin-bottom: 15px;
}

@media (max-width: 600px) {
  .content-card {
    padding: 10px 2px;
  }
  .content-title {
    font-size: 28px;
  }
  .content-subtitle {
    font-size: 16px;
  }
  .additional-info-title {
    font-size: 20px;
  }
  .info-content {
    flex-direction: column;
  }
}
</style>
