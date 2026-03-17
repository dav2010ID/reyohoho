<template>
  <div class="movie-details" :class="`variant-${variant}`">
    <div class="movie-header">
      <h3>{{ removeYearFromTitle(movie.title) }}</h3>
    </div>

    <div v-if="movie.raw_data?.name_en || movie.raw_data?.Name_original" class="original-title">
      {{ movie.raw_data.name_en || movie.raw_data.Name_original }}
    </div>

    <!-- Вместо старого места для типа выводим год выпуска -->
    <div v-if="movie.year" class="meta">
      <span class="year">{{ movie.year }}</span>
    </div>

    <div v-if="movie.raw_data?.genres?.length" class="genres">
      <template v-for="genre in movie.raw_data.genres.slice(0, 2)" :key="genre.genre">
        <span class="genre-tag">{{ genre.genre }}</span>
      </template>
      <span v-if="movie.raw_data.genres.length > 2" class="genre-count">
        +{{ movie.raw_data.genres.length - 2 }}
      </span>
    </div>
  </div>
</template>

<script setup>
const { movie, variant = 'default' } = defineProps({
  movie: Object,
  isHistory: Boolean,
  variant: String
})

const removeYearFromTitle = (title) => {
  return title ? title.replace(/\(\d{4}\)$/, '').trim() : title
}
</script>

<style scoped>
.movie-details {
  padding: 15px;
  min-width: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.movie-details.variant-related {
  flex-grow: 0;
  padding: 10px 10px 12px;
}

.movie-header {
  display: flex;
  min-width: 0;
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
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}

.original-title {
  font-size: 0.8em;
  color: #888;
  margin-bottom: 10px;
  font-style: italic;
  display: -webkit-box;
  display: box;
  -webkit-line-clamp: 2;
  -moz-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -moz-box-orient: vertical;
  box-orient: vertical;
  overflow: hidden;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}

.year {
  font-size: 0.9em;
  color: #ccc;
}

.meta {
  margin-bottom: 10px;
}

.genres {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
  align-items: center;
}

.genre-tag {
  font-size: 0.75em;
  color: #888;
  background-color: rgba(136, 136, 136, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.genre-count {
  font-size: 0.75em;
  color: #888;
  background-color: rgba(136, 136, 136, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

@media (max-width: 600px) {
  .movie-details {
    padding: 8px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .movie-details.variant-related {
    padding: 8px;
    flex-grow: 0;
    justify-content: flex-start;
  }

  .movie-header {
    margin-bottom: 6px;
  }

  .movie-header h3 {
    font-size: 0.95em;
    -webkit-line-clamp: 4;
    -moz-line-clamp: 4;
    line-clamp: 4;
    max-height: 4.8em;
    line-height: 1.2;
    word-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .original-title {
    margin-bottom: 6px;
    font-size: 0.75em;
  }

  .meta {
    margin-bottom: 6px;
  }

  .year {
    font-size: 0.9em;
  }

  .genres {
    margin-top: 3px;
  }

  .genre-tag,
  .genre-count {
    font-size: 0.7em;
    padding: 1px 4px;
  }
}
</style>
