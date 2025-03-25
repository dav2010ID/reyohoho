<template>
  <div class="movie-details">
    <div class="movie-header">
      <h3>{{ removeYearFromTitle(movie.title) }}</h3>
    </div>

    <!-- Вместо старого места для типа выводим год выпуска -->
    <div v-if="movie.year" class="meta">
      <span class="year">{{ movie.year }}</span>
    </div>
  </div>
</template>

<script setup>
const { movie } = defineProps({
  movie: Object,
  isHistory: Boolean
})

const removeYearFromTitle = (title) => {
  return title ? title.replace(/\(\d{4}\)$/, '').trim() : title
}
</script>

<style scoped>
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

.year {
  font-size: 0.9em;
  color: #ccc;
}

.meta {
  margin-bottom: 10px;
}

@media (max-width: 600px) {
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

  .year {
    font-size: 1em;
  }
}
</style>
