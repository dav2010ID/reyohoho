<template>
  <div class="movie-info">
    <div class="content">
      <div v-if="contentLoading && !errorMessage" class="content-card">
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

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" show-retry @retry="fetchMovieInfo()" />

      <div v-if="errorMessage && clientReady && !movieInfo" class="content-card">
        <component
          :is="moviePlayerComponent"
          v-if="clientReady && moviePlayerComponent"
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          @toggle-list="toggleList"
        />
      </div>

      <div v-if="movieInfo && !contentLoading" class="content-card">
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
          <component
            :is="movieRatingComponent"
            v-if="clientReady && ratingsAvailable && movieInfo.kinopoisk_id"
            :key="movieInfo.kinopoisk_id"
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
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
                width="48"
                height="48"
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
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
                width="48"
                height="48"
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
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
                width="48"
                height="48"
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
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
                width="48"
                height="48"
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
              <span
                v-if="movieInfo.rating_shikimori"
                class="rating-value"
                :class="getRatingColor(movieInfo.rating_shikimori)"
              >
                {{ movieInfo.rating_shikimori }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
                width="48"
                height="48"
              />
            </a>
          </div>

          <span v-if="backendAvailable" class="action-buttons-group">
            <template v-if="movieInfo.imdb_id">
              <button
                class="nudity-info-btn parents-guide-btn"
                :title="
                  scenePanel === 'guide'
                    ? 'Скрыть информацию'
                    : 'Показать Parents Guide и информацию о сценах'
                "
                @click="toggleScenePanel('guide', $event)"
                @mousedown.middle.prevent="toggleScenePanel('guide', $event)"
              >
                <span class="desktop-text">Parents Guide</span>
                <span class="mobile-text">PG</span>
                <i v-if="!sceneGuideLoading" class="fa-regular fa-face-grin-wink"></i>
                <i v-else class="fas fa-spinner fa-spin"></i>
              </button>
            </template>
            <button
              class="nudity-info-btn"
              :title="
                scenePanel === 'timings'
                  ? 'Скрыть тайминги'
                  : 'Показать тайминги сцен 18+(для твича, мигание отключается в настройках)'
              "
              @click="toggleScenePanel('timings', $event)"
            >
              <i
                class="fa-regular fa-clock"
                :class="{
                  'text-red': shouldShowRedTimings,
                  'text-red-blink': shouldBlinkRedTimings
                }"
              ></i>
              <span class="mobile-text">Тайминги</span>
            </button>
            <button
              v-if="notesAvailable"
              class="nudity-info-btn note-btn"
              :class="{ 'has-note': movieNote }"
              :title="movieNote ? 'Редактировать заметку' : 'Добавить заметку'"
              @click="toggleNoteEditor"
            >
              <i class="fa-regular fa-note-sticky"></i>
              <span class="mobile-text">Заметка</span>
            </button>
          </span>
        </div>

        <!-- Интеграция компонента плеера -->
        <component
          :is="moviePlayerComponent"
          v-if="clientReady && moviePlayerComponent"
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          @toggle-list="toggleList"
        />

        <MovieMobileListDropdown
          v-if="mainStore.isMobile"
          :movie-info="movieInfo"
          :is-in-any-list="isInAnyList"
          :expanded="isListExpanded"
          @update:expanded="isListExpanded = $event"
          @toggle-list="toggleList"
        />

        <div id="movie-details" class="additional-info">
          <div class="mobile-movie-summary">
            <h2 class="mobile-movie-title">{{ movieInfo.title }}</h2>
            <div class="mobile-movie-chips">
              <span v-for="chip in mobileSummaryChips" :key="chip" class="mobile-summary-chip">
                {{ chip }}
              </span>
              <span
                v-if="movieInfo.rating_age_limits"
                :class="['mobile-age-chip', getAgeRatingClass(movieInfo.rating_age_limits)]"
              >
                {{ getAgeRatingLabel(movieInfo.rating_age_limits) }}
              </span>
            </div>
          </div>
          <div class="info-content">
            <div v-if="moviePosterUrl" class="movie-poster-container desktop-only">
              <a
                :href="movieInfo.poster_url || moviePosterUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <picture>
                  <source
                    media="(min-width: 769px)"
                    :srcset="moviePosterSources.srcset || moviePosterUrl"
                    sizes="(max-width: 2129px) max(250px, 15.5vw), 330px"
                  />
                  <img
                    src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                    width="300"
                    height="450"
                    loading="lazy"
                    decoding="async"
                    alt="Постер фильма"
                    class="movie-poster"
                    @error="setImageFallback"
                  />
                </picture>
              </a>
            </div>
            <div class="details-container">
              <ul class="info-list">
                <li v-if="movieInfo.type && TYPES_ENUM[movieInfo.type]" class="info-row-type">
                  <strong>Тип:</strong>
                  <span class="info-value">{{ TYPES_ENUM[movieInfo.type] }}</span>
                </li>
                <li v-if="movieInfo.year" class="info-row-year">
                  <strong>Год выпуска:</strong>
                  <span class="info-value">{{ movieInfo.year }}</span>
                </li>
                <li v-if="movieInfo.title" class="info-row-title">
                  <strong>Название:</strong>
                  <span class="info-value">{{ movieInfo.title }}</span>
                </li>
                <li v-if="movieInfo.name_original">
                  <strong>Оригинальное название:</strong>
                  <span class="info-value">{{ movieInfo.name_original }}</span>
                </li>
                <li v-if="movieInfo.slogan">
                  <strong>Слоган:</strong>
                  <span class="info-value">{{ movieInfo.slogan }}</span>
                </li>
                <li v-if="movieInfo.production_companies">
                  <strong>Продакшн:</strong>
                  <span class="info-value">{{ movieInfo.production_companies }}</span>
                </li>
                <li v-if="movieInfo.countries?.length" class="info-row-countries">
                  <strong>Страна производства:</strong>
                  <span class="info-value">{{ countryNames.join(', ') }}</span>
                </li>
                <li v-if="movieInfo.genres?.length" class="info-row-genres">
                  <strong>Жанры:</strong>
                  <span class="info-value desktop-genres-text">{{ genreNames.join(', ') }}</span>
                  <div class="mobile-genre-chips">
                    <span v-for="genre in genreNames" :key="genre" class="mobile-genre-chip">
                      {{ genre }}
                    </span>
                  </div>
                </li>
                <li v-if="formattedDuration">
                  <strong>{{ movieInfo.serial ? 'Время серии:' : 'Продолжительность:' }}</strong>
                  <span class="info-value">{{ formattedDuration }}</span>
                </li>
                <li v-if="movieInfo.seasons_count">
                  <strong>Сезонов:</strong>
                  <span class="info-value">{{ movieInfo.seasons_count }}</span>
                </li>
                <li v-if="movieInfo.episodes_count">
                  <strong>Эпизодов:</strong>
                  <span class="info-value">{{ movieInfo.episodes_count }}</span>
                </li>
                <li v-if="productionStatusLabel">
                  <strong>Статус:</strong>
                  <span class="info-value">{{ productionStatusLabel }}</span>
                </li>
                <li
                  v-if="movieInfo.rating_mpaa || movieInfo.rating_age_limits"
                  :class="['rating-boxes', getAgeRatingClass(movieInfo.rating_age_limits)]"
                >
                  <strong>Возраст:</strong>
                  <div class="rating-boxes-values">
                    <div v-if="movieInfo.rating_mpaa" class="rating-box mpaa">
                      <strong>MPAA</strong>
                      <span>{{ movieInfo.rating_mpaa.toUpperCase() }}</span>
                    </div>
                    <div
                      v-if="movieInfo.rating_age_limits"
                      :class="['rating-box age', getAgeRatingClass(movieInfo.rating_age_limits)]"
                    >
                      <strong>{{ movieInfo.rating_age_limits.replace('age', '') }}+</strong>
                    </div>
                  </div>
                </li>
              </ul>
              <div v-if="movieInfo.description" class="content-info info-description-row">
                <strong>Описание:</strong>
                <div class="content-description">
                  <p class="content-description-text">
                    {{ visibleDescription
                    }}<span v-if="shouldCollapseDescription && !isDescriptionExpanded">...</span>
                  </p>
                  <button
                    v-if="shouldCollapseDescription"
                    type="button"
                    class="description-toggle"
                    @click="isDescriptionExpanded = !isDescriptionExpanded"
                  >
                    {{ isDescriptionExpanded ? 'Свернуть' : 'Показать полностью' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <div class="related-movies-header">
            <h2>Сиквелы и приквелы</h2>
          </div>
          <MovieList
            :movies-list="sequelsAndPrequels"
            :loading="false"
            :is-history="false"
            variant="related"
            class="related-movies-list"
          />
        </div>

        <div v-if="similars.length" class="related-movies">
          <div class="related-movies-header">
            <h2>Похожие</h2>
          </div>
          <MovieList
            :movies-list="similars"
            :loading="false"
            :is-history="false"
            variant="related"
            class="related-movies-list"
          />
        </div>

        <div v-if="movieNote && notesAvailable" class="movie-note-display">
          <div class="movie-note-header">
            <div class="movie-note-title">
              <i class="fa-solid fa-note-sticky"></i>
              <h3>Моя заметка</h3>
            </div>
            <div class="movie-note-actions">
              <button class="note-edit-btn" title="Редактировать" @click="toggleNoteEditor">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>
          <div class="movie-note-content">
            {{ movieNote.note_text }}
          </div>
          <div class="movie-note-footer">
            <span class="note-date">
              <i class="far fa-calendar"></i>
              Обновлено:
              {{
                new Date(movieNote.updated_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }}
            </span>
          </div>
        </div>

        <div v-if="clientReady && isCommentsEnabled" id="movie-comments" class="comments-section">
          <DeferredComments :key="kp_id" :movie-id="kp_id" />
        </div>

        <Teleport defer to="#movie-staff-end">
          <div v-if="movieInfo.staff" id="movie-staff" class="staff-section">
            <div class="staff-categories">
              <div v-if="actors.length" class="staff-category">
                <h3 class="additional-info-title">Актёры</h3>
                <div class="staff-list">
                  <div
                    v-for="person in actors.slice(0, 12)"
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
                    v-if="actors.length > 12"
                    class="expand-actors-circle-button"
                    :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="`Показать всех ${actors.length} актеров`"
                  >
                    +{{ actors.length - 12 }}
                  </a>
                </div>
              </div>

              <div v-for="group in staffNameGroups" :key="group.key" class="staff-category">
                <h3 class="additional-info-title">{{ group.title }}</h3>
                <div class="staff-names-container">
                  <div class="staff-names-list">
                    <a
                      v-for="person in group.people.slice(0, 5)"
                      :key="person.staff_id"
                      :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="staff-name-link"
                    >
                      {{ person.name_ru || person.name_en }}
                    </a>
                    <a
                      v-if="group.people.length > 5"
                      class="expand-actors-circle-button"
                      :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="`Показать всех ${group.people.length} ${group.label}`"
                    >
                      +{{ group.people.length - 5 }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Teleport>

        <div v-if="videos.length && areTrailersActive" class="yt-video-container">
          <TrailerCarousel :videos="videos" :active-video-index="activeTrailerIndex" />
        </div>

        <div id="movie-staff-end"></div>
      </div>
    </div>
  </div>
  <Notification ref="notificationRef" />
  <component
    :is="sceneToolsComponent"
    v-if="backendAvailable && sceneToolsComponent && sceneToolsUsed"
    :key="kp_id"
    :movie-id="kp_id"
    :movie-info="movieInfo"
    :mode="scenePanel"
    :trigger="scenePanelTrigger"
    :notify="notify"
    :refresh-movie="refreshMovieTimings"
    @close="scenePanel = null"
    @guide-loading="guideLoading = $event"
    @overlay-selection="syncOverlaySelection"
  />

  <MovieNoteModal
    v-if="notesAvailable && showNoteEditor"
    v-model="noteText"
    :movie-note="movieNote"
    :is-saving="isSavingNote"
    :is-deleting="isDeletingNote"
    @close="cancelNoteEdit"
    @save="handleSaveNote"
    @delete="handleDeleteNote"
  />
</template>

<script setup>
import { getKpInfo, getShikiInfo, getMovieNote, saveMovieNote, deleteMovieNote } from '@/api/movies'
import { legacyBackendAvailable } from '@/api/backendConfig'
import { legacyMovieMethodAvailable } from '@/api/movieCapabilities'
import { handleApiError } from '@/constants'
import { addToList } from '@/api/user'
import { usePlayerLists } from '@/composables/usePlayerLists'
import { cardRatings } from '../../migration/history-transfer/history-data.js'
import { MovieList } from '@/components/MovieList/'
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import { TYPES_ENUM, USER_LIST_TYPES_ENUM } from '@/constants'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { useNavbarStore } from '@/store/navbar'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import Notification from '@/components/notification/ToastMessage.vue'
import { useTrailerStore } from '@/store/trailer'
import DeferredComments from '@/components/DeferredComments.vue'
import { getRatingColor } from '@/utils/ratingUtils'
import { buildMovieSeo, getMovieSeoEntry, getMovieSeoPath, getMovieSeoSlug } from '@/utils/movieSeo'
import {
  optimizePosterUrl,
  resolvePosterByMovie,
  resolvePosterSourcesByMovie,
  setImageFallback
} from '@/utils/mediaUtils'
import { formatProductionStatus } from '@/utils/movieStatus'
import { formatMovieDuration } from '@/utils/movieDuration'
import { isRequestCanceled } from '@/utils/requestCancellation'

const TrailerCarousel = defineAsyncComponent(() => import('@/components/TrailerCarousel.vue'))
const MovieMobileListDropdown = defineAsyncComponent(
  () => import('@/components/movie/MovieMobileListDropdown.vue')
)
const MovieNoteModal = defineAsyncComponent(() => import('@/components/movie/MovieNoteModal.vue'))

const mainStore = useMainStore()
const authStore = useAuthStore()
const backgroundStore = useBackgroundStore()
const route = useRoute()
const router = useRouter()
const kp_id = ref(route.params.kp_id)
const errorMessage = ref('')
const errorCode = ref(null)
const moviePlayerComponent = shallowRef(null)
const movieRatingComponent = defineAsyncComponent(() => import('@/components/MovieRating.vue'))
const backendAvailable = computed(legacyBackendAvailable)
const ratingsAvailable = computed(() => legacyMovieMethodAvailable('getRating'))
const notesAvailable = computed(() => backendAvailable.value && authStore.token && !authStore.isWorkerSession)
const getCatalogMovie = (id) => {
  const entry = getMovieSeoEntry(id)
  return entry
    ? {
        kp_id: entry.kp_id,
        kinopoisk_id: entry.kp_id,
        title: entry.title,
        name_ru: entry.title,
        year: entry.year,
        description: entry.description,
        poster_url: entry.poster
      }
    : null
}
const movieInfo = ref(getCatalogMovie(kp_id.value))
const infoLoading = ref(!movieInfo.value)
const navbarStore = useNavbarStore()
const trailerStore = useTrailerStore()
const notificationRef = ref(null)
const clientReady = ref(false)
// Data and component chunks load in parallel. Do not render a collapsed card
// between their completion: inserting the player would push the details down.
const contentLoading = computed(
  () => infoLoading.value || !movieInfo.value || (clientReady.value && !moviePlayerComponent.value)
)
const DESCRIPTION_PREVIEW_LIMIT = 500

const areTrailersActive = computed(() => trailerStore.areTrailersActive)
const activeTrailerIndex = ref(null)

const sceneToolsComponent = shallowRef(null)
const sceneToolsUsed = ref(false)
const scenePanel = ref(null)
const scenePanelTrigger = shallowRef(null)
const sceneToolsLoading = ref(false)
const guideLoading = ref(false)
const sceneGuideLoading = computed(
  () => scenePanel.value === 'guide' && (sceneToolsLoading.value || guideLoading.value)
)
let sceneToolsPromise = null
let active = true

const notify = (...args) => notificationRef.value?.showNotification(...args)

async function toggleScenePanel(mode, event) {
  scenePanel.value = scenePanel.value === mode ? null : mode
  scenePanelTrigger.value = event.currentTarget
  if (!scenePanel.value) return
  sceneToolsUsed.value = true
  if (sceneToolsComponent.value) return
  if (!sceneToolsPromise) {
    sceneToolsLoading.value = true
    sceneToolsPromise = import('@/components/movie/MovieSceneTools.vue')
      .then((module) => {
        if (active) sceneToolsComponent.value = module.default
      })
      .catch(() => {
        if (!active) return
        scenePanel.value = null
        notify('Не удалось загрузить панель. Попробуйте ещё раз.')
      })
      .finally(() => {
        sceneToolsPromise = null
        if (active) sceneToolsLoading.value = false
      })
  }
  await sceneToolsPromise
}

const syncOverlaySelection = (ids) => {
  window.overlayNudityTimings = ids
}
const refreshMovieTimings = () => fetchMovieInfo(false)

const isListExpanded = ref(false)

const movieNote = ref(null)
const showNoteEditor = ref(false)
const noteText = ref('')
const isSavingNote = ref(false)
const isDeletingNote = ref(false)
const moviePosterSources = computed(() => resolvePosterSourcesByMovie(movieInfo.value || {}))
const moviePosterUrl = computed(() => moviePosterSources.value.src)

const shouldShowRedTimings = computed(() => {
  return Array.isArray(movieInfo.value?.nudity_timings) && movieInfo.value.nudity_timings.length > 0
})

const shouldBlinkRedTimings = computed(
  () => shouldShowRedTimings.value && mainStore.isStreamerMode && !mainStore.isMobile
)

const isInAnyList = computed(() => {
  return (
    movieInfo.value?.lists?.isFavorite ||
    movieInfo.value?.lists?.isWatching ||
    movieInfo.value?.lists?.isLater ||
    movieInfo.value?.lists?.isCompleted ||
    movieInfo.value?.lists?.isAbandoned
  )
})

const isCommentsEnabled = computed(() => backendAvailable.value && mainStore.isCommentsEnabled)
const isDescriptionExpanded = ref(false)
const countryNames = computed(() =>
  (movieInfo.value?.countries || []).map((item) => item.country).filter(Boolean)
)
const genreNames = computed(() =>
  (movieInfo.value?.genres || []).map((item) => item.genre).filter(Boolean)
)
const productionStatusLabel = computed(() =>
  formatProductionStatus(movieInfo.value?.production_status)
)
const formattedDuration = computed(() => formatMovieDuration(movieInfo.value?.film_length))
const mobileSummaryChips = computed(() => {
  const chips = []
  const typeLabel = movieInfo.value?.type ? TYPES_ENUM[movieInfo.value.type] : ''

  if (movieInfo.value?.year) chips.push(String(movieInfo.value.year))
  if (typeLabel) chips.push(typeLabel)
  if (countryNames.value[0]) chips.push(countryNames.value[0])
  if (genreNames.value[0]) chips.push(genreNames.value[0])

  return chips
})
const normalizedDescription = computed(() => movieInfo.value?.description?.trim() || '')
const shouldCollapseDescription = computed(
  () => normalizedDescription.value.length > DESCRIPTION_PREVIEW_LIMIT
)
const visibleDescription = computed(() => {
  if (!shouldCollapseDescription.value || isDescriptionExpanded.value) {
    return normalizedDescription.value
  }

  return normalizedDescription.value.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()
})

watch(normalizedDescription, () => {
  isDescriptionExpanded.value = false
})

const syncCanonicalMovieRoute = async () => {
  if (kp_id.value.startsWith('shiki') || !movieInfo.value) {
    return
  }

  const canonicalPath = getMovieSeoPath(movieInfo.value, kp_id.value)
  const targetLocation = {
    path: canonicalPath,
    query: route.query,
    hash: route.hash
  }

  const resolvedTarget = router.resolve(targetLocation)

  if (typeof window !== 'undefined') {
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (currentUrl !== resolvedTarget.href) {
      await router.replace(targetLocation)
    }
  }
}

const seoMeta = computed(() => buildMovieSeo(movieInfo.value || {}, kp_id.value))

useHead(() => {
  const seo = seoMeta.value
  const titleBase =
    movieInfo.value?.title || movieInfo.value?.name_ru || movieInfo.value?.name_original || ''

  return {
    title: seo.title,
    link: [
      {
        rel: 'canonical',
        href: seo.canonicalUrl
      }
    ],
    meta: [
      {
        name: 'description',
        content: seo.description
      },
      {
        property: 'og:type',
        content: seo.type
      },
      {
        property: 'og:title',
        content: seo.title
      },
      {
        property: 'og:description',
        content: seo.description
      },
      {
        property: 'og:url',
        content: seo.canonicalUrl
      },
      {
        property: 'og:image',
        content: seo.poster
      },
      {
        name: 'twitter:card',
        content: seo.poster ? 'summary_large_image' : 'summary'
      },
      {
        name: 'twitter:title',
        content: seo.title
      },
      {
        name: 'twitter:description',
        content: seo.description
      },
      {
        name: 'twitter:image',
        content: seo.poster
      }
    ].filter((entry) => entry.content),
    script: titleBase
      ? [
          {
            type: 'application/ld+json',
            textContent: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Movie',
              name: titleBase,
              description: seo.description,
              image: seo.poster || undefined,
              datePublished: movieInfo.value?.year || undefined,
              url: seo.canonicalUrl
            })
          }
        ]
      : []
  }
})

const formatRatingNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

const transformMoviesData = (movies) => {
  return (movies || []).map((movie) => ({
    kp_id: movie.film_id,
    poster: resolvePosterByMovie(movie),
    title: movie.name_ru || movie.name_en || movie.name_original
  }))
}

const getAgeRatingClass = (ratingAgeLimits) => {
  const age = Number(String(ratingAgeLimits || '').replace(/\D/g, ''))

  if (!age) {
    return 'age-rating-neutral'
  }

  if (age <= 6) {
    return 'age-rating-soft'
  }

  if (age <= 12) {
    return 'age-rating-caution'
  }

  if (age <= 16) {
    return 'age-rating-mature'
  }

  return 'age-rating-adult'
}

const getAgeRatingLabel = (ratingAgeLimits) => {
  const age = String(ratingAgeLimits || '').replace(/\D/g, '')
  return age ? `${age}+` : String(ratingAgeLimits || '')
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

const copyMovieMeta = async () => {
  try {
    const movieMeta = [
      movieInfo.value.name_ru || movieInfo.value.name_en || movieInfo.value.name_original,
      ...(movieInfo.value.year ? [movieInfo.value.year] : []),
      ...(formattedDuration.value ? [formattedDuration.value] : [])
    ]
    await navigator.clipboard.writeText(movieMeta.join(', '))
    notificationRef.value.showNotification('Скопировано')
  } catch (err) {
    console.error('Ошибка копирования:', err)
  }
}

let movieInfoRequestController = null

const fetchMovieInfo = async (updateHistory = true) => {
  movieInfoRequestController?.abort()
  const controller = new AbortController()
  movieInfoRequestController = controller
  errorMessage.value = ''
  errorCode.value = null
  const requestedKpId = kp_id.value
  if (updateHistory || !movieInfo.value) infoLoading.value = true

  try {
    let response
    if (requestedKpId.startsWith('shiki')) {
      response = await getShikiInfo(requestedKpId, { signal: controller.signal })
    } else {
      response = await getKpInfo(requestedKpId, { signal: controller.signal })
    }

    if (controller.signal.aborted || requestedKpId !== kp_id.value) return false

    if (!response || (Array.isArray(response) && response.length === 0)) {
      throw new Error('Данные не найдены. Пожалуйста, повторите поиск.')
    }

    movieInfo.value = response

    if (requestedKpId.startsWith('shiki')) {
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
        kinopoisk_id: requestedKpId
      }
    }

    if (notesAvailable.value) {
      loadMovieNote()
    }

    navbarStore.setHeaderContent({
      text: movieInfo.value.title,
      imageUrl: movieInfo.value.logo_url
    })

    await syncCanonicalMovieRoute()
    if (controller.signal.aborted || requestedKpId !== kp_id.value) return false

    const movieToSave = {
      ...cardRatings(movieInfo.value),
      ratings_checked: 1,
      kp_id: requestedKpId,
      title: movieInfo.value?.name_ru || movieInfo.value?.name_en || movieInfo.value?.name_original,
      slug: getMovieSeoSlug(movieInfo.value, requestedKpId),
      poster:
        optimizePosterUrl(movieInfo.value?.poster_url) ||
        optimizePosterUrl(movieInfo.value?.cover_url) ||
        optimizePosterUrl(movieInfo.value?.screenshots?.[0]),
      year: movieInfo.value?.year,
      type: movieInfo.value?.type
    }

    // Устанавливаем фон фильма через новый метод
    if (requestedKpId.startsWith('shiki')) {
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

    if (mainStore.isHistoryAllowed && movieToSave.kp_id && movieToSave.title && updateHistory) {
      if (authStore.token) {
        mainStore.addToHistory({ ...movieToSave })
        const historyToken = authStore.token
        const historyMovie = movieInfo.value
        void (async () => {
          try {
            await addToList(movieToSave.kp_id, USER_LIST_TYPES_ENUM.HISTORY, historyMovie)
            if (
              !controller.signal.aborted &&
              requestedKpId === kp_id.value &&
              authStore.token === historyToken &&
              movieInfo.value === historyMovie
            ) {
              await loadStatus()
            }
            if (
              !controller.signal.aborted &&
              requestedKpId === kp_id.value &&
              authStore.token === historyToken &&
              movieInfo.value === historyMovie
            ) {
              movieInfo.value.lists = { ...movieInfo.value.lists, isHistory: true }
            }
          } catch (error) {
            console.error('Ошибка при добавлении в историю:', error)
          }
        })()
      } else {
        mainStore.addToHistory({ ...movieToSave })
      }
    }
    return true
  } catch (error) {
    if (controller.signal.aborted || requestedKpId !== kp_id.value || isRequestCanceled(error)) return false
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при загрузке информации о фильмах:', error)
    return false
  } finally {
    if (movieInfoRequestController === controller) {
      movieInfoRequestController = null
      infoLoading.value = false
    }
  }
}

const videos = computed(() => {
  return movieInfo.value?.videos || []
})

const sequelsAndPrequels = computed(() =>
  transformMoviesData(movieInfo.value?.sequels_and_prequels)
)

const similars = computed(() => transformMoviesData(movieInfo.value?.similars))

const staffByProfession = computed(() => {
  const groups = {}
  for (const person of movieInfo.value?.staff || []) {
    ;(groups[person.profession_key] ||= []).push(person)
  }
  return groups
})
const actors = computed(() => staffByProfession.value.ACTOR || [])
const staffNameGroups = computed(() =>
  [
    { key: 'DIRECTOR', title: 'Режиссёры', label: 'режиссёров' },
    { key: 'PRODUCER', title: 'Продюсеры', label: 'продюсеров' }
  ]
    .map((group) => ({ ...group, people: staffByProfession.value[group.key] || [] }))
    .filter((group) => group.people.length)
)

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

const { toggleList, loadStatus } = usePlayerLists({
  authStore,
  kpId: kp_id,
  movieInfo,
  notificationRef,
  openLogin: () => router.push('/login'),
  onChanged: () => {
    isListExpanded.value = false
  }
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const dropdown = document.querySelector('.mobile-list-dropdown')
  if (dropdown && !dropdown.contains(event.target)) {
    isListExpanded.value = false
  }
}

onMounted(async () => {
  clientReady.value = true
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('click', handleClickOutside)
  window.selectedNudityTimings = []
  window.overlayNudityTimings = []
  const movieInfoPromise = fetchMovieInfo()
  const playerModule = await import('@/components/PlayerComponent.vue')
  if (!active) return
  moviePlayerComponent.value = playerModule.default
  await movieInfoPromise
})

onUnmounted(() => {
  active = false
  movieInfoRequestController?.abort()
  movieInfoRequestController = null
  navbarStore.clearHeaderContent()
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('click', handleClickOutside)
  delete window.selectedNudityTimings
  delete window.overlayNudityTimings
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      navbarStore.clearHeaderContent()
      scenePanel.value = null
      scenePanelTrigger.value = null
      sceneToolsUsed.value = false
      guideLoading.value = false
      window.selectedNudityTimings = []
      window.overlayNudityTimings = []
      kp_id.value = newKpId
      movieInfo.value = getCatalogMovie(newKpId)
      activeTrailerIndex.value = null
      await fetchMovieInfo()
    }
  },
  { immediate: true }
)

const loadMovieNote = async () => {
  if (!authStore.isAuthenticated || !kp_id.value) return

  try {
    const response = await getMovieNote(kp_id.value)
    movieNote.value = response.note
    if (movieNote.value) {
      noteText.value = movieNote.value.note_text
    } else {
      noteText.value = ''
    }
  } catch {
    movieNote.value = null
    noteText.value = ''
  }
}

const toggleNoteEditor = () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a> для создания заметок',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }
  showNoteEditor.value = !showNoteEditor.value
}

const handleSaveNote = async () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a>',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }

  if (!noteText.value.trim()) {
    notificationRef.value.showNotification('Заметка не может быть пустой')
    return
  }

  if (noteText.value.length > 10000) {
    notificationRef.value.showNotification('Заметка слишком длинная (максимум 10000 символов)')
    return
  }

  try {
    isSavingNote.value = true
    const response = await saveMovieNote(kp_id.value, noteText.value)
    movieNote.value = response.note
    noteText.value = response.note.note_text
    notificationRef.value.showNotification('Заметка сохранена')
    showNoteEditor.value = false
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isSavingNote.value = false
  }
}

const handleDeleteNote = async () => {
  if (!authStore.token) {
    return
  }

  if (!confirm('Вы уверены, что хотите удалить заметку?')) {
    return
  }

  try {
    isDeletingNote.value = true
    await deleteMovieNote(kp_id.value)
    movieNote.value = null
    noteText.value = ''
    showNoteEditor.value = false
    notificationRef.value.showNotification('Заметка удалена')
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isDeletingNote.value = false
  }
}

const cancelNoteEdit = () => {
  if (movieNote.value) {
    noteText.value = movieNote.value.note_text
  } else {
    noteText.value = ''
  }
  showNoteEditor.value = false
}
</script>

<style scoped>
.content {
  min-height: 100vh;
  position: relative;
  --movie-page-max-width: none;
  --movie-page-gutter: 24px;
}
/* Стили для информации о фильме */
.content-card {
  overflow: hidden;
  padding: 18px var(--movie-page-gutter) 28px;
  color: #e0e0e0;
}

.content-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-wrap: wrap;
  height: auto;
  min-height: 70px;
  margin: 0 auto;
  max-width: var(--movie-page-max-width);
}

