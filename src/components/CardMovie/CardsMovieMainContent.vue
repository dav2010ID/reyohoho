<template>
  <div class="movie-poster-container" :class="[`card-size-${cardSize}`, `variant-${variant}`]">
    <div v-if="posterSrc" class="movie-poster-frame">
      <img
        :srcset="posterSources.srcset"
        :sizes="posterSources.srcset ? posterSizes : undefined"
        :src="posterSources.src"
        class="movie-poster"
        :alt="movie.title ? `Постер ${movie.title}` : 'Постер фильма'"
        width="300"
        height="450"
        :loading="imageLoading"
        :fetchpriority="imageFetchPriority"
        decoding="async"
        @error="setImageFallback"
      />
      <DeleteButton
        v-if="(isHistory || isUserList) && showDelete"
        class="delete-button"
        :label="isHistory ? 'Удалить из истории' : 'Удалить из списка'"
        data-test-id="delete-button"
        @click.stop.prevent="emit('remove:from-history', movie.kp_id)"
      />
      <span
        v-if="score"
        class="card-score"
        :class="[`rating-${score.source}`, scoreTier]"
        :aria-label="`${score.label} ${formatRating(score)}`"
      >
        <span v-if="score.source === 'our' && showStar" class="card-score__star" aria-hidden="true"
          >★</span
        >
        {{ formatRating(score) }}
      </span>
      <div v-if="showType && isSeries" class="poster-type">Сериал</div>
      <div class="poster-action" aria-hidden="true">
        <i class="fas fa-play"></i>
        <span>Смотреть</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import DeleteButton from '@/components/buttons/DeleteButton.vue'
import { useMainStore } from '@/store/main'
import {
  CARD_POSTER_SIZES,
  resolvePosterSourcesByMovie,
  setImageFallback
} from '@/utils/mediaUtils'
import { computed } from 'vue'

const mainStore = useMainStore()
const cardSize = computed(() => mainStore.cardSize)

const {
  movie,
  isHistory = false,
  isUserList = false,
  showDelete = true,
  showStar = false,
  variant = 'default',
  priority = false,
  showType = false
} = defineProps({
  movie: Object,
  isMobile: Boolean,
  isHistory: Boolean,
  isUserList: Boolean,
  showDelete: Boolean,
  showStar: Boolean,
  variant: String,
  priority: Boolean,
  showType: Boolean
})

const emit = defineEmits(['remove:from-history'])
const posterSources = computed(() => resolvePosterSourcesByMovie(movie))
const posterSrc = computed(() => posterSources.value.src)
const posterSizes = computed(() =>
  variant === 'related'
    ? `(max-width: 620px) ${{ small: 132, medium: 156, large: 172 }[cardSize.value] || 156}px, 200px`
    : CARD_POSTER_SIZES[cardSize.value] || CARD_POSTER_SIZES.medium
)
const imageLoading = computed(() => (priority ? 'eager' : 'lazy'))
const imageFetchPriority = computed(() => (priority ? 'high' : 'low'))

const toRatingNumber = (value) => {
  if (value === null || value === undefined || value === '' || value === 'null') return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? number : null
}

const displayOurRating = computed(() => toRatingNumber(movie.rating ?? movie.average_rating))
const displayKpRating = computed(() =>
  toRatingNumber(movie.rating_kp ?? movie.rating_kinopoisk ?? movie.raw_data?.rating)
)
const displayImdbRating = computed(() =>
  toRatingNumber(movie.rating_imdb ?? movie.raw_data?.rating_imdb)
)
// One score per card: the user's own rating in their lists, otherwise Kinopoisk, then IMDb, then the site rating.
const score = computed(() => {
  if (showStar && displayOurRating.value)
    return { source: 'our', own: true, label: 'Ваша оценка', value: displayOurRating.value }
  if (displayKpRating.value)
    return { source: 'kp', label: 'Кинопоиск', value: displayKpRating.value }
  if (displayImdbRating.value)
    return { source: 'imdb', label: 'IMDb', value: displayImdbRating.value }
  if (displayOurRating.value)
    return { source: 'our', label: 'Рейтинг ReYohoho', value: displayOurRating.value }
  return null
})
// White by default; colour only flags weak scores.
const scoreTier = computed(() => {
  const value = score.value?.value ?? 0
  if (value < 5) return 'is-low'
  if (value < 7) return 'is-mid'
  return ''
})
const SERIES_TYPES = new Set(['TV_SERIES', 'MINI_SERIES', 'TV_SHOW'])
const isSeries = computed(
  () => SERIES_TYPES.has(movie.type) || /сериал/i.test(String(movie.type || ''))
)
const formatRating = ({ value, own }) =>
  own ? value.toFixed(1).replace(/\.0$/, '') : value.toFixed(1)
