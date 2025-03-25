<template>
  <div class="movie-poster-container">
    <div v-if="movie.poster || movie.cover">
      <img :src="movie.poster || movie.cover" class="movie-poster" />
      <DeleteButton
        v-if="isHistory && !isMobile"
        class="delete-button"
        data-test-id="delete-button"
        @click.stop.prevent="emit('remove:from-history', movie.kp_id)"
      />
      <div v-if="movie.rating_kp || movie.rating_imdb" class="ratings-overlay">
        <span v-if="movie.rating_kp" class="rating-kp">
          <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
          {{ movie.rating_kp }}
        </span>
        <span v-if="movie.rating_imdb" class="rating-imdb">
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

const {
  movie,
  isHistory = false,
  isMobile = false
} = defineProps({
  movie: Object,
  isHistory: Boolean,
  isMobile: Boolean
})
const emit = defineEmits(['remove:from-history'])
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
  bottom: 5px;
  right: 5px;
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
.rating-imdb {
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

@media (max-width: 620px) {
  .ratings-overlay {
    bottom: 3px;
    left: 0;
    padding: 4px 8px;
    font-size: 0.8em;
    border-radius: 0;
  }

  .movie-poster-container {
    width: 120px;
  }

  .movie-poster {
    width: 120px;
    aspect-ratio: 2 / 3;
    border-radius: 10px 0 0 10px;
  }

  .delete-button {
    left: 5px;
    opacity: 1;
  }

  .rating-logo {
    width: 15px;
    height: auto;
    display: inline-block;
  }
}
</style>