.content-logo {
  max-height: 80px;
  height: 80px;
  width: auto;
  object-fit: contain;
  max-width: 100%;
  transition: all 0.3s ease;
  cursor: pointer;
  padding: 4px 0 16px;
}

.content-logo:hover {
  filter: drop-shadow(0 0 10px var(--accent-color));
}

.content-title-container {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
  justify-content: center;
}

.movie-poster-thumbnail {
  width: 60px;
  height: 90px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.movie-poster-thumbnail:hover {
  transform: scale(1.05);
}

.movie-poster-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.content-title {
  font-size: clamp(38px, 4.2vw, 58px);
  margin: 0;
  line-height: 1.05;
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
  transition: all 0.3s ease;
  cursor: pointer;
}

.content-title:hover {
  text-shadow: 0 0 20px var(--accent-color);
  color: var(--accent-color);
}

.content-subtitle {
  font-size: 20px;
  color: #bbb;
}

.ratings-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  margin: 8px auto 24px;
  max-width: var(--movie-page-max-width);
}

.content-card :deep(.players-list) {
  max-width: var(--movie-page-max-width) !important;
}

.action-buttons-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  opacity: 0.86;
}

.action-buttons-group .mobile-text {
  display: none;
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

.external-link-icon {
  width: 20px;
  height: auto;
  margin-left: 5px;
}

.additional-info {
  box-sizing: border-box;
  max-width: var(--movie-page-max-width);
  margin: 22px auto 14px;
  padding: 32px 34px 26px;
  border-radius: 20px;
  background:
    radial-gradient(
      circle at 0% 0%,
      color-mix(in srgb, var(--accent-color) 11%, transparent),
      transparent 30%
    ),
    radial-gradient(
      circle at 100% 0%,
      color-mix(in srgb, var(--accent-color) 8%, transparent),
      transparent 32%
    ),
    radial-gradient(
      circle at 100% 100%,
      color-mix(in srgb, var(--accent-color) 6%, transparent),
      transparent 30%
    ),
    linear-gradient(90deg, rgba(4, 7, 8, 0.72), rgba(1, 3, 4, 0.88) 46%, rgba(2, 4, 5, 0.78)),
    linear-gradient(135deg, rgba(12, 18, 21, 0.58), rgba(3, 6, 8, 0.74) 56%, rgba(2, 4, 5, 0.82));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.34),
    0 0 28px color-mix(in srgb, var(--accent-color) 7%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -28px 70px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px) saturate(1.08);
  font-size: 16px;
  scroll-margin-top: 90px;
  position: relative;
  isolation: isolate;
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.additional-info::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.28), transparent 24%, rgba(0, 0, 0, 0.2)),
    radial-gradient(
      circle at 74% 42%,
      color-mix(in srgb, var(--accent-color) 5%, transparent),
      transparent 34%
    ),
    radial-gradient(circle at 50% 48%, rgba(0, 0, 0, 0.5), transparent 42%);
  pointer-events: none;
}

