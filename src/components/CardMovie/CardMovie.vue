<template>
  <RouterLink
    ref="element"
    class="movie-card"
    :class="{
      active: activeMovieIndex === index,
      'has-border': isCardBorder,
      'hover-disabled': isCardHoverDisabled,
      'card-border': isCardBorder,
      [`card-size-${cardSize}`]: true,
      [`variant-${variant}`]: true,
      'layout-row': isRowLayout
    }"
    :to="moviePath"
    :data-test-id="`movie-card-${movie.kp_id}`"
    tabindex="0"
  >
    <CardsMovieMainContent
      :movie="displayMovie"
      :is-history
      :is-mobile
      :is-user-list="isUserList"
      :show-delete="showDelete"
      :show-star="showStar"
      :variant="variant"
      :show-type="showType"
      :class="{ 'layout-row': isRowLayout }"
      :priority="variant !== 'related' && index < 3"
      @remove:from-history="(data) => emit('remove:from-history', data)"
    />

    <CardMovieDetails
      :movie
      :is-history
      :variant="variant"
      :rank="rank"
      :show-original-title="showOriginalTitle"
      :class="{ 'layout-row': isRowLayout }"
    />
  </RouterLink>
</template>

<script setup>
import { onMounted, onUnmounted, useTemplateRef, computed, ref, watch } from 'vue'
import CardMovieDetails from './CardMovieDetails.vue'
import CardsMovieMainContent from './CardsMovieMainContent.vue'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { getMovieSeoPath } from '@/utils/movieSeo'
import { useAuthStore } from '@/store/auth'
import { useRoute } from 'vue-router'
import { repairCardRatings } from '@/api/user'
import { cardRatings } from '../../../shared/history-data.js'

const backgroundStore = useBackgroundStore()
const mainStore = useMainStore()
const isCardHoverDisabled = computed(() => backgroundStore.isCardHoverDisabled)
const cardSize = computed(() => mainStore.cardSize)

const {
  movie,
  isHistory = false,
  isCardBorder = false,
  isMobile = false,
  isUserList = false,
  activeMovieIndex = null,
  index = 0,
  showDelete = true,
  showStar = false,
  variant = 'default',
  showType = false,
  showOriginalTitle = false,
  rank = null,
  rowLayout = false
} = defineProps({
  movie: Object,
  isHistory: Boolean,
  isMobile: Boolean,
  isCardBorder: Boolean,
  isUserList: Boolean,
  index: Number,
  activeMovieIndex: [Number, null],
  showDelete: Boolean,
  showStar: Boolean,
  variant: String,
  showType: Boolean,
  showOriginalTitle: Boolean,
  rank: { type: Number, default: null },
  // A row (small poster beside the text) at any width: the desktop "continue watching" tiles.
  rowLayout: Boolean
})

const emit = defineEmits(['remove:from-history', 'save:element'])
const element = useTemplateRef('element')
const moviePath = computed(() => getMovieSeoPath(movie))
// Phones keep history and lists as compact rows so swipe-to-delete still works.
const isRowLayout = computed(
  () => rowLayout || (isMobile && (isHistory || isUserList) && variant !== 'related')
)
const authStore = useAuthStore()
const route = useRoute()
const enrichedMovie = ref(null)
const displayMovie = computed(() => ({ ...movie, ...cardRatings(enrichedMovie.value || movie) }))
let observer
let generation = 0
let visible = false
const loadRatings = async () => {
  const currentGeneration = ++generation
  const original = movie
  const token = authStore.token
  if (
    !(isHistory || isUserList) ||
    original?.ratings_checked === 1 ||
    cardRatings(original).rating_kp ||
    cardRatings(original).rating_imdb
  )
    return
  const isCurrent = () =>
    generation === currentGeneration && movie === original && authStore.token === token
  const ownList =
    !route.params.user_id || String(route.params.user_id) === String(authStore.user?.id)
  const type = isHistory ? 'history' : ownList ? route.query.type || 'favorite' : null
  try {
    const card = await repairCardRatings(original, type, isCurrent)
    if (!isCurrent()) return
    enrichedMovie.value = card
    // Patch only metadata of an existing entry; never resurrect a deleted history item.
    if (isHistory) {
      const ratings = cardRatings(card)
      mainStore.patchHistoryRatings(original.kp_id, ratings)
    }
  } catch {
    /* Keep the card usable when the metadata service is unavailable. */
  }
}
watch([() => movie, () => authStore.token], () => {
  generation++
  enrichedMovie.value = null
  if (visible) void loadRatings()
})

onMounted(() => {
  if (element.value && element.value.$el) {
    emit('save:element', element.value.$el)
    if (typeof window.IntersectionObserver === 'undefined') {
      visible = true
      void loadRatings()
    } else {
      observer = new window.IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            visible = true
            observer.disconnect()
            void loadRatings()
          }
        },
        { rootMargin: '200px' }
      )
      observer.observe(element.value.$el)
    }
  }
})
onUnmounted(() => {
  generation++
  observer?.disconnect()
})
</script>

<style scoped>
/* Chrome-less card: the poster is the card; text sits under it on the page surface. */
.movie-card {
  --card-hover-translate: -3px;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  border-radius: var(--radius-m);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.has-border :deep(.movie-poster-frame) {
  box-shadow: 0 0 0 1px var(--accent-ui);
}

.movie-card:hover {
  transform: translateY(var(--card-hover-translate));
}

.hover-disabled:hover,
.movie-card.variant-related:hover {
  transform: none;
}

.movie-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 3px;
}

.movie-card:hover :deep(.delete-button),
.movie-card:focus-within :deep(.delete-button) {
  opacity: 1;
}

.movie-card.variant-related {
  height: auto;
}

/* Rows: a 64x96 poster beside the text, the delete button at the end. */
.movie-card.layout-row {
  flex-direction: row;
  align-items: center;
  min-height: 96px;
  padding-right: 52px;
  box-sizing: border-box;
}

/* Desktop resume tiles sit on a raised surface. */
@media (min-width: 621px) {
  .movie-card.layout-row {
    padding: 8px 52px 8px 8px;
    border-radius: var(--radius-m);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--hairline);
  }

  .movie-card.layout-row:hover {
    transform: none;
    background: var(--surface-overlay);
  }
}

@media (max-width: 620px) {
  .movie-card:hover {
    transform: none;
  }
}
</style>
