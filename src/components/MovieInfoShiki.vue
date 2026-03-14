<template>
  <div class="movie-info">
    <div class="content">
      <div v-if="(infoLoading || !movieInfo) && !errorMessage" class="content-card">
        <div class="movie-skeleton">
          <div class="movie-skeleton__header">
            <div class="movie-skeleton__title"></div>
          </div>

          <div class="movie-skeleton__ratings">
            <div class="movie-skeleton__rating-item"></div>
            <div class="movie-skeleton__rating-item"></div>
            <div class="movie-skeleton__rating-item"></div>
          </div>

          <div class="movie-skeleton__player">
            <SpinnerLoading />
          </div>

          <div class="movie-skeleton__additional-info">
            <div class="movie-skeleton__section-title"></div>
            <div class="movie-skeleton__info-list">
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
            </div>
          </div>

          <div class="movie-skeleton__description">
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
          </div>
        </div>
      </div>

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

      <div v-if="errorMessage" class="content-card">
        <component
          :is="moviePlayerComponent"
          v-if="moviePlayerComponent"
          :key="shiki_id"
          :movie-info="movieInfo"
          @update:movie-info="fetchMovieInfo"
        />
      </div>

      <div v-if="movieInfo && !infoLoading" class="content-card">
        <div class="content-header">
          <div
            v-if="movieInfo.logo_url"
            class="content-logo"
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <img :src="movieInfo.logo_url" alt="Логотип аниме" class="content-logo" />
          </div>
          <div
            v-else
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <h1 class="content-title">
              {{ movieInfo.title }}
            </h1>
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
          <component
            :is="movieRatingComponent"
            v-if="movieRatingComponent && movieInfo.kinopoisk_id"
            :key="movieInfo.kinopoisk_id"
            :kp-id="movieInfo.kinopoisk_id"
            :show-dash="true"
          />

          <div v-if="movieInfo.kinopoisk_id">
            <a
              :href="`https://www.kinopoisk.ru/film/${movieInfo.kinopoisk_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_kinopoisk_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_kinopoisk_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <div v-if="!movieInfo.kinopoisk_id && movieInfo.title">
            <a
              :href="`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_kinopoisk_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_kinopoisk_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <div v-if="movieInfo.imdb_id">
            <a
              :href="`https://www.imdb.com/title/tt${movieInfo.imdb_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <div v-if="!movieInfo.imdb_id && movieInfo.title">
            <a
              :href="`https://www.imdb.com/find/?q=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

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
        </div>

        <component
          :is="moviePlayerComponent"
          v-if="moviePlayerComponent"
          :key="shiki_id"
          :kp-id="shiki_id"
          :movie-info="movieInfo"
          @update:movie-info="fetchMovieInfo"
        />

        <div class="additional-info">
          <h2 class="additional-info-title">Подробнее</h2>
          <div class="info-content">
            <div
              v-if="movieInfo.screenshots && movieInfo.screenshots.length > 0"
              class="movie-poster-container"
            >
              <img
                :src="movieInfo.screenshots[0]"
                :alt="movieInfo.title"
                class="movie-poster"
                @error="handleImageError"
              />
            </div>
            <div class="details-container">
              <ul class="info-list">
                <li v-if="movieInfo.year"><strong>Год:</strong> {{ movieInfo.year }}</li>
                <li v-if="movieInfo.type"><strong>Тип:</strong> {{ movieInfo.type }}</li>
                <li v-if="movieInfo.name_ru && movieInfo.name_en">
                  <strong>Оригинальное название:</strong> {{ movieInfo.name_en }}
                </li>
                <li v-if="movieInfo.slogan"><strong>Слоган:</strong> {{ movieInfo.slogan }}</li>
              </ul>
              <div class="content-info">
                <p v-if="movieInfo.description" class="content-description-text">
                  {{ movieInfo.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import { useBackgroundStore } from '@/store/background'
import { useNavbarStore } from '@/store/navbar'
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getRatingColor } from '@/utils/ratingUtils'
import { getShikiInfo } from '@/api/movies'

const infoLoading = ref(true)
const backgroundStore = useBackgroundStore()
const route = useRoute()
const shiki_id = ref(route.params.shiki_id)
const errorMessage = ref('')
const errorCode = ref(null)
const movieInfo = ref(null)
const moviePlayerComponent = ref(null)
const movieRatingComponent = ref(null)
const navbarStore = useNavbarStore()
const notificationRef = ref(null)

const titleCopyTooltip = ref(false)
const tooltipStyle = ref({})

const moveTooltip = (event) => {
  titleCopyTooltip.value = true
  tooltipStyle.value = {
    left: event.clientX + 10 + 'px',
    top: event.clientY - 30 + 'px'
  }
}

const formatRatingNumber = (number) => {
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + 'M'
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'K'
  }
  return number.toString()
}

const handleImageError = (event) => {
  event.target.src = '/src/assets/image-no-poster.gif'
}

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

const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
}