.additional-info:hover {
  transform: translateY(-2px) scale(1.002);
  border-color: rgba(255, 255, 255, 0.13);
  box-shadow:
    0 24px 68px rgba(0, 0, 0, 0.4),
    0 0 34px color-mix(in srgb, var(--accent-color) 11%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -28px 76px rgba(0, 0, 0, 0.3);
}

.additional-info-title {
  margin: 15px 0 15px;
  text-align: left;
  color: #fff;
}

.mobile-movie-summary,
.mobile-genre-chips {
  display: none;
}

.info-content {
  display: flex;
  gap: clamp(38px, 4.2vw, 76px);
  align-items: flex-start;
}

.movie-poster-container {
  flex-shrink: 0;
  width: clamp(250px, 15.5vw, 330px);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 18px 34px rgba(0, 0, 0, 0.42),
    0 0 28px color-mix(in srgb, var(--accent-color) 16%, transparent);
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 320ms cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
}

.movie-poster-container::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), transparent 28%);
  pointer-events: none;
}

.movie-poster-container:hover {
  transform: translateY(-2px) scale(1.015);
  filter: saturate(1.04);
  box-shadow:
    0 22px 44px rgba(0, 0, 0, 0.46),
    0 0 36px color-mix(in srgb, var(--accent-color) 22%, transparent);
}

