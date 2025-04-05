<template>
  <div class="movie-info">
    <div class="content">
      <SpinnerLoading v-if="infoLoading" />

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

      <div v-if="errorMessage" class="content-card">
        <PlayerComponent :key="kp_id" :kp-id="kp_id" />
      </div>

      <div v-if="movieInfo" class="content-card">
        <div class="content-header">
          <div
            v-if="movieInfo.logo_url"
            class="content-logo"
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <img :src="movieInfo.logo_url" alt="Логотип фильма" class="content-logo" />
          </div>
          <div
            v-else
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <h1 class="content-title">{{ movieInfo.title }}</h1>
          </div>

          <div v-show="titleCopyTooltip" class="title-copy-tooltip" :style="tooltipStyle">
            Скопировать
          </div>
        </div>

        <div
          v-if="
            movieInfo.kinopoisk_id ||
            movieInfo.title ||
            movieInfo.imdb_id ||
            movieInfo.rating_imdb ||
            movieInfo.shikimori_id
          "
          class="ratings-links"
        >
          <!-- Кинопоиск -->
          <div v-if="movieInfo.kinopoisk_id">
            <a
              :href="`https://www.kinopoisk.ru/film/${movieInfo.kinopoisk_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span v-if="movieInfo.rating_kinopoisk">{{ movieInfo.rating_kinopoisk }}/10</span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Поиск на Кинопоиске, если нет ID -->
          <div v-if="!movieInfo.kinopoisk_id && movieInfo.title">
            <a
              :href="`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span v-if="movieInfo.rating_kinopoisk">{{ movieInfo.rating_kinopoisk }}/10</span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- IMDb -->
          <div v-if="movieInfo.imdb_id">
            <a
              :href="`https://www.imdb.com/title/${movieInfo.imdb_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span v-if="movieInfo.rating_imdb">{{ movieInfo.rating_imdb }}/10</span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Поиск на IMDb, если нет ID -->
          <div v-if="!movieInfo.imdb_id && movieInfo.title">
            <a
              :href="`https://www.imdb.com/find/?q=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span v-if="movieInfo.rating_imdb">{{ movieInfo.rating_imdb }}/10</span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Shikimori -->
          <div v-if="movieInfo.shikimori_id">
            <a
              :href="`https://shikimori.one/animes/${movieInfo.shikimori_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-shikimori.svg" alt="Shiki" class="rating-logo" />
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Parents Guide (только если есть IMDb id) -->
          <div v-if="movieInfo.imdb_id">
            <a
              :href="`https://www.imdb.com/title/${movieInfo.imdb_id}/parentalguide`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <span>Parents Guide</span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>
        </div>

        <!-- Интеграция компонента плеера -->
        <PlayerComponent :key="kp_id" :kp-id="kp_id" />

        <meta
          name="title-and-year"
          :content="
            movieInfo.type === 'FILM' && movieInfo.year
              ? `${movieInfo.title} (${movieInfo.year})`
              : movieInfo.title
          "
        />

        <meta
          v-if="movieInfo.name_original"
          name="original-title"
          :content="movieInfo.name_original"
        />
        <div class="additional-info">
          <div class="controls">
            <div class="tooltip-container">
              <button
                class="favorite-btn"
                :class="{ active: movieInfo.lists.isFavorite }"
                @mouseenter="showTooltip('favorite')"
                @mouseleave="activeTooltip = null"
                @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
              >
                <span class="material-icons">{{
                  movieInfo.lists.isFavorite ? 'favorite' : 'favorite_border'
                }}</span>
              </button>
              <div v-show="activeTooltip === 'favorite'" class="custom-tooltip">
                {{ 'В избранное' }}
              </div>
            </div>

            <div class="tooltip-container">
              <button
                class="watching-btn"
                :class="{ active: movieInfo.lists.isWatching }"
                @mouseenter="showTooltip('watching')"
                @mouseleave="activeTooltip = null"
                @click="toggleList(USER_LIST_TYPES_ENUM.WATCHING)"
              >
                <span class="material-icons">{{
                  movieInfo.lists.isWatching ? 'visibility' : 'visibility_off'
                }}</span>
              </button>
              <div v-show="activeTooltip === 'watching'" class="custom-tooltip">
                {{ 'Смотрю' }}
              </div>
            </div>

            <div class="tooltip-container">
              <button
                class="later-btn"
                :class="{ active: movieInfo.lists.isLater }"
                @mouseenter="showTooltip('later')"
                @mouseleave="activeTooltip = null"
                @click="toggleList(USER_LIST_TYPES_ENUM.LATER)"
              >
                <span class="material-icons">{{ 'watch_later' }}</span>
              </button>
              <div v-show="activeTooltip === 'later'" class="custom-tooltip">
                {{ 'Смотреть позже' }}
              </div>
            </div>

            <div class="tooltip-container">
              <button
                class="completed-btn"
                :class="{ active: movieInfo.lists.isCompleted }"
                @mouseenter="showTooltip('completed')"
                @mouseleave="activeTooltip = null"
                @click="toggleList(USER_LIST_TYPES_ENUM.COMPLETED)"
              >
                <span class="material-icons">{{
                  movieInfo.lists.isCompleted ? 'check_circle' : 'check_circle_outline'
                }}</span>
              </button>
              <div v-show="activeTooltip === 'completed'" class="custom-tooltip">
                {{ 'Просмотрено' }}
              </div>
            </div>

            <div class="tooltip-container">
              <button
                class="abandoned-btn"
                :class="{ active: movieInfo.lists.isAbandoned }"
                @mouseenter="showTooltip('abandoned')"
                @mouseleave="activeTooltip = null"
                @click="toggleList(USER_LIST_TYPES_ENUM.ABANDONED)"
              >
                <span class="material-icons">{{
                  movieInfo.lists.isAbandoned ? 'not_interested' : 'not_interested'
                }}</span>
              </button>
              <div v-show="activeTooltip === 'abandoned'" class="custom-tooltip">
                {{ 'Брошено' }}
              </div>
            </div>
          </div>
          <h2 class="additional-info-title">Подробнее</h2>
          <div class="info-content">
            <div class="details-container">
              <ul class="info-list">
                <li v-if="movieInfo.type && TYPES_ENUM[movieInfo.type]">
                  <strong>Тип:</strong> {{ TYPES_ENUM[movieInfo.type] }}
                </li>
                <li v-if="movieInfo.year"><strong>Год выпуска:</strong> {{ movieInfo.year }}</li>
                <li v-if="movieInfo.title"><strong>Название:</strong> {{ movieInfo.title }}</li>
                <li v-if="movieInfo.name_original">
                  <strong>Оригинальное название:</strong> {{ movieInfo.name_original }}
                </li>
                <li v-if="movieInfo.slogan"><strong>Слоган:</strong> {{ movieInfo.slogan }}</li>
                <li v-if="movieInfo.production_companies">
                  <strong>Продакшн:</strong> {{ movieInfo.production_companies }}
                </li>
                <li v-if="movieInfo.countries?.length">
                  <strong>Страна производства:</strong>
                  {{ movieInfo.countries.map((item) => item.country).join(', ') }}
                </li>
                <li v-if="movieInfo.genres?.length">
                  <strong>Жанры:</strong>
                  {{ movieInfo.genres.map((item) => item.genre).join(', ') }}
                </li>
                <li v-if="movieInfo.film_length">
                  <strong>Продолжительность:</strong> {{ formatTime(movieInfo.film_length) }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="content-info">
          <p v-if="movieInfo.description" class="content-description-text">
            {{ movieInfo.description }}
          </p>
        </div>

        <div v-if="videos.length && areTrailersActive" class="yt-video-container">
          <TrailerCarousel :videos="videos" @select="playTrailer" />
        </div>

        <!-- Секция с сиквелами и приквелами -->
        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <h2>Сиквелы и приквелы</h2>
          <MovieList :movies-list="sequelsAndPrequels" :loading="false" :is-history="false" />
        </div>

        <!-- Секция с похожими фильмами -->
        <div v-if="similars.length" class="related-movies">
          <h2>Похожие</h2>
          <MovieList :movies-list="similars" :loading="false" :is-history="false" />
        </div>
      </div>
    </div>
  </div>
  <Notification ref="notificationRef" />
</template>

<script setup>
import { getKpInfo, getShikiInfo } from '@/api/movies'
import { handleApiError } from '@/constants'
import { addToList, delFromList } from '@/api/user'
import { MovieList } from '@/components/MovieList/'
import PlayerComponent from '@/components/PlayerComponent.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import { TYPES_ENUM, USER_LIST_TYPES_ENUM } from '@/constants'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { useNavbarStore } from '@/store/navbar'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Notification from '@/components/notification/ToastMessage.vue'
import TrailerCarousel from '@/components/TrailerCarousel.vue'
import { useTrailerStore } from '@/store/trailer'

const infoLoading = ref(true)
const mainStore = useMainStore()
const authStore = useAuthStore()
const backgroundStore = useBackgroundStore()
const route = useRoute()
const kp_id = ref(route.params.kp_id)
const errorMessage = ref('')
const errorCode = ref(null)
const movieInfo = ref(null)
const navbarStore = useNavbarStore()
const trailerStore = useTrailerStore()

const areTrailersActive = trailerStore.areTrailersActive

const activeTooltip = ref(null)
const tooltipHovered = ref(false)
let hideTimeout = null

const showTooltip = (tooltipName) => {
  activeTooltip.value = tooltipName
  tooltipHovered.value = false
  clearTimeout(hideTimeout)
}

const setDocumentTitle = () => {
  if (movieInfo.value) {
    const title =
      movieInfo.value.name_ru ||
      movieInfo.value.name_en ||
      movieInfo.value.name_original ||
      'Информация о фильме'
    document.title = title
  }
}

const transformMoviesData = (movies) => {
  return (movies || []).map((movie) => ({
    kp_id: movie.film_id,
    poster: movie.poster_url_preview || movie.poster_url,
    title: movie.name_ru || movie.name_en || movie.name_original
  }))
}

const formatTime = (minutes) => {
  if (typeof minutes !== 'number') {
    return
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours} ч. ${mins} мин.`
}

const titleCopyTooltip = ref(false)
const tooltipStyle = ref({ top: '0px', left: '0px' })
const moveTooltip = (event) => {
  titleCopyTooltip.value = true
  tooltipStyle.value = {
    top: `${event.pageY + 10}px`,
    left: `${event.pageX - 70}px`
  }
}

const notificationRef = ref(null)
const copyMovieMeta = async () => {
  try {
    const movieMeta = [
      movieInfo.value.name_ru || movieInfo.value.name_en || movieInfo.value.name_original,
      ...(movieInfo.value.year ? [movieInfo.value.year] : []),
      ...(movieInfo.value.film_length ? [formatTime(movieInfo.value.film_length)] : [])
    ]
    await navigator.clipboard.writeText(movieMeta.join(', '))
    notificationRef.value.showNotification('Скопировано')
  } catch (err) {
    console.error('Ошибка копирования:', err)
  }
}

const getListStatus = (movieInfo, listType) => {
  const statusMap = {
    [USER_LIST_TYPES_ENUM.FAVORITE]: movieInfo.lists?.isFavorite || false,
    [USER_LIST_TYPES_ENUM.HISTORY]: movieInfo.lists?.isHistory || false,
    [USER_LIST_TYPES_ENUM.LATER]: movieInfo.lists?.isLater || false,
    [USER_LIST_TYPES_ENUM.COMPLETED]: movieInfo.lists?.isCompleted || false,
    [USER_LIST_TYPES_ENUM.ABANDONED]: movieInfo.lists?.isAbandoned || false,
    [USER_LIST_TYPES_ENUM.WATCHING]: movieInfo.lists?.isWatching || false
  }

  return statusMap[listType] ?? false
}

const toggleList = async (type) => {
  if (!authStore.token) {
    notificationRef.value.showNotification('Необходимо авторизоваться', 5000)
    return
  }
  let hasError = false
  try {
    if (getListStatus(movieInfo.value, type)) {
      await delFromList(kp_id.value, type)
      notificationRef.value.showNotification('Удалено')
    } else {
      await addToList(kp_id.value, type)
      notificationRef.value.showNotification('Добавлено')
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    notificationRef.value.showNotification(`${message} ${code}`)
  }
  if (!hasError) {
    await fetchMovieInfo(false)
  }
}

const fetchMovieInfo = async (updateHistory = true) => {
  try {
    let response
    if (kp_id.value.startsWith('shiki')) {
      response = await getShikiInfo(kp_id.value)
    } else {
      response = await getKpInfo(kp_id.value, authStore.token)
    }

    if (Array.isArray(response) && response.length === 0) {
      throw new Error('Данные не найдены. Пожалуйста, повторите поиск.')
    }

    movieInfo.value = response

    if (kp_id.value.startsWith('shiki')) {
      movieInfo.value = {
        ...movieInfo.value,
        title: movieInfo.value.name_ru || movieInfo.value.name_en,
        name_original: movieInfo.value.name_en,
        short_description: movieInfo.value.slogan
      }
    } else {
      movieInfo.value = {
        ...movieInfo.value,
        title: movieInfo.value.name_ru || movieInfo.value.name_en || movieInfo.value.name_original,
        kinopoisk_id: kp_id.value
      }
    }

    navbarStore.setHeaderContent({
      text: movieInfo.value.title,
      imageUrl: movieInfo.value.logo_url
    })

    setDocumentTitle()

    const movieToSave = {
      kp_id: kp_id.value,
      title: movieInfo.value?.name_ru || movieInfo.value?.name_en || movieInfo.value?.name_original,
      poster:
        movieInfo.value?.poster_url ||
        movieInfo.value?.cover_url ||
        movieInfo.value?.screenshots[0],
      year: movieInfo.value?.year,
      type: movieInfo.value?.type
    }

    // Устанавливаем фон фильма через новый метод
    if (kp_id.value.startsWith('shiki')) {
      if (movieInfo.value.screenshots && movieInfo.value.screenshots.length > 0) {
        const randomIndex = Math.floor(Math.random() * movieInfo.value.screenshots.length)
        const randomScreenshot = movieInfo.value.screenshots[randomIndex]
        backgroundStore.updateMoviePoster(randomScreenshot)
      } else if (movieToSave.poster) {
        backgroundStore.updateMoviePoster(movieToSave.poster)
      }
    } else {
      if (movieToSave.poster) {
        backgroundStore.updateMoviePoster(movieToSave.poster)
      }
    }

    const isHistoryAllowed = computed(() => mainStore.isHistoryAllowed)

    if (isHistoryAllowed.value && movieToSave.kp_id && movieToSave.title && updateHistory) {
      if (authStore.token) {
        try {
          await addToList(movieToSave.kp_id, USER_LIST_TYPES_ENUM.HISTORY)
        } catch (error) {
          console.error('Ошибка при добавлении в историю:', error)
        }
      } else {
        mainStore.addToHistory({ ...movieToSave })
      }
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при загрузке информации о фильмах:', error)
  }
}

const videos = computed(() => {
  console.log('Трейлеры:', movieInfo.value?.videos)
  return movieInfo.value?.videos
})

const sequelsAndPrequels = computed(() =>
  transformMoviesData(movieInfo.value?.sequels_and_prequels)
)

const similars = computed(() => transformMoviesData(movieInfo.value?.similars))

onMounted(async () => {
  await fetchMovieInfo()
  infoLoading.value = false
})

onUnmounted(async () => {
  navbarStore.clearHeaderContent()
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      navbarStore.clearHeaderContent()
      kp_id.value = newKpId
      await fetchMovieInfo()
      infoLoading.value = false
    }
  },
  { immediate: true }
)

watch(
  movieInfo,
  () => {
    setDocumentTitle()
  },
  { deep: true }
)
</script>

<style scoped>
.content {
  min-height: 100vh;
}
/* Стили для информации о фильме */
.content-card {
  overflow: hidden;
  padding: 20px;
  color: #e0e0e0;
}

.content-header {
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.content-logo {
  max-height: 80px;
  height: 80px;
  width: auto;
  object-fit: contain;
  max-width: 100%;
}

.content-title {
  font-size: 55px;
  margin: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
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
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
  border: 1px solid #ff4444;
  border-radius: 5px;
  margin: 20px auto;
  max-width: 500px;
  background: rgba(255, 68, 68, 0.1);
}

/* Стили для секций с похожими фильмами */
.related-movies {
  margin-top: 30px;
}

.related-movies h2 {
  color: #fff;
  margin-bottom: 15px;
}

/* Подсказка */
.title-copy-tooltip {
  position: absolute;
  background-color: #333;
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
}

@media (max-width: 600px) {
  .content-card {
    padding: 0 2px;
  }

  .content-header,
  .content-logo,
  .content-title {
    display: none;
  }

  .content-subtitle {
    font-size: 16px;
  }

  .ratings-links {
    margin: 5px 0;
  }

  .additional-info-title {
    font-size: 20px;
  }

  .info-content {
    flex-direction: column;
  }
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 40px;
  border-radius: 10px;
}

.controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #444;
  color: #fff;
  border: none;
  padding: 12px;
  font-size: 18px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  z-index: 4;
  width: 50px;
  height: 50px;
}

.controls button:hover {
  background-color: #555;
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.controls button:active {
  transform: translateY(0);
  box-shadow: none;
}

.controls button.active {
  background-color: #4caf50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.7);
}

.material-icons {
  font-size: 24px;
}

.tooltip-container {
  position: relative;
  display: inline-block;
}

.custom-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: #fff;
  padding: 5px;
  border-radius: 4px;
  font-size: 16px;
  white-space: nowrap;
  margin-top: 8px;
  pointer-events: none;
  text-align: center;
}

.advanced-tooltip {
  white-space: normal;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  top: calc(100% + 5px);
  pointer-events: all;
  text-align: center;
}

.tooltip-title {
  font-size: 16px;
  text-align: center;
}
</style>
