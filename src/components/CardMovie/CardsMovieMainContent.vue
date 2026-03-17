<template>
  <div class="movie-poster-container" :class="[`card-size-${cardSize}`, `variant-${variant}`]">
    <div v-if="posterSrc" class="movie-poster-frame">
      <img
        v-if="isServerRender"
        :src="posterSrc"
        class="movie-poster"
        :alt="movie.title ? `Постер ${movie.title}` : 'Постер фильма'"
        width="300"
        height="450"
        decoding="async"
      />
      <img
        v-else
        v-lazy="posterSrc"
        class="movie-poster"
        :alt="movie.title ? `Постер ${movie.title}` : 'Постер фильма'"
        width="300"
        height="450"
        loading="lazy"
        decoding="async"
      />
      <DeleteButton
        v-if="!isMobile && (isHistory || isUserList) && showDelete"
        class="delete-button"
        data-test-id="delete-button"
        @click.stop.prevent="emit('remove:from-history', movie.kp_id)"
      />
      <div
        v-if="movie.rating_kp || movie.rating_imdb || movie.average_rating"
        class="ratings-overlay"
      >
        <span
          v-if="movie.rating || movie.average_rating"
          class="rating-our"
          :class="{
            'with-star': showStar,
            [getRatingColor(movie.rating || movie.average_rating)]: true
          }"
        >
          <img :src="appLogoUrl" alt="ReYohoho" class="rating-logo" />
          {{ `${(movie.rating || movie.average_rating).toFixed(1).replace(/\.0$/, '')}` }}
        </span>
        <span v-if="movie.rating_kp" class="rating-kp" :class="getRatingColor(movie.rating_kp)">
          <img :src="kpLogoUrl" alt="КП" class="rating-logo" />
          {{ movie.rating_kp }}
        </span>
        <span
          v-if="movie.rating_imdb"
          class="rating-imdb"
          :class="getRatingColor(movie.rating_imdb)"
        >
          <img :src="imdbLogoUrl" alt="IMDb" class="rating-logo" />
          {{ movie.rating_imdb }}
        </span>
      </div>
      <div v-if="movie.type && TYPES_ENUM[movie.type]" class="poster-type">
        {{ TYPES_ENUM[movie.type] ?? '' }}
      </div>
      <div v-if="movie.type && !TYPES_ENUM[movie.type]" class="poster-type">
        {{ movie.type.replace('🎬', '') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import DeleteButton from '@/components/buttons/DeleteButton.vue'
import { TYPES_ENUM } from '@/constants'
import { useMainStore } from '@/store/main'
import { resolvePosterByMovie } from '@/utils/mediaUtils'
import { getRatingColor } from '@/utils/ratingUtils'
import imdbLogoUrl from '@/assets/icon-imdb-logo.svg'
import kpLogoUrl from '@/assets/icon-kp-logo.svg'
import { computed } from 'vue'

const mainStore = useMainStore()
const cardSize = computed(() => mainStore.cardSize)
const appLogoUrl = `${import.meta.env.BASE_URL || '/'}icons/icon-192x192.png`

const {
  movie,
  isMobile = false,
  isHistory = false,
  isUserList = false,
  showDelete = true,
  showStar = false,
  variant = 'default'
} = defineProps({
  movie: Object,
  isMobile: Boolean,
  isHistory: Boolean,
  isUserList: Boolean,
  showDelete: Boolean,
  showStar: Boolean,
  variant: String
})

const emit = defineEmits(['remove:from-history'])
const isServerRender = import.meta.env.SSR

const posterSrc = computed(() => {
  return resolvePosterByMovie(movie)
})
</script>

<style scoped>
.movie-poster-container {
  --movie-poster-frame-radius: 10px 10px 0 0;
  --movie-poster-frame-bg: rgba(255, 255, 255, 0.04);
  --movie-poster-overlay: none;
  --movie-poster-hover-transform: none;
  --movie-poster-hover-filter: none;
  --movie-ratings-bg: rgba(0, 0, 0, 0.7);
  --movie-ratings-border: transparent;
  --movie-ratings-radius: 5px;
  --movie-ratings-gap: 10px;
  --movie-ratings-padding: 5px 10px;
  --movie-poster-type-bg: rgba(0, 0, 0, 0.7);
  --movie-poster-type-border: transparent;
  --movie-poster-type-padding: 3px 8px;
  position: relative;
  flex-shrink: 0;
}

.movie-poster-container.variant-related {
  width: 100%;
}

.movie-poster-frame {
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: var(--movie-poster-frame-radius);
  background: var(--movie-poster-frame-bg);
}

.movie-poster-frame::after {
  content: '';
  position: relative;
  display: block;
}

.movie-poster-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--movie-poster-overlay);
}