.movie-poster {
  width: 100%;
  height: auto;
  display: block;
}

.details-container {
  flex: 1;
  min-width: 0;
  padding-top: 10px;
  max-width: 1040px;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.info-list li {
  display: inline-grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 48px;
  align-items: baseline;
  width: fit-content;
  max-width: min(100%, 860px);
  margin: 0;
  line-height: 1.45;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.info-list strong,
.info-description-row strong {
  color: rgba(255, 255, 255, 0.74);
  font-weight: 500;
  letter-spacing: 0;
}

.info-value {
  color: rgba(255, 255, 255, 0.9);
}

.content-info {
  font-size: 16px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.88);
  margin-top: 24px;
  max-width: 1280px;
}

.info-description-row {
  display: inline-grid;
  grid-template-columns: 240px minmax(0, 980px);
  gap: 48px;
  align-items: start;
  width: fit-content;
  max-width: min(100%, 1268px);
  padding-top: 8px;
}

.content-description {
  min-width: 0;
  max-width: min(100%, 980px);
}

.content-description-text {
  margin: 0;
  white-space: pre-wrap;
  max-width: 100%;
  overflow-wrap: anywhere;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.68;
}

.description-toggle {
  margin-top: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 28%, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, var(--accent-color) 12%, rgba(255, 255, 255, 0.06));
  color: rgba(255, 255, 255, 0.86);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  box-shadow:
    0 0 14px color-mix(in srgb, var(--accent-color) 8%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 260ms cubic-bezier(0.22, 1, 0.36, 1),
    background 260ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.description-toggle:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-color) 44%, rgba(255, 255, 255, 0.14));
  background: color-mix(in srgb, var(--accent-color) 18%, rgba(255, 255, 255, 0.07));
  box-shadow:
    0 0 18px color-mix(in srgb, var(--accent-color) 12%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.error-message {
  color: var(--accent-color);
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
  border: 1px solid var(--accent-color);
  border-radius: 5px;
  margin: 20px auto;
  max-width: 500px;
  background: var(--accent-transparent);
}

/* Стили для секций с похожими фильмами */
.related-movies {
  box-sizing: border-box;
  max-width: var(--movie-page-max-width);
  min-height: 340px;
  margin: 24px auto 0;
  padding: 24px 26px 20px;
  border-radius: 20px;
  position: relative;
  background:
    radial-gradient(
      circle at 0% 0%,
      color-mix(in srgb, var(--accent-color) 8%, transparent),
      transparent 28%
    ),
    radial-gradient(
      circle at 100% 100%,
      color-mix(in srgb, var(--accent-color) 5%, transparent),
      transparent 30%
    ),
    radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.42), transparent 44%),
    linear-gradient(90deg, rgba(4, 7, 8, 0.7), rgba(1, 3, 4, 0.86) 48%, rgba(2, 4, 5, 0.76)),
    linear-gradient(135deg, rgba(12, 18, 21, 0.52), rgba(3, 6, 8, 0.68));
  border: 1px solid color-mix(in srgb, var(--accent-color) 18%, transparent);
  box-shadow:
    0 18px 52px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    inset 0 -28px 70px rgba(0, 0, 0, 0.24),
    0 0 24px color-mix(in srgb, var(--accent-color) 6%, transparent);
  backdrop-filter: blur(8px) saturate(1.06);
  overflow: hidden;
  transition:
    border-color 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.related-movies:hover {
  border-color: color-mix(in srgb, var(--accent-color) 28%, transparent);
  box-shadow:
    0 20px 58px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 -28px 70px rgba(0, 0, 0, 0.26),
    0 0 34px color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.comments-section,
.staff-section {
  box-sizing: border-box;
  max-width: var(--movie-page-max-width);
  margin: 14px auto 0;
  scroll-margin-top: 90px;
}

.comments-section :deep(.comments-section) {
  padding: 0;
}

.comments-section :deep(.spoiler-warning) {
  margin: 0;
  padding: 26px 28px;
  border-radius: 20px;
  background:
    radial-gradient(
      circle at 50% 0%,
      color-mix(in srgb, var(--accent-color) 7%, transparent),
      transparent 28%
    ),
    radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.28), transparent 42%),
    linear-gradient(135deg, rgba(28, 28, 30, 0.9), rgba(25, 25, 27, 0.84));
  border-color: color-mix(in srgb, var(--accent-color) 16%, rgba(255, 255, 255, 0.08));
  box-shadow:
    0 18px 52px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 24px color-mix(in srgb, var(--accent-color) 6%, transparent);
  backdrop-filter: blur(8px) saturate(1.04);
}