</script>

<style scoped>
.movie-poster-container {
  --movie-poster-frame-radius: var(--radius-m);
  --movie-poster-frame-bg: rgba(255, 255, 255, 0.04);
  position: relative;
  flex-shrink: 0;
}

.movie-poster-container.variant-related {
  width: 100%;
}

.movie-poster-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: var(--movie-poster-frame-radius);
  background: var(--movie-poster-frame-bg);
}

/* Hover ring sits on the poster, not on a card box. */
.movie-poster-frame::before {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0);
  pointer-events: none;
  transition: box-shadow 0.2s ease;
}

:deep(.movie-card:hover) .movie-poster-frame::before {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.movie-poster {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.delete-button {
  position: absolute;
  z-index: 2;
  top: 6px;
  left: 6px;
  opacity: 0;
}

/* No hover on touch: the per-card delete stays visible next to the swipe gesture. */
@media (hover: none) {
  .delete-button {
    left: auto;
    right: 4px;
    opacity: 1;
  }
}

.card-score {
  position: absolute;
  z-index: 2;
  bottom: 6px;
  left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-s);
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: var(--fs-s);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
}

.card-score.is-mid {
  color: #ffc94d;
}

.card-score.is-low {
  color: #ff7b7b;
}

.card-score__star {
  color: var(--accent-text);
  font-size: 11px;
}

.poster-type {
  position: absolute;
  z-index: 2;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: var(--radius-s);
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.poster-action {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: var(--fs-s);
  font-weight: 700;
  opacity: 0;
  transform: translate(-50%, 8px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  pointer-events: none;
}

:deep(.movie-card:hover) .poster-action,
:deep(.movie-card:focus-visible) .poster-action {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Compact history rows on phones: 64x96 poster next to the text. */
.movie-poster-container.layout-row {
  width: 64px;
}

.movie-poster-container.layout-row .poster-type,
.movie-poster-container.layout-row .poster-action {
  display: none;
}

@media (max-width: 620px) {
  .poster-action {
    display: none;
  }

  .card-score {
    bottom: 4px;
    left: 4px;
    padding: 1px 5px;
    font-size: var(--fs-xs);
  }

  .poster-type {
    top: 4px;
    right: 4px;
    font-size: 9px;
  }

  /* The button root is .delete-button itself; 36px keeps it inside a 115px poster corner. */
  .movie-poster-container .delete-button {
    top: 4px;
    right: 4px;
    left: auto;
    width: 36px;
    height: 36px;
    border-width: 1px;
    border-radius: var(--radius-m);
    opacity: 1;
  }
}

/* Row layout: the delete button sits at the end of the row (positioned against the card). */
.movie-poster-container.layout-row,
.movie-poster-container.layout-row .movie-poster-frame {
  position: static;
}

.movie-poster-container.layout-row {
  flex-shrink: 0;
}

.movie-poster-container.layout-row .movie-poster {
  border-radius: var(--radius-s);
}

.movie-poster-container.layout-row .delete-button {
  top: 50%;
  right: 4px;
  left: auto;
  width: 44px;
  height: 44px;
  border-color: rgba(255, 255, 255, 0.2);
  background: transparent;
  transform: translateY(-50%);
}

.movie-poster-container.layout-row .card-score {
  display: none;
}
</style>