.movie-poster {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

:deep(.movie-card:hover) .movie-poster {
  transform: var(--movie-poster-hover-transform);
  filter: var(--movie-poster-hover-filter);
}

.delete-button {
  position: absolute;
  top: 5px;
  left: 5px;
  opacity: 0;
}

.ratings-overlay {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  gap: var(--movie-ratings-gap);
  background: var(--movie-ratings-bg);
  border: 1px solid var(--movie-ratings-border);
  padding: var(--movie-ratings-padding);
  border-radius: var(--movie-ratings-radius);
  justify-content: center;
  align-items: center;
}

.poster-type {
  position: absolute;
  top: 5px;
  right: 5px;
  background: var(--movie-poster-type-bg);
  color: #fff;
  border: 1px solid var(--movie-poster-type-border);
  padding: var(--movie-poster-type-padding);
  border-radius: 3px;
  font-size: 0.9em;
  text-transform: uppercase;
}

.rating-kp,
.rating-imdb,
.rating-our {
  font-size: 1.2em;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 5px;
}

.rating-logo {
  width: 20px;
  height: auto;
  display: inline-block;
}

.rating-our {
  font-size: 1.2em;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
  padding: 2px 6px;
  border-radius: 4px;
}

.rating-our.with-star {
  background: var(--accent-transparent);
  border: 1px solid var(--accent-transparent);
}

.rating-our.with-star::after {
  content: '★';
  position: absolute;
  top: -6px;
  left: -6px;
  font-size: 12px;
  color: var(--accent-color);
  line-height: 1;
  padding-bottom: 1px;
}

.rating-kp.low,
.rating-imdb.low,
.rating-our.low {
  color: #ff6b6b !important;
}

.rating-kp.medium,
.rating-imdb.medium,
.rating-our.medium {
  color: #ffd93d !important;
}

.rating-kp.high,
.rating-imdb.high,
.rating-our.high {
  color: #51cf66 !important;
}

@media (max-width: 620px) {
  .ratings-overlay {
    bottom: 3px;
    left: 0;
    padding: 4px 8px;
    font-size: 0.8em;
    border-radius: 0;
  }

  .movie-poster-container {
    width: 100px;
    min-width: 100px;
  }

  .movie-poster-frame {
    width: 100px;
    aspect-ratio: 2 / 3;
    border-radius: 10px 0 0 10px;
  }

  .movie-poster-container.variant-related {
    width: 100%;
    min-width: 0;
    align-self: auto;
  }

  .movie-poster-container.variant-related .movie-poster-frame {
    width: 100%;
  }

  .delete-button {
    top: 5px;
    left: 5px;
    opacity: 1;
  }

  .rating-logo {
    width: 15px;
    height: auto;
    display: inline-block;
  }

  .rating-our {
    font-size: 1em;
    padding: 1px 4px;
  }

  .rating-our.with-star::after {
    top: -5px;
    left: -5px;
    font-size: 10px;
    padding-bottom: 1px;
  }
}

.movie-poster-container.card-size-small .ratings-overlay {
  padding: 3px 6px;
  gap: 6px;
  font-size: 0.75em;
}

.movie-poster-container.card-size-small .rating-logo {
  width: 16px;
}

.movie-poster-container.card-size-small .poster-type {
  font-size: 0.75em;
  padding: 2px 6px;
}

.movie-poster-container.card-size-large .ratings-overlay {
  padding: 8px 12px;
  gap: 12px;
  font-size: 1.1em;
}

.movie-poster-container.card-size-large .rating-logo {
  width: 24px;
}

.movie-poster-container.card-size-large .poster-type {
  font-size: 1em;
  padding: 4px 10px;
}
</style>