.related-movies-header {
  position: relative;
  z-index: 1;
  margin-bottom: 14px;
}

.related-movies h2 {
  color: #fff;
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.related-movies h2::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent-color) 55%, transparent);
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
  .content {
    --movie-page-gutter: 2px;
  }

  .content-card {
    padding: 0 var(--movie-page-gutter) 16px;
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
    gap: 8px;
    flex-wrap: wrap;
  }

  .rating-link {
    padding: 3px 6px;
    font-size: 14px;
  }

  .rating-logo {
    width: 16px;
    height: 16px;
    margin-right: 3px;
  }

  .external-link-icon {
    width: 16px;
    margin-left: 3px;
  }

  .action-buttons-group {
    width: 100%;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
  }

  .action-buttons-group .nudity-info-btn {
    background: rgba(0, 0, 0, 0.7);
    padding: 12px 16px;
    border-radius: 8px;
    min-height: 44px;
    font-size: 14px;
  }

  .action-buttons-group .mobile-text {
    display: inline;
  }

  .action-buttons-group .desktop-text {
    display: none;
  }

  .action-buttons-group .nudity-info-btn i {
    font-size: 18px;
  }

  .additional-info-title {
    font-size: 20px;
  }

  .info-content {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .additional-info {
    margin-top: 14px;
    padding: 18px;
    border-radius: 20px;
    background:
      radial-gradient(
        circle at 0% 0%,
        color-mix(in srgb, var(--accent-color) 5%, transparent),
        transparent 32%
      ),
      radial-gradient(circle at 100% 0%, rgba(30, 170, 210, 0.05), transparent 34%),
      linear-gradient(180deg, rgba(3, 7, 8, 0.86), rgba(0, 2, 3, 0.94) 52%, rgba(0, 1, 2, 0.9));
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 18px 42px rgba(0, 0, 0, 0.34),
      0 0 18px rgba(38, 180, 210, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      inset 0 -24px 64px rgba(0, 0, 0, 0.34);
    font-size: 16px;
  }

  .additional-info::before {
    background:
      radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0.58), transparent 44%),
      linear-gradient(90deg, rgba(0, 0, 0, 0.18), transparent 28%, rgba(0, 0, 0, 0.22));
  }

  .additional-info:hover {
    transform: none;
  }

  .mobile-movie-summary {
    display: block;
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  }

  .mobile-movie-title {
    margin: 0 0 10px;
    color: rgba(255, 255, 255, 0.94);
    font-size: clamp(22px, 6vw, 26px);
    line-height: 1.12;
    font-weight: 700;
    letter-spacing: 0;
  }

  .mobile-movie-chips,
  .mobile-genre-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .mobile-summary-chip,
  .mobile-genre-chip,
  .mobile-age-chip {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.075);
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
    line-height: 1;
    font-weight: 600;
  }

  .mobile-age-chip {
    background: rgba(124, 23, 23, 0.22);
    border-color: rgba(255, 66, 66, 0.3);
    color: rgba(255, 210, 210, 0.9);
  }

  .mobile-age-chip.age-rating-soft {
    background: color-mix(in srgb, var(--accent-color) 12%, rgba(255, 255, 255, 0.045));
    border-color: color-mix(in srgb, var(--accent-color) 26%, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.86);
  }

  .details-container {
    width: 100%;
    max-width: none;
    padding-top: 0;
  }

  .info-list {
    width: 100%;
    align-items: stretch;
  }

  .info-list li,
  .info-description-row {
    grid-template-columns: minmax(86px, 34%) minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    max-width: none;
    padding: 6px 0;
    border-bottom-color: rgba(255, 255, 255, 0.018);
  }

  .info-list li {
    display: grid;
  }

  .info-list .info-row-title {
    display: none;
  }

  .info-list .rating-boxes {
    display: none !important;
  }

  .info-list .info-row-genres {
    grid-template-columns: 1fr;
    gap: 9px;
    padding-top: 12px;
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .info-list strong,
  .info-description-row strong {
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.65);
    font-size: 13px;
    font-weight: 600;
  }

  .info-value {
    min-width: 0;
    color: rgba(255, 255, 255, 0.92);
    font-size: 15px;
    line-height: 1.35;
    text-align: right;
  }

  .desktop-genres-text {
    display: none;
  }

  .info-description-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
    border-bottom: 0;
  }

  .info-description-row strong {
    color: rgba(255, 255, 255, 0.78);
    font-size: 15px;
  }

  .content-description {
    width: 100%;
    max-width: none;
  }

  .content-description-text {
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.6;
  }

  .movie-poster-container {
    width: min(44vw, 158px);
    align-self: center;
    border-radius: 12px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.36);
  }

  .content-info {
    font-size: 15px;
    width: 100%;
    max-width: none;
  }

  .content-title-container {
    flex-direction: column;
    gap: 10px;
  }

  .movie-poster-thumbnail {
    width: 50px;
    height: 75px;
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
  background-color: var(--accent-color);
  transform: translateY(-3px);
  box-shadow: 0 4px 10px var(--accent-semi-transparent);
}