const fetchMovieInfo = async () => {
  try {
    infoLoading.value = true
    const response = await getShikiInfo(shiki_id.value)

    if (Array.isArray(response) && response.length === 0) {
      throw new Error('Данные не найдены. Пожалуйста, повторите поиск.')
    }

    movieInfo.value = response

    movieInfo.value = {
      ...movieInfo.value,
      title: movieInfo.value.name_ru || movieInfo.value.name_en,
      name_original: movieInfo.value.name_en,
      short_description: movieInfo.value.slogan
    }

    navbarStore.setHeaderContent({
      text: movieInfo.value.title,
      imageUrl: movieInfo.value.logo_url
    })

    setDocumentTitle()

    if (movieInfo.value.screenshots && movieInfo.value.screenshots.length > 0) {
      const randomIndex = Math.floor(Math.random() * movieInfo.value.screenshots.length)
      const randomScreenshot = movieInfo.value.screenshots[randomIndex]
      backgroundStore.updateMoviePoster(randomScreenshot)
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при загрузке информации о фильмах:', error)
  } finally {
    infoLoading.value = false
  }
}

const handleApiError = (error) => {
  if (error.response) {
    const status = error.response.status
    let message = 'Произошла ошибка при загрузке данных'
    let code = status

    switch (status) {
      case 404:
        message = 'Фильм не найден'
        break
      case 403:
        message = 'Доступ запрещен'
        break
      case 500:
        message = 'Ошибка сервера'
        break
      default:
        message = `Ошибка ${status}`
    }

    return { message, code }
  } else if (error.request) {
    return { message: 'Ошибка сети', code: 'NETWORK_ERROR' }
  } else {
    return { message: error.message || 'Неизвестная ошибка', code: 'UNKNOWN' }
  }
}

const setDocumentTitle = () => {
  if (movieInfo.value?.title) {
    document.title = `${movieInfo.value.title} - ReYohoho`
  }
}

watch(
  () => route.params.shiki_id,
  async (newShikiId) => {
    if (newShikiId && newShikiId !== shiki_id.value) {
      navbarStore.clearHeaderContent()
      shiki_id.value = newShikiId
      await fetchMovieInfo()
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

onMounted(() => {
  import('@/components/PlayerComponent.vue').then((module) => {
    moviePlayerComponent.value = module.default
  })
  import('@/components/MovieRating.vue').then((module) => {
    movieRatingComponent.value = module.default
  })
  if (!movieInfo.value) {
    fetchMovieInfo()
  }
})
</script>

<style scoped>
.movie-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  color: #fff;
  min-height: 100vh;
}

.content {
  max-width: 1200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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
  flex-wrap: wrap;
  height: auto;
  min-height: 80px;
  margin-bottom: 1rem;
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
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  transition: all 0.3s ease;
  cursor: pointer;
}

.content-title:hover {
  text-shadow: 0 0 20px var(--accent-color);
  color: var(--accent-color);
}

.content-logo {
  max-height: 80px;
  height: 80px;
  width: auto;
  object-fit: contain;
  max-width: 100%;
  transition: all 0.3s ease;
  cursor: pointer;
  padding: 10px 0 30px;
}

.content-logo:hover {
  filter: drop-shadow(0 0 10px var(--accent-color));
}

.title-copy-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 1000;
}

.ratings-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 15px 0;
  flex-wrap: wrap;
}

.rating-link {
  display: inline-flex;
  align-items: center;
  color: #fff;
  text-decoration: none;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 5px;
  gap: 5px;
  transition: all 0.2s ease;
  vertical-align: middle;
}

.rating-link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.rating-logo {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.rating-value {
  font-weight: 500;
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
  margin: 15px 0 15px;
  text-align: left;
  color: #fff;
}

.info-content {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.movie-poster-container {
  flex-shrink: 0;
  width: 200px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.movie-poster-container:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px var(--accent-semi-transparent);
}

.movie-poster {
  width: 100%;
  height: auto;
  display: block;
}

.details-container {
  flex: 1;
  min-width: 0;
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
  margin-top: 20px;
}

.content-description-text {
  margin: 0;
  white-space: pre-wrap;
}

.movie-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.movie-skeleton__header {
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__title {
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__ratings {
  display: flex;
  gap: 1rem;
}

.movie-skeleton__rating-item {
  width: 80px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__player {
  height: 400px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__additional-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movie-skeleton__section-title {
  height: 20px;
  width: 150px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__info-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movie-skeleton__info-item {
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__description {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movie-skeleton__description-line {
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.movie-skeleton__description-line:nth-child(1) {
  width: 100%;
}

.movie-skeleton__description-line:nth-child(2) {
  width: 90%;
}

.movie-skeleton__description-line:nth-child(3) {
  width: 80%;
}

.movie-skeleton__description-line:nth-child(4) {
  width: 70%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .info-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .movie-poster-container {
    width: 100%;
    max-width: 200px;
    margin: 0;
  }

  .additional-info-title {
    font-size: 20px;
  }

  .ratings-links {
    justify-content: center;
  }

  .content-title {
    font-size: 35px;
  }

  .content-header {
    min-height: 60px;
  }
}
</style>
