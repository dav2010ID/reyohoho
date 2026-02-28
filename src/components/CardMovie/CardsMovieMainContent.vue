<template>
  <div class="movie-poster-container" :class="`card-size-${cardSize}`">
    <div v-if="posterSrc">
      <img v-lazy="posterSrc" class="movie-poster" />
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
          <img src="/icons/icon-192x192.png" alt="ReYohoho" class="rating-logo" />
          {{ `${(movie.rating || movie.average_rating).toFixed(1).replace(/\.0$/, '')}` }}
        </span>
        <span v-if="movie.rating_kp" class="rating-kp" :class="getRatingColor(movie.rating_kp)">
          <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
          {{ movie.rating_kp }}
        </span>
        <span
          v-if="movie.rating_imdb"
          class="rating-imdb"
          :class="getRatingColor(movie.rating_imdb)"
        >
          <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
          {{ movie.rating_imdb }}
        </span>
      </div>
      <!-- Добавлен блок для отображения типа (сериал/фильм) в правом верхнем углу постера -->
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
import { getRatingColor } from '@/utils/ratingUtils'
import { useMainStore } from '@/store/main'
import { computed } from 'vue'
import { resolvePosterByMovie } from '@/utils/mediaUtils'

const mainStore = useMainStore()
const cardSize = computed(() => mainStore.cardSize)

const {
  movie,
  isMobile = false,
  isHistory = false,
  isUserList = false,
  showDelete = true,
  showStar = false
} = defineProps({
  movie: Object,
  isMobile: Boolean,
  isHistory: Boolean,
  isUserList: Boolean,
  showDelete: Boolean,
  showStar: Boolean
})
const emit = defineEmits(['remove:from-history'])

const posterSrc = computed(() => {
  return resolvePosterByMovie(movie)
})
</script>

<style scoped>
.movie-poster-container {
  position: relative;
}

.movie-poster {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
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
  gap: 10px;
  background: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 5px;
  justify-content: center;
  align-items: center;
}

/* Новый стиль для блока с типом, отображаемым в правом верхнем углу постера */
.poster-type {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 3px 8px;
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

  .movie-poster {
    width: 100px;
    aspect-ratio: 2 / 3;
    border-radius: 10px 0 0 10px;
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