.controls button:active {
  transform: translateY(0);
  box-shadow: none;
}

.controls button.active {
  background-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
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
  filter: drop-shadow(0 4px 8px var(--accent-semi-transparent));
}

.staff-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.staff-link:hover .staff-photo {
  border-color: var(--accent-color);
  box-shadow: 0 0 12px var(--accent-semi-transparent);
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
  transition: all 0.2s ease;
  color: #fff;
  font-size: 24px;
  text-decoration: none;
  flex-shrink: 0;
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
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
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
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.show-more-btn:active {
  background: var(--accent-color);
  border-color: var(--accent-color);
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

.nudity-info-btn:hover i {
  color: var(--accent-color);
}

.nudity-info-btn:hover,
.parents-guide-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: var(--accent-color) !important;
  box-shadow: 0 0 10px var(--accent-semi-transparent) !important;
}

.parents-guide-btn {
  background: rgba(0, 0, 0, 0.7);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.parents-guide-btn i {
  margin-left: 5px;
}

.nudity-info-btn i {
  font-size: 20px;
  color: #fff;
}

.nudity-info-btn .fa-spinner {
  color: #fff;
}

.staff-names-container {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 15px;
  width: 100%;
}

.staff-names-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
  min-width: 0;
  align-items: center;
}

.staff-name-link {
  color: #fff;
  text-decoration: none;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.staff-name-link:hover {
  background: var(--accent-color);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.staff-list .expand-actors-circle-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 24px;
  text-decoration: none;
  flex-shrink: 0;
}

.staff-list .expand-actors-circle-button:hover {
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
}

.staff-names-list .expand-actors-circle-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 16px;
  text-decoration: none;
  flex-shrink: 0;
}

.staff-names-list .expand-actors-circle-button:hover {
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
}

@media (max-width: 600px) {
  .staff-names-container {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
  }

  .staff-names-list {
    width: auto;
    flex: 1;
  }

  .staff-name-link {
    font-size: 14px;
    padding: 4px 8px;
  }

  .staff-list .expand-actors-circle-button {
    width: 60px;
    height: 60px;
    font-size: 20px;
  }

  .staff-names-list .expand-actors-circle-button {
    width: 35px;
    height: 35px;
    font-size: 14px;
  }
}

.related-movies-list :deep(.grid) {
  position: relative;
  z-index: 1;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  align-items: start;
  gap: 14px;
  padding: 0;
}

.related-movies-list :deep(.grid.card-size-small) {
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
}

.related-movies-list :deep(.grid.card-size-medium) {
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
}

.related-movies-list :deep(.grid.card-size-large) {
  grid-template-columns: repeat(auto-fill, minmax(172px, 1fr));
  gap: 14px;
}

.related-movies .expand-circle-button {
  position: relative;
  z-index: 1;
  margin-top: 18px;
}

@media (max-width: 620px) {
  .related-movies {
    margin-top: 24px;
    padding: 14px 10px 10px;
    border-radius: 14px;
  }

  .related-movies h2 {
    font-size: 1.15rem;
  }

  .related-movies-list :deep(.grid) {
    display: flex;
    grid-template-columns: none;
    justify-content: flex-start;
    width: 100%;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 2px 8px;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .related-movies-list :deep(.grid > *) {
    flex: 0 0 156px;
    width: 156px;
    scroll-snap-align: start;
  }

  .related-movies-list :deep(.grid.card-size-small > *) {
    flex-basis: 132px;
    width: 132px;
  }

  .related-movies-list :deep(.grid.card-size-large > *) {
    flex-basis: 172px;
    width: 172px;
  }
}

@media (max-width: 768px) {
  .info-content {
    flex-direction: column;
    align-items: stretch;
  }

  .desktop-only {
    display: none;
  }
}

.rating-value.low {
  color: #ff6b6b !important;
}

.rating-value.medium {
  color: #ffd93d !important;
}

.rating-value.high {
  color: #51cf66 !important;
}

.desktop-text {
  display: inline;
}

.mobile-text {
  display: none;
}

@media (max-width: 600px) {
  .desktop-text {
    display: none;
  }

  .mobile-text {
    display: inline;
  }
}

.rating-boxes {
  display: grid !important;
  grid-template-columns: 240px minmax(0, 1fr) !important;
  gap: 48px;
  margin: 0;
}

.rating-boxes > strong {
  transition: color 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.rating-boxes.age-rating-soft > strong {
  color: color-mix(in srgb, var(--accent-color) 68%, rgba(220, 255, 230, 0.78));
}

.rating-boxes.age-rating-caution > strong {
  color: rgba(255, 214, 139, 0.84);
}

.rating-boxes.age-rating-mature > strong {
  color: rgba(255, 170, 116, 0.84);
}

.rating-boxes.age-rating-adult > strong {
  color: rgba(255, 126, 126, 0.86);
}

.rating-boxes-values {
  display: flex;
  gap: 10px;
  align-items: center;
}

.rating-box {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 7px;
  font-weight: bold;
  gap: 5px;
  line-height: 1;
}

.rating-box.mpaa {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.rating-box.mpaa span {
  font-size: 0.9em;
}

.rating-box.age {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    0 0 12px rgba(255, 255, 255, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition:
    background 280ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 280ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1),
    color 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.rating-box.age-rating-soft {
  background: color-mix(in srgb, var(--accent-color) 18%, rgba(18, 72, 38, 0.2));
  border-color: color-mix(in srgb, var(--accent-color) 38%, rgba(255, 255, 255, 0.12));
  box-shadow:
    0 0 14px color-mix(in srgb, var(--accent-color) 14%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.rating-box.age-rating-caution {
  background: rgba(128, 90, 22, 0.24);
  border-color: rgba(255, 194, 85, 0.34);
  box-shadow:
    0 0 14px rgba(255, 182, 64, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.rating-box.age-rating-mature {
  background: rgba(132, 58, 22, 0.25);
  border-color: rgba(255, 132, 76, 0.35);
  box-shadow:
    0 0 14px rgba(255, 112, 52, 0.13),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.rating-box.age-rating-adult {
  background: rgba(124, 23, 23, 0.28);
  border-color: rgba(255, 66, 66, 0.34);
  box-shadow:
    0 0 14px rgba(255, 42, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.rating-box strong {
  font-size: 0.9em;
  opacity: 0.8;
}

.rating-box span {
  font-size: 1.1em;
}

@media (max-width: 600px) {
  .rating-boxes {
    grid-template-columns: 1fr !important;
    flex-wrap: wrap;
    gap: 4px;
  }

  .rating-box {
    font-size: 14px;
    padding: 3px 6px;
  }
}

.text-red {
  color: #ff4444 !important;
}

.text-red-blink {
  color: #ff4444 !important;
  animation: blink-red-streamer 0.8s ease-in-out infinite;
}

@keyframes blink-red-streamer {
  0%,
  100% {
    color: #ff4444;
    text-shadow:
      0 0 15px #ff4444,
      0 0 25px #ff4444;
    transform: scale(1);
  }
  50% {
    color: #ff8888;
    text-shadow:
      0 0 20px #ff4444,
      0 0 35px #ff4444,
      0 0 45px #ff4444;
    transform: scale(1.15);
  }
}

.note-btn {
  transition: all 0.3s ease;
}

.note-btn.has-note {
  color: #ffd700;
  animation: pulse-note 2s infinite;
}

.note-btn.has-note i {
  color: #ffd700;
  filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.5));
}

@keyframes pulse-note {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.movie-note-display {
  margin: 30px 0;
  padding: 20px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.05) 0%, rgba(255, 107, 53, 0.02) 100%);
  border: 2px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.movie-note-display:hover {
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.15);
  transform: translateY(-2px);
}

.movie-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.movie-note-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.movie-note-title i {
  color: var(--accent-color);
  font-size: 1.5em;
}

.movie-note-title h3 {
  margin: 0;
  color: #fff;
  font-size: 1.3em;
}

.movie-note-actions {
  display: flex;
  gap: 8px;
}

.note-edit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.note-edit-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.movie-note-content {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.05em;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 10px;
}

.movie-note-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.note-date {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 600px) {
  .movie-note-display {
    margin: 20px -10px;
    padding: 15px;
  }

  .movie-note-title h3 {
    font-size: 1.1em;
  }

  .movie-note-content {
    font-size: 1em;
    padding: 12px;
  }
}
</style>
