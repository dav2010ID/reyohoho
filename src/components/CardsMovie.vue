<template>
  <div>
    <div v-show="!loading" class="grid">
      <a
        v-for="(movie, index) in moviesList"
        :key="movie.kp_id"
        :ref="(el) => (movieRefs[index] = el)"
        class="movie-card"
        :class="{
          active: activeMovieIndex === index,
          'has-border': isCardBorder
        }"
        :href="movieUrl(movie)"
        tabindex="0"
      >
        <div class="movie-poster-container">
          <div v-if="movie.poster || movie.cover">
            <img :src="movie.poster || movie.cover" :alt="movie.title" class="movie-poster" />
            <DeleteButton v-if="isHistory" @click.stop.prevent="removeFromHistory(movie.kp_id)" />
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
              {{ movie.type.replace("🎬", "") }}
            </div>
          </div>
        </div>

        <div class="movie-details">
          <div class="movie-header">
            <h3>{{ removeYearFromTitle(movie.title) }}</h3>
          </div>

          <!-- Вместо старого места для типа выводим год выпуска -->
          <div v-if="movie.year" class="meta">
            <span class="year">{{ movie.year }}</span>
          </div>
        </div>
      </a>
    </div>
    <Spinner v-if="loading" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import Spinner from '@/components/SpinnerLoading.vue'
import DeleteButton from '@/components/buttons/DeleteButton.vue'
import { TYPES_ENUM } from '@/constants'

const props = defineProps({
  moviesList: Array,
  isHistory: Boolean,
  loading: Boolean
})

const router = useRouter()
const movieRefs = ref([])
const activeMovieIndex = ref(null)
const store = useStore()

const isCardBorder = computed(() => store.getters['background/getCardBorder'])
console.log(isCardBorder.value)

const movieUrl = (movie) => {
  return router.resolve({ name: 'movie-info', params: { kp_id: movie.kp_id } }).href
}

const removeYearFromTitle = (title) => {
  return title ? title.replace(/\(\d{4}\)$/, '').trim() : title
}

const removeFromHistory = (kp_id) => {
  store.dispatch('removeFromHistory', kp_id)
}

const handleKeyDown = (event) => {
  if (!props.moviesList?.length) return

  if (!event.target.classList.contains('movie-card')) {
    movieRefs.value[activeMovieIndex.value]?.focus()
  }

  switch (event.key) {
    case 'ArrowRight':
      activeMovieIndex.value = (activeMovieIndex.value + 1) % props.moviesList.length
      break
    case 'ArrowLeft':
      activeMovieIndex.value = (activeMovieIndex.value - 1 + props.moviesList.length) % props.moviesList.length
      break
    case 'ArrowUp':
      event.preventDefault()
      activeMovieIndex.value = Math.max(activeMovieIndex.value - 5, 0)
      break
    case 'ArrowDown':
      event.preventDefault()
      activeMovieIndex.value = Math.min(activeMovieIndex.value + 5, props.moviesList.length - 1)
      break
    case 'Home':
      activeMovieIndex.value = 0
      break
    case 'End':
      activeMovieIndex.value = props.moviesList.length - 1
      break
    case 'Enter':
      if (event.ctrlKey || event.metaKey) {
        window.open(movieUrl(props.moviesList[activeMovieIndex.value]), '_blank')
      } else {
        router.push({ name: 'movie-info', params: { kp_id: props.moviesList[activeMovieIndex.value]?.kp_id } })
      }
      break
  }
}

watch(activeMovieIndex, (newIndex) => {
  if (movieRefs.value[newIndex]) {
    movieRefs.value[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    movieRefs.value[newIndex].focus()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.grid {
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  justify-content: center;
  margin: 0 auto;
  width: 100%;
  padding: 0 15px;
  box-sizing: border-box;
  position: relative;
  min-height: 300px;
}

.movie-card {
    text-decoration: none;
    color: inherit;
    width: 100%;
    max-width: 240px;
    background: rgba(30, 30, 30, 0.6);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.3s ease, box-shadow 0.3s ease, border 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
    border: none;
}

.has-border {
    border: 1px solid #ccc;
}

.movie-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

.movie-card:focus {
    outline: 2px solid white;
    outline-offset: 2px;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
    transition: border 0.2s ease;
    cursor: pointer;
}

.movie-poster-container {
    position: relative;
}

.movie-details {
    padding: 15px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

.movie-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
}

.movie-header h3 {
    font-size: 1.1em;
    margin: 0;
    display: -webkit-box;
    display: box;
    -webkit-line-clamp: 3;
    -moz-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    -moz-box-orient: vertical;
    box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
    max-height: 3.6em;
}

.movie-poster {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: stretch;
  justify-content: center;
  width: 100%;
}

.deleteButton {
  position: absolute;
  bottom: 5px;
  right: 5px;
  opacity: 0;
}

.movie-card:hover .deleteButton {
  opacity: 1;
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

.year,
.type,
.views {
  font-size: 0.9em;
  color: #ccc;
}

.meta {
  margin-bottom: 10px;
}

.views {
  display: flex;
  align-items: center;
  gap: 5px;
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

/* Мобильная версия */
@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 5px;
  }

  .ratings-overlay {
    bottom: 3px;
    left: 0;
    padding: 4px 8px;
    font-size: 0.8em;
    border-radius: 0;
  }

  .movie-card {
    flex-direction: row;
    align-items: flex-start;
    height: 180px;
    width: 100%;
    max-width: none;
    border-radius: 15px;
  }

  .movie-poster-container {
    width: 120px;
  }

  .movie-poster {
    width: 120px;
    aspect-ratio: 2 / 3;
    border-radius: 10px 0 0 10px;
  }

  .deleteButton {
    left: 5px;
    opacity: 1;
  }

  .movie-details {
    padding: 10px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .movie-header h3 {
    font-size: 1.2em;
    -webkit-line-clamp: 2;
    -moz-line-clamp: 2;
    line-clamp: 2;
    max-height: 2.4em;
  }

  .rating-logo {
    width: 15px;
    height: auto;
    display: inline-block;
  }

  .year,
  .type,
  .views {
    font-size: 1em;
  }
}
</style>