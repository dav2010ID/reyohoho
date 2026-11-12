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

      <ErrorMessage
        v-if="errorMessage"
        :message="errorMessage"
        :code="errorCode"
        show-retry
        @retry="fetchMovieInfo()"
      />

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

      <div
        v-if="movieInfo && !contentLoading"
        class="content-card"
        :class="{ 'has-backdrop': backdropStyle }"
        :style="backdropStyle"
      >
        <!-- Desktop: one row, title and meta on the left; scores, tools and the player chip
             on the right. Phones: the scores and tools are teleported under the player. -->
        <div class="content-header">
          <div v-if="!mainStore.isMobile" class="content-heading">
            <div class="content-title-row">
              <img
                v-if="movieInfo.logo_url"
                :src="movieInfo.logo_url"
                :alt="movieInfo.title"
                class="content-logo"
              />
              <h1 class="content-title" :class="{ 'visually-hidden': movieInfo.logo_url }">
                {{ movieInfo.title }}
              </h1>
              <button
                type="button"
                class="copy-title-btn"
                aria-label="Скопировать название, год и длительность"
                title="Скопировать название"
                @click="copyMovieMeta"
              >
                <i class="fas fa-copy" aria-hidden="true"></i>
              </button>
            </div>
            <p v-if="metaParts.length || ageLabels.length" class="content-meta">
              <span
                v-for="(part, index) in metaParts"
                :key="part"
                class="content-meta__part"
                :class="{ 'has-sep': index < metaParts.length - 1 }"
                >{{ part }}</span
              >
              <span v-if="ageLabels.length" class="content-meta__badges">
                <span v-for="label in ageLabels" :key="label" class="info-age-badge">{{
                  label
                }}</span>
              </span>
            </p>
          </div>

          <Teleport defer to="#mobile-summary-side" :disabled="!mainStore.isMobile">
            <div class="header-side">
              <div class="ratings-links">
                <!-- Kinopoisk leads: one large score with its vote count. -->
                <a
                  v-if="movieInfo.kinopoisk_id || movieInfo.title"
                  :href="
                    movieInfo.kinopoisk_id
                      ? `https://www.kinopoisk.ru/film/${movieInfo.kinopoisk_id}`
                      : `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`
                  "
                  target="_blank"
                  rel="noopener noreferrer"
                  class="score-primary"
                >
                  <span
                    class="score-primary__value"
                    :class="scoreTier(movieInfo.rating_kinopoisk)"
                    >{{ formatScore(movieInfo.rating_kinopoisk) }}</span
                  >
                  <span class="score-primary__label"
                    >Кинопоиск<template v-if="movieInfo.rating_kinopoisk_vote_count">
                      ·
                      {{ formatRatingNumber(movieInfo.rating_kinopoisk_vote_count) }}
                      оценок</template
                    ></span
                  >
                </a>

                <component
                  :is="movieRatingComponent"
                  v-if="clientReady && ratingsAvailable && movieInfo.kinopoisk_id"
                  :key="movieInfo.kinopoisk_id"
                  :kp-id="movieInfo.kinopoisk_id"
                  :show-dash="true"
                />

                <div v-if="movieInfo.imdb_id || movieInfo.title">
                  <a
                    :href="
                      movieInfo.imdb_id
                        ? `https://www.imdb.com/title/${movieInfo.imdb_id}`
                        : `https://www.imdb.com/find/?q=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`
                    "
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rating-link"
                    :title="
                      movieInfo.rating_imdb_vote_count
                        ? `IMDb, оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                        : 'IMDb'
                    "
                  >
                    <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
                    <span class="rating-value" :class="scoreTier(movieInfo.rating_imdb)">
                      {{ formatScore(movieInfo.rating_imdb) }}
                    </span>
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
                      :class="scoreTier(movieInfo.rating_shikimori)"
                    >
                      {{ movieInfo.rating_shikimori }}
                    </span>
                  </a>
                </div>

                <!-- Kino API: TMDB, Rotten Tomatoes, Metacritic -->
                <div v-for="rating in extraRatings" :key="rating.name">
                  <component
                    :is="rating.href ? 'a' : 'span'"
                    :href="rating.href || undefined"
                    :target="rating.href ? '_blank' : undefined"
                    :rel="rating.href ? 'noopener noreferrer' : undefined"
                    class="rating-link extra-rating"
                    :title="rating.title"
                  >
                    <img
                      :src="rating.icon"
                      :alt="rating.name"
                      class="rating-logo"
                      width="20"
                      height="20"
                    />
                    <span class="rating-value" :class="scoreTier(rating.score)">{{
                      rating.label
                    }}</span>
                  </component>
                </div>
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
              <div v-if="!mainStore.isMobile" id="movie-player-chip" class="player-chip-slot"></div>
            </div>
          </Teleport>
        </div>

        <!-- Интеграция компонента плеера -->
        <component
          :is="moviePlayerComponent"
          v-if="clientReady && moviePlayerComponent"
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          selector-target="#movie-player-chip"
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
            <component :is="mainStore.isMobile ? 'h1' : 'h2'" class="mobile-movie-title">{{
              movieInfo.title
            }}</component>
            <p v-if="metaParts.length || ageLabels.length" class="content-meta">
              <span
                v-for="(part, index) in metaParts"
                :key="part"
                class="content-meta__part"
                :class="{ 'has-sep': index < metaParts.length - 1 }"
                >{{ part }}</span
              >
              <span v-if="ageLabels.length" class="content-meta__badges">
                <span v-for="label in ageLabels" :key="label" class="info-age-badge">{{
                  label
                }}</span>
              </span>
            </p>
            <div id="mobile-summary-side"></div>
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
              <div class="info-head">
                <p v-if="genreNames.length" class="info-genres-line">
                  {{ genreNames.join(' · ') }}
                </p>
                <p v-if="movieInfo.name_original" class="info-original-title">
                  {{ movieInfo.name_original }}
                </p>
                <p v-if="movieInfo.slogan" class="info-slogan">«{{ movieInfo.slogan }}»</p>
              </div>
              <div v-if="movieInfo.description" class="content-info info-description-row">
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
              <dl v-if="leadDirectors.length || leadActors.length" class="info-people">
                <div v-if="leadDirectors.length" class="info-people__row">
                  <dt>{{ leadDirectors.length > 1 ? 'Режиссёры' : 'Режиссёр' }}</dt>
                  <dd>
                    <a
                      v-for="person in leadDirectors"
                      :key="person.staff_id"
                      :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="info-people__link"
                      >{{ person.name_ru || person.name_en }}</a
                    >
                  </dd>
                </div>
                <div v-if="leadActors.length" class="info-people__row">
                  <dt>В главных ролях</dt>
                  <dd>
                    <a
                      v-for="person in leadActors"
                      :key="person.staff_id"
                      :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="info-people__link"
                      >{{ person.name_ru || person.name_en }}</a
                    >
                  </dd>
                </div>
              </dl>
            </div>
            <aside class="facts-column">
              <TrailerCarousel
                v-if="videos.length === 1 && areTrailersActive"
                class="facts-trailer"
                single
                :videos="videos"
                :active-video-index="activeTrailerIndex"
              />
              <ul
                v-if="
                  movieInfo.production_companies ||
                  movieInfo.seasons_count ||
                  movieInfo.episodes_count ||
                  productionStatusLabel
                "
                class="info-list"
              >
                <li v-if="movieInfo.production_companies">
                  <strong>Продакшн</strong>
                  <span class="info-value">{{ movieInfo.production_companies }}</span>
                </li>
                <li v-if="movieInfo.seasons_count">
                  <strong>Сезонов</strong>
                  <span class="info-value">{{ movieInfo.seasons_count }}</span>
                </li>
                <li v-if="movieInfo.episodes_count">
                  <strong>Эпизодов</strong>
                  <span class="info-value">{{ movieInfo.episodes_count }}</span>
                </li>
                <li v-if="productionStatusLabel">
                  <strong>Статус</strong>
                  <span class="info-value">{{ productionStatusLabel }}</span>
                </li>
              </ul>
            </aside>
          </div>
        </div>

        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <div class="related-movies-header">
            <h2>
              Сиквелы и приквелы
              <span class="movie-panel-count">{{ sequelsAndPrequels.length }}</span>
            </h2>
            <RibbonNav container=".related-movies" scroller=".grid" label="Сиквелы и приквелы" />
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
            <h2>
              Похожие <span class="movie-panel-count">{{ similars.length }}</span>
            </h2>
            <RibbonNav container=".related-movies" scroller=".grid" label="Похожие" />
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
          <section
            v-if="actors.length || staffNameGroups.length"
            id="movie-staff"
            class="staff-section movie-panel"
          >
            <div v-if="actors.length" class="staff-block">
              <div class="movie-panel-heading">
                <h2 class="movie-panel-title">
                  В ролях <span class="movie-panel-count">{{ actors.length }}</span>
                </h2>
                <a
                  v-if="actors.length > 12"
                  class="movie-panel-link"
                  :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Все актёры <span class="sym" aria-hidden="true">→</span></a
                >
                <RibbonNav container=".staff-block" scroller=".staff-list" label="В ролях" />
              </div>
              <ul class="staff-list">
                <li v-for="person in actors.slice(0, 12)" :key="person.staff_id" class="staff-item">
                  <a
                    :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="staff-link"
                    :title="person.description || ''"
                  >
                    <img
                      v-if="person.poster_url"
                      :src="person.poster_url"
                      :alt="person.name_ru || person.name_en"
                      class="staff-photo"
                      loading="lazy"
                      decoding="async"
                    />
                    <span v-else class="staff-photo staff-photo-empty" aria-hidden="true">
                      <i class="fas fa-user"></i>
                    </span>
                    <span class="staff-name">{{ person.name_ru || person.name_en }}</span>
                    <span v-if="person.description" class="staff-role">{{
                      person.description
                    }}</span>
                  </a>
                </li>
              </ul>
            </div>

            <div v-if="staffNameGroups.length" class="staff-block">
              <h3 class="movie-panel-subtitle">Съёмочная группа</h3>
              <dl class="crew-list">
                <div v-for="group in staffNameGroups" :key="group.key" class="crew-row">
                  <dt>{{ group.people.length === 1 ? group.one : group.title }}</dt>
                  <dd class="staff-names-list">
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
                      class="staff-name-link staff-name-more"
                      :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="`Показать всех ${group.people.length} ${group.label}`"
                    >
                      и ещё {{ group.people.length - 5 }}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </Teleport>

        <div v-if="videos.length > 1 && areTrailersActive" class="yt-video-container">
          <TrailerCarousel
            class="movie-panel"
            :videos="videos"
            :active-video-index="activeTrailerIndex"
          />
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
import { useConfirmation } from '@/composables/useConfirmation'
import { sceneSelection } from '@/utils/sceneSelection'
import { getKpInfo, getShikiInfo, getMovieNote, saveMovieNote, deleteMovieNote } from '@/api/movies'
import { getMovieExtras, missingMovieExtras } from '@/api/movieExtras'
import { legacyBackendAvailable } from '@/api/backendConfig'
import { legacyMovieMethodAvailable } from '@/api/movieCapabilities'
import { handleApiError } from '@/constants'
import { addToList } from '@/api/user'
import { usePlayerLists } from '@/composables/usePlayerLists'
import { cardRatings } from '../../shared/history-data.js'
import { MovieList } from '@/components/MovieList/'
import RibbonNav from '@/components/movie/RibbonNav.vue'
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
import tmdbIcon from '@/assets/icon-tmdb.svg'
import rottenTomatoesIcon from '@/assets/icon-rotten-tomatoes.svg'
import metacriticIcon from '@/assets/icon-metacritic.svg'

const askConfirmation = useConfirmation()

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
const notesAvailable = computed(
  () => backendAvailable.value && authStore.token && !authStore.isWorkerSession
)
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
  sceneSelection.overlayNudityTimings = ids
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

// White by default; colour flags only weak scores.
const scoreTier = (value) => {
  const number = parseFloat(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  if (number < 5) return 'is-low'
  if (number < 7) return 'is-mid'
  return ''
}

// Ten-point scores always show one decimal ("9.0", not "9"), so neighbours line up.
const formatScore = (value) => {
  const number = parseFloat(value)
  if (!Number.isFinite(number) || number <= 0) return '—'
  return number.toFixed(1)
}

// "1999 · Фильм · США · 2 ч 16 мин" under the title.
const metaParts = computed(() => {
  const info = movieInfo.value
  if (!info) return []
  return [
    info.year && String(info.year),
    info.type && TYPES_ENUM[info.type],
    countryNames.value.length && countryNames.value.join(', '),
    formattedDuration.value
  ].filter(Boolean)
})
const ageLabels = computed(() => {
  const info = movieInfo.value
  if (!info) return []
  return [
    info.rating_age_limits && getAgeRatingLabel(info.rating_age_limits),
    info.rating_mpaa && info.rating_mpaa.toUpperCase()
  ].filter(Boolean)
})

// Poster glow behind the header; a user-chosen page background takes precedence.
const backdropStyle = computed(() => {
  if (backgroundStore.backgroundType !== 'disabled' || !moviePosterUrl.value) return null
  // Escape only what could end the CSS string; the URL itself is already encoded.
  const url = moviePosterUrl.value.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))
  return { '--movie-backdrop': `url("${url}")` }
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

const getAgeRatingLabel = (ratingAgeLimits) => {
  const age = String(ratingAgeLimits || '').replace(/\D/g, '')
  return age ? `${age}+` : String(ratingAgeLimits || '')
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

// Optional data that arrives after the card; the card never waits for it.
const loadMovieExtras = async (requestedKpId, controller) => {
  const extras = await getMovieExtras(movieInfo.value, { signal: controller.signal })
  if (!extras || controller.signal.aborted || requestedKpId !== kp_id.value || !movieInfo.value)
    return
  // Mutate in place: pending history and list updates compare the card by identity.
  const added = missingMovieExtras(movieInfo.value, extras)
  Object.assign(movieInfo.value, added)
  if (added.logo_url) {
    navbarStore.setHeaderContent({ text: movieInfo.value.title, imageUrl: added.logo_url })
  }
}

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

    if (!import.meta.env.SSR) void loadMovieExtras(requestedKpId, controller)

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
    if (controller.signal.aborted || requestedKpId !== kp_id.value || isRequestCanceled(error))
      return false
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

// Ratings from Kino API, shown in the ratings row above the player. Scores are
// brought to the 0-10 scale only to pick the same colour as the other ratings.
const extraRatings = computed(() => {
  const info = movieInfo.value || {}
  const ratings = []
  if (info.rating_tmdb) {
    ratings.push({
      name: 'TMDB',
      icon: tmdbIcon,
      label: String(info.rating_tmdb),
      title: `TMDB: ${info.rating_tmdb} из 10`,
      score: info.rating_tmdb,
      href:
        info.tmdb_id && info.tmdb_type
          ? `https://www.themoviedb.org/${info.tmdb_type}/${info.tmdb_id}`
          : null
    })
  }
  if (info.rating_rotten_tomatoes != null) {
    ratings.push({
      name: 'Rotten Tomatoes',
      icon: rottenTomatoesIcon,
      label: `${info.rating_rotten_tomatoes}%`,
      title: `Rotten Tomatoes: ${info.rating_rotten_tomatoes}% положительных рецензий критиков`,
      score: info.rating_rotten_tomatoes / 10
    })
  }
  if (info.rating_metacritic != null) {
    ratings.push({
      name: 'Metacritic',
      icon: metacriticIcon,
      label: String(info.rating_metacritic),
      title: `Metacritic: ${info.rating_metacritic} из 100`,
      score: info.rating_metacritic / 10
    })
  }
  return ratings
})

