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
        <PlayerComponent
          :key="kp_id"
          :kp-id="kp_id"
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
            <img :src="movieInfo.logo_url" alt="Логотип фильма" class="content-logo" />
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
          <MovieRating
            v-if="movieInfo.kinopoisk_id"
            :kp-id="movieInfo.kinopoisk_id"
            :show-dash="true"
          />

          <!-- Кинопоиск -->
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
              <span>{{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}</span>
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
              :title="
                movieInfo.rating_kinopoisk_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_kinopoisk_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span>{{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}</span>
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
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span>{{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}</span>
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
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span>{{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}</span>
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
          <div v-if="movieInfo.imdb_id" class="rating-links-group">
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
            <button
              class="rating-link nudity-info-btn"
              @click="showNudityInfo"
              :title="
                nudityInfo ? 'Скрыть информацию' : 'Показать информацию о сценах(Sex & Nudity)'
              "
            >
              <i v-if="!nudityInfoLoading" class="fa-regular fa-face-grin-wink"></i>
              <i v-else class="fas fa-spinner fa-spin"></i>
              <div v-if="nudityInfo" class="nudity-info-popup">
                <div class="nudity-info-content">
                  {{ nudityInfo }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Интеграция компонента плеера -->
        <PlayerComponent
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          @update:movie-info="fetchMovieInfo"
        />

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

        <div v-if="movieInfo.staff" class="staff-section">
          <div class="staff-categories">
            <div v-if="getStaffByProfession('ACTOR').length" class="staff-category">
              <h3 class="additional-info-title">Актёры</h3>
              <div class="staff-list">
                <div
                  v-for="person in getStaffByProfession('ACTOR').slice(0, 12)"
                  :key="person.staff_id"
                  class="staff-item"
                >
                  <a
                    :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="staff-link"
                    :title="person.description || ''"
                  >
                    <img :src="person.poster_url" :alt="person.name_ru" class="staff-photo" />
                    <span class="staff-name">{{ person.name_ru || person.name_en }}</span>
                    <span v-if="person.description" class="staff-role">{{
                      person.description
                    }}</span>
                  </a>
                </div>
                <a
                  class="expand-actors-circle-button"
                  :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="`Показать всех ${getStaffByProfession('ACTOR').length} актеров`"
                >
                  +{{ getStaffByProfession('ACTOR').length - 12 }}
                </a>
              </div>
            </div>

            <div v-if="getStaffByProfession('DIRECTOR').length" class="staff-category">
              <h3 class="additional-info-title">Режиссёры</h3>
              <div class="staff-names-list">
                <a
                  v-for="person in getStaffByProfession('DIRECTOR')"
                  :key="person.staff_id"
                  :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="staff-name-link"
                >
                  {{ person.name_ru || person.name_en }}
                </a>
              </div>
            </div>

            <div v-if="getStaffByProfession('PRODUCER').length" class="staff-category">
              <h3 class="additional-info-title">Продюсеры</h3>
              <div class="staff-names-list">
                <a
                  v-for="person in getStaffByProfession('PRODUCER')"
                  :key="person.staff_id"
                  :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="staff-name-link"
                >
                  {{ person.name_ru || person.name_en }}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div v-if="videos.length && areTrailersActive" class="yt-video-container">
          <TrailerCarousel
            :videos="videos"
            :active-video-index="activeTrailerIndex"
            @select="playTrailer"
          />
        </div>

        <!-- Секция с сиквелами и приквелами -->
        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <h2>Сиквелы и приквелы</h2>
          <MovieList
            :movies-list="
              showAllSequels ? sequelsAndPrequels : sequelsAndPrequels.slice(0, itemsPerRow)
            "
            :loading="false"
            :is-history="false"
          />
          <a
            v-if="sequelsAndPrequels.length > itemsPerRow"
            class="expand-circle-button"
            @click="showAllSequels = !showAllSequels"
            :title="`${showAllSequels ? 'Скрыть' : 'Показать все'} (${sequelsAndPrequels.length})`"
          >
            {{ showAllSequels ? '−' : `+${sequelsAndPrequels.length - itemsPerRow}` }}
          </a>
        </div>

        <!-- Секция с похожими фильмами -->
        <div v-if="similars.length" class="related-movies">
          <h2>Похожие</h2>
          <MovieList
            :movies-list="showAllSimilars ? similars : similars.slice(0, itemsPerRow)"
            :loading="false"
            :is-history="false"
          />
          <a
            v-if="similars.length > itemsPerRow"
            class="expand-circle-button"
            @click="showAllSimilars = !showAllSimilars"
            :title="`${showAllSimilars ? 'Скрыть' : 'Показать все'} (${similars.length})`"
          >
            {{ showAllSimilars ? '−' : `+${similars.length - itemsPerRow}` }}
          </a>
        </div>
      </div>
    </div>
  </div>
  <Notification ref="notificationRef" />
</template>

<script setup>
import { getKpInfo, getShikiInfo, getNudityInfoFromIMDB } from '@/api/movies'
import { handleApiError } from '@/constants'
import { addToList } from '@/api/user'
import { MovieList } from '@/components/MovieList/'
import PlayerComponent from '@/components/PlayerComponent.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
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
import MovieRating from '@/components/MovieRating.vue'

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
const activeTrailerIndex = ref(null)
const showAllSequels = ref(false)
const showAllSimilars = ref(false)

const itemsPerRow = ref(6)

const nudityInfo = ref(null)
const nudityInfoLoading = ref(false)

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

const formatRatingNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
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

const updateItemsPerRow = () => {
  const containerWidth = document.querySelector('.related-movies')?.clientWidth || 0
  const itemWidth = 240 + 20
  const newItemsPerRow = Math.floor(containerWidth / itemWidth) || 6
  itemsPerRow.value = Math.max(1, newItemsPerRow)
}

const onResize = () => {
  updateItemsPerRow()
}

const onKeyDown = (event) => {
  if (event.altKey && event.keyCode === 84) {
    const playerComponent = document.querySelector('.player-container')
    if (playerComponent) {
      const theaterModeBtn = document.querySelector('.theater-mode-btn')
      if (theaterModeBtn) {
        theaterModeBtn.click()
      }
    }
  }
}

const showNudityInfo = async () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Для просмотра информации необходимо <a class="auth-link">авторизоваться</a>',
      5000,
      { onClick: () => navbarStore.openLogin() }
    )
    return
  }

  if (!movieInfo.value?.imdb_id) return

  if (nudityInfo.value) {
    nudityInfo.value = null
    return
  }

  nudityInfoLoading.value = true
  try {
    const response = await getNudityInfoFromIMDB(movieInfo.value.imdb_id)
    nudityInfo.value = response.nudity_info
  } catch (error) {
    console.error('Ошибка при загрузке информации о сценах:', error)
    notificationRef.value.showNotification('Ошибка при загрузке информации о сценах')
  } finally {
    nudityInfoLoading.value = false
  }
}

onMounted(async () => {
  await fetchMovieInfo()
  infoLoading.value = false
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)
  setTimeout(updateItemsPerRow, 100)
})

onUnmounted(async () => {
  navbarStore.clearHeaderContent()
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      navbarStore.clearHeaderContent()
      kp_id.value = newKpId
      activeTrailerIndex.value = null
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

const getStaffByProfession = (profession) => {
  return movieInfo.value?.staff?.filter((person) => person.profession_key === profession) || []
}
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
  flex-wrap: wrap;
  height: auto;
  min-height: 80px;
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
  white-space: normal;
  width: 100%;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
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
  margin: 15px 0 15px;
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
  position: relative;
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

.movie-skeleton {
  padding: 0 20px 20px;
  color: #e0e0e0;
}

.movie-skeleton__header {
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.movie-skeleton__logo {
  width: 200px;
  height: 80px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__title {
  width: 30%;
  height: 40px;
  background: linear-gradient(
    90deg,
    rgba(40, 40, 40, 0.8) 0%,
    rgba(60, 60, 60, 0.8) 50%,
    rgba(40, 40, 40, 0.8) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 12px;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

.movie-skeleton__title::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 100%
  );
  animation: shine 1.5s infinite;
}

@keyframes shine {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.movie-skeleton__ratings {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 15px 0;
}

.movie-skeleton__rating-item {
  width: 120px;
  height: 30px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__player {
  width: 60%;
  height: 500px;
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 12px;
  margin: 20px auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.movie-skeleton__player::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.movie-skeleton__additional-info {
  margin: 20px 0;
}

.movie-skeleton__section-title {
  width: 150px;
  height: 24px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
  margin-bottom: 15px;
}

.movie-skeleton__info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.movie-skeleton__info-item {
  width: 100%;
  height: 20px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__description {
  margin: 20px 0;
}

.movie-skeleton__description-line {
  width: 100%;
  height: 16px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
  margin-bottom: 10px;
}

.movie-skeleton__description-line:nth-child(2) {
  width: 90%;
}

.movie-skeleton__description-line:nth-child(3) {
  width: 95%;
}

.movie-skeleton__description-line:nth-child(4) {
  width: 85%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 600px) {
  .movie-skeleton {
    padding: 10px;
  }

  .movie-skeleton__header {
    height: 60px;
  }

  .movie-skeleton__logo {
    width: 150px;
    height: 60px;
  }

  .movie-skeleton__title {
    width: 70%;
    height: 30px;
  }

  .movie-skeleton__player {
    height: 250px;
  }

  .movie-skeleton__rating-item {
    width: 80px;
    height: 25px;
  }

  .movie-skeleton__control-btn {
    width: 40px;
    height: 40px;
  }
}

.staff-section {
  border-radius: 8px;
}

.staff-categories {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.staff-category h3 {
  color: #fff;
  margin-bottom: 10px;
  font-size: 18px;
}

.staff-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  align-items: start;
  margin-bottom: 10px;
}

.staff-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  height: 100%;
}

.staff-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s;
  height: 100%;
}

.staff-link:hover {
  transform: translateY(-3px);
}

.staff-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.staff-name {
  font-size: 14px;
  color: #fff;
  margin-bottom: 4px;
  min-height: 2.8em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
}

.staff-role {
  font-size: 12px;
  color: #aaa;
  min-height: 1.8em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
}

@media (max-width: 600px) {
  .staff-list {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .staff-photo {
    width: 60px;
    height: 60px;
  }

  .staff-name {
    font-size: 12px;
    min-height: 2.4em;
  }

  .staff-role {
    font-size: 10px;
    min-height: 1.6em;
  }
}

.show-all-link {
  display: inline-block;
  color: #aaa;
  text-decoration: none;
  margin-top: 10px;
  cursor: pointer;
  transition: color 0.2s;
}

.show-all-link:hover {
  color: #fff;
  text-decoration: underline;
}
.expand-actors-circle-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 auto;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 24px;
  text-decoration: none;
}

.expand-circle-button {
  position: absolute;
  top: 0;
  right: 15px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 20px;
  text-decoration: none;
}

.expand-circle-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

@media (max-width: 600px) {
  .expand-circle-button {
    width: 35px;
    height: 35px;
    font-size: 16px;
  }
}

.show-more-btn {
  display: block;
  margin: 15px auto;
  padding: 8px 16px;
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #505050;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.show-more-btn:hover {
  background: #505050;
  border-color: #17850b;
}

.show-more-btn:active {
  background: #17850b;
  border-color: #17850b;
}

.rating-links-group {
  display: flex;
  gap: 10px;
}

.nudity-info-btn {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  display: flex;
  align-items: center;
  gap: 5px;
}

.nudity-info-btn i {
  font-size: 20px;
  color: #fff;
}

.nudity-info-btn .fa-spinner {
  color: #fff;
}

.nudity-info-popup {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  min-width: 300px;
  max-width: 500px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.nudity-info-content {
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

@media (max-width: 600px) {
  .nudity-info-popup {
    min-width: 250px;
    max-width: 90vw;
  }
}

.staff-names-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.staff-name-link {
  color: #fff;
  text-decoration: none;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.staff-name-link:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

@media (max-width: 600px) {
  .staff-names-list {
    gap: 8px;
  }

  .staff-name-link {
    font-size: 14px;
    padding: 4px 8px;
  }
}
</style>
