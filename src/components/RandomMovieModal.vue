<template>
  <transition name="modal">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div
        v-dialog-focus="close"
        aria-label="Случайный фильм"
        class="modal modern-dark-dialog random-movie-modal"
      >
        <div class="modal-header">
          <h3>
            <i class="fas fa-dice"></i>
            Случайный фильм
          </h3>
          <button class="close-btn" type="button" aria-label="Закрыть" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-content">
          <p v-if="movie?.source === 'kinopoisk' && !loading" class="selection-note">
            Подборка из Топ-250 Кинопоиска
          </p>
          <div v-if="loading" class="loading-container">
            <div class="spinner"></div>
            <p>Подбираем фильм...</p>
          </div>

          <!-- Poster, title, one meta line and a short description; the movie page has the rest. -->
          <transition v-else-if="movie" name="random-swap" mode="out-in">
            <div :key="movie.kp_id || movie.title" class="movie-content">
              <img
                :srcset="posterSources.srcset"
                :sizes="posterSources.srcset ? '(max-width: 768px) 132px, 220px' : undefined"
                :src="posterSources.src"
                decoding="async"
                :alt="movie.title ? `Постер ${movie.title}` : 'Постер фильма'"
                class="movie-poster"
                width="300"
                height="450"
                @error="setImageFallback"
              />

              <div class="movie-info-section">
                <h4 class="movie-title">{{ movie.title }}</h4>
                <p v-if="metaParts.length || movie.age_rating" class="movie-meta">
                  <template v-for="(part, index) in metaParts" :key="part"
                    ><span class="meta-part"
                      >{{ part
                      }}<span
                        v-if="index < metaParts.length - 1"
                        class="meta-sep"
                        aria-hidden="true"
                        >&nbsp;·</span
                      ></span
                    >{{ ' ' }}</template
                  ><span v-if="movie.age_rating" class="age-badge">{{ movie.age_rating }}</span>
                </p>
                <p v-if="scores.length" class="movie-scores">
                  <span v-for="score in scores" :key="score.label" class="movie-score">
                    <img :src="score.logo" :alt="score.label" class="rating-logo" />
                    <span :class="scoreTier(score.value)">{{ score.value }}</span>
                  </span>
                </p>
                <p v-if="movie.description" class="movie-description">{{ movie.description }}</p>
              </div>
            </div>
          </transition>

          <div v-else-if="error" class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <p>{{ error }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <button class="modern-dark-btn ghost" :disabled="loading" @click="getNewMovie">
            <i class="fas fa-dice" aria-hidden="true"></i>
            Ещё раз
          </button>
          <router-link
            v-if="movie && !loading"
            :to="moviePath"
            class="modern-dark-btn primary"
            @click="close"
          >
            <i class="fas fa-play" aria-hidden="true"></i>
            Смотреть
          </router-link>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { resolvePosterSourcesByMovie, setImageFallback } from '@/utils/mediaUtils'
import { computed } from 'vue'
import { getMovieSeoPath } from '@/utils/movieSeo'
import { formatMovieDuration } from '@/utils/movieDuration'
import imdbLogoUrl from '@/assets/icon-imdb-logo.svg'
import kpLogoUrl from '@/assets/icon-kp-logo.svg'

const appLogoUrl = `${import.meta.env.BASE_URL || '/'}icons/icon-192x192.png`

const props = defineProps({
  isOpen: Boolean,
  movie: Object,
  loading: Boolean,
  error: String
})

const emit = defineEmits(['close', 'get-new-movie'])
const moviePath = computed(() => getMovieSeoPath(props.movie || {}))
const posterSources = computed(() => resolvePosterSourcesByMovie(props.movie || {}))

const close = () => {
  emit('close')
}

const getNewMovie = () => {
  emit('get-new-movie')
}

const formatType = (type) => {
  const typeMap = {
    FILM: 'Фильм',
    TV_SERIES: 'Сериал',
    TV_SHOW: 'ТВ-шоу',
    MINI_SERIES: 'Мини-сериал',
    'FilmType.FILM': 'Фильм',
    'FilmType.TV_SERIES': 'Сериал',
    'FilmType.TV_SHOW': 'ТВ-шоу',
    'FilmType.MINI_SERIES': 'Мини-сериал'
  }
  return typeMap[type] || type
}

// "1999 · Фильм · 2 ч. 16 мин. · США" and an age badge, as on the movie page.
const metaParts = computed(() => {
  const movie = props.movie || {}
  return [
    movie.year && String(movie.year),
    movie.type && formatType(movie.type),
    movie.duration && formatMovieDuration(movie.duration),
    movie.countries
  ].filter(Boolean)
})

const scores = computed(() => {
  const movie = props.movie || {}
  return [
    movie.rating_kp && { label: 'Кинопоиск', logo: kpLogoUrl, value: movie.rating_kp },
    movie.rating_imdb && { label: 'IMDb', logo: imdbLogoUrl, value: movie.rating_imdb },
    movie.rating_reyohoho && {
      label: 'ReYohoho',
      logo: appLogoUrl,
      value: Number(movie.rating_reyohoho).toFixed(1)
    }
  ].filter(Boolean)
})

// White by default; colour flags only weak scores.
const scoreTier = (value) => {
  const number = parseFloat(value)
  if (!Number.isFinite(number)) return ''
  if (number < 5) return 'is-low'
  if (number < 7) return 'is-mid'
  return ''
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: overlay-in 0.3s;
}

.modal {
  transform: translateY(-50px);
  animation: modal-in 0.3s forwards;
}

.random-movie-modal {
  width: 700px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.random-movie-modal .modal-header,
.random-movie-modal .modal-actions {
  flex-shrink: 0;
}

.modern-dark-dialog {
  background-color: var(--surface-overlay);
  color: #fff;
  border-radius: var(--radius-l);
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.25);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--accent-ui);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
  margin: -8px -12px -8px 0;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-btn:hover {
  opacity: 1;
}

.modal-content {
  padding: 20px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.selection-note {
  margin: 0 0 16px;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid var(--accent-ui);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  color: #ff6b6b;
}

.error-content i {
  font-size: 3rem;
}

.movie-content {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.random-swap-enter-active,
.random-swap-leave-active {
  transition: opacity 0.18s ease;
}

.random-swap-enter-from,
.random-swap-leave-to {
  opacity: 0;
}

.movie-poster {
  display: block;
  width: 220px;
  height: auto;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-m);
  background: rgba(255, 255, 255, 0.04);
}

.movie-info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.movie-title {
  margin: 0;
  color: #fff;
  font-size: var(--fs-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.movie-meta {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--fs-s);
  line-height: 1.8;
}

.meta-part {
  margin-right: 4px;
  white-space: nowrap;
}

.meta-sep {
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.4);
}

.age-badge {
  display: inline-block;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-s);
  font-size: var(--fs-xs);
  line-height: 18px;
  white-space: nowrap;
}

.movie-scores {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
}

.movie-score {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: var(--fs-m);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.movie-score .is-mid {
  color: #ffc94d;
}

.movie-score .is-low {
  color: #ff7b7b;
}

.rating-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.movie-description {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  color: rgba(255, 255, 255, 0.86);
  font-size: var(--fs-m);
  line-height: 1.6;
}

/* "Ещё раз" on the left, "Смотреть" on the right; the header ✕ closes. */
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--hairline);
}