const staffByProfession = computed(() => {
  const groups = {}
  for (const person of movieInfo.value?.staff || []) {
    ;(groups[person.profession_key] ||= []).push(person)
  }
  return groups
})
const actors = computed(() => staffByProfession.value.ACTOR || [])
const named = (person) => person?.staff_id && (person.name_ru || person.name_en)
const leadDirectors = computed(() =>
  (staffByProfession.value.DIRECTOR || []).filter(named).slice(0, 2)
)
const leadActors = computed(() => actors.value.filter(named).slice(0, 3))
const staffNameGroups = computed(() =>
  [
    { key: 'DIRECTOR', title: 'Режиссёры', one: 'Режиссёр', label: 'режиссёров' },
    { key: 'PRODUCER', title: 'Продюсеры', one: 'Продюсер', label: 'продюсеров' }
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
  sceneSelection.selectedNudityTimings = []
  sceneSelection.overlayNudityTimings = []
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
  delete sceneSelection.selectedNudityTimings
  delete sceneSelection.overlayNudityTimings
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
      sceneSelection.selectedNudityTimings = []
      sceneSelection.overlayNudityTimings = []
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

  if (!(await askConfirmation('Вы уверены, что хотите удалить заметку?'))) {
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

<style scoped src="./MovieInfo.css"></style>
