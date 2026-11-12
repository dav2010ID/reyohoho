<template>
  <div class="movie-details" :class="`variant-${variant}`">
    <div class="movie-header">
      <h3>{{ removeYearFromTitle(movie.title) }}</h3>
    </div>

    <div v-if="showOriginalTitle && originalTitle" class="original-title">
      {{ originalTitle }}
    </div>

    <p v-if="rank || metaLine" class="card-meta">
      <span v-if="rank" class="card-rank">№&nbsp;{{ rank }}</span>
      <span v-if="rank && metaLine" aria-hidden="true"> · </span>
      <span v-if="metaLine">{{ metaLine }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const {
  movie,
  variant = 'default',
  rank = null,
  showOriginalTitle = false
} = defineProps({
  movie: Object,
  isHistory: Boolean,
  variant: String,
  rank: { type: Number, default: null },
  showOriginalTitle: Boolean
})

const genres = computed(() => {
  const items = Array.isArray(movie.genres) && movie.genres.length ? movie.genres : movie.raw_data?.genres
  return Array.isArray(items)
    ? [...new Set(items.map((g) => (typeof g === 'string' ? g : g?.genre || g?.name)?.trim()).filter(Boolean))]
    : []
})

const originalTitle = computed(() => movie.raw_data?.name_en || movie.raw_data?.Name_original || '')

// One quiet line instead of chips: "1999 · фантастика, драма".
const metaLine = computed(() => {
  const parts = []
  if (movie.year) parts.push(String(movie.year))
  if (variant !== 'related' && genres.value.length) parts.push(genres.value.slice(0, 2).join(', '))
  return parts.join(' · ')
})

const removeYearFromTitle = (title) => {
  return title ? title.replace(/\(\d{4}\)$/, '').trim() : title
}
</script>

<style scoped>
.movie-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 8px 0 0;
}

.movie-header h3 {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  color: #fff;
  font-size: var(--fs-m);
  font-weight: 600;
  line-height: 1.3;
  text-wrap: balance;
  overflow-wrap: break-word;
  hyphens: none;
}

.original-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-style: italic;
}

.card-meta {
  margin: 0;
  overflow: hidden;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-rank {
  color: var(--accent-text);
  font-size: var(--fs-xs);
  font-weight: 700;
}

.movie-details.variant-related .movie-header h3 {
  font-weight: 500;
}

/* Compact history rows on phones keep the text next to a small poster. */
.movie-details.layout-row {
  justify-content: center;
  padding: 0 12px;
}

@media (max-width: 620px) {
  .movie-header h3 {
    font-size: var(--fs-s);
  }

  .card-meta {
    font-size: var(--fs-xs);
  }

  .movie-details.layout-row .movie-header h3 {
    font-size: var(--fs-m);
  }
}
</style>