.modern-dark-btn {
  min-height: 44px;
  padding: 0 16px;
  box-sizing: border-box;
  border-radius: var(--radius-m);
  border: none;
  background-color: #242424;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.modern-dark-btn:hover {
  background-color: #2b2b2b;
}

.modern-dark-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modern-dark-btn.primary {
  background-color: var(--accent-solid);
  color: var(--accent-contrast);
}

.modern-dark-btn.primary:hover {
  background-color: var(--accent-solid-hover);
}

.modern-dark-btn.ghost {
  background-color: transparent;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  color: #fff;
}

.modern-dark-btn.ghost:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.06);
}

@keyframes modal-in {
  to {
    transform: translateY(0);
  }
}

@keyframes overlay-in {
  from {
    backdrop-filter: blur(0);
  }
  to {
    backdrop-filter: blur(4px);
  }
}

@media (max-width: 768px) {
  .random-movie-modal {
    width: 95vw;
    margin: 0 10px;
  }

  /* Phones: title, meta and scores beside the poster; the description runs full width below. */
  .movie-content {
    grid-template-columns: 132px minmax(0, 1fr);
    /* The third row takes the poster's extra height so the text stays packed at the top. */
    grid-template-rows: auto auto 1fr auto;
    gap: 8px 16px;
  }

  .movie-info-section {
    display: contents;
  }

  .movie-poster {
    grid-row: 1 / span 3;
  }

  .movie-title,
  .movie-meta,
  .movie-scores {
    grid-column: 2;
  }

  .movie-description {
    grid-column: 1 / -1;
    margin-top: 8px;
  }

  .movie-poster {
    width: 132px;
  }

  .movie-title {
    font-size: var(--fs-xl);
  }

  .modal-actions {
    padding: 12px 16px;
  }

  .modal-actions .modern-dark-btn {
    flex: 1 1 0;
    justify-content: center;
  }
}
</style>
