<template>
  <div>
    <div
      v-show="!loading"
      class="grid"
      :class="[
        `card-size-${cardSize}`,
        `variant-${variant}`,
        { 'grid--rows': isRowList, 'grid--ribbon': ribbon && !isMobile }
      ]"
    >
      <template v-if="(isHistory || isUserList) && isMobile">
        <CardMovieSwipeWrapper
          v-for="(movie, index) in moviesList"
          :key="movie.kp_id"
          :data-test-id="`movie-card-swipe-wrapper-${movie.kp_id}`"
          :show-delete="showDelete"
          @slide="removeFromHistory(movie.kp_id)"
        >
          <CardMovie
            :movie
            :is-history
            :is-mobile
            :is-user-list="isUserList"
            :index
            :is-card-border="isCardBorder"
            :active-movie-index
            :show-delete="showDelete"
            :show-star="showStar"
            :variant="variant"
            :show-type="isMixed"
            @remove:from-history="removeFromHistory"
            @save:element="(el) => (movieRefs[index] = el)"
          />
        </CardMovieSwipeWrapper>
      </template>

      <template v-else>
        <CardMovie
          v-for="(movie, index) in moviesList"
          :key="movie.kp_id"
          :movie
          :is-history="isHistory"
          :is-mobile="isMobile"
          :is-user-list="isUserList"
          :index
          :is-card-border="isCardBorder"
          :active-movie-index
          :show-delete="showDelete"
          :show-star="showStar"
          :variant="variant"
          :show-type="isMixed"
          :show-original-title="showOriginalTitle"
          :rank="showRank ? index + 1 : null"
          @remove:from-history="removeFromHistory"
          @save:element="(el) => (movieRefs[index] = el)"
        />
      </template>
    </div>
    <Spinner v-if="loading" />
  </div>
</template>

<script setup>
import Spinner from '@/components/SpinnerLoading.vue'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CardMovie, CardMovieSwipeWrapper } from '../CardMovie'
import { delFromList } from '@/api/user'
import { handleApiError } from '@/constants'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { getMovieSeoPath } from '@/utils/movieSeo'
import { logoutAndRedirect } from '@/utils/authSession'

const mainStore = useMainStore()
const authStore = useAuthStore()
const backgroundStore = useBackgroundStore()
const router = useRouter()
const route = useRoute()

const {
  moviesList,
  isHistory = false,
  loading = true,
  showDelete = true,
  showStar = false,
  variant = 'default',
  showRank = false,
  showOriginalTitle = false,
  ribbon = false
} = defineProps({
  moviesList: Array,
  isHistory: Boolean,
  loading: Boolean,
  showDelete: Boolean,
  showStar: Boolean,
  variant: String,
  showRank: Boolean,
  showOriginalTitle: Boolean,
  ribbon: Boolean
})

const movieRefs = ref([])
const deletingIds = ref(new Set())

const isCardBorder = computed(() => backgroundStore.isCardBorder)
const isMobile = computed(() => mainStore.isMobile)
const cardSize = computed(() => mainStore.cardSize)
const isUserList = computed(() => {
  return (
    route.name === 'lists' &&
    (!route.params.user_id || String(route.params.user_id) === String(authStore.user?.id))
  )
})

const isRowList = computed(() => (isHistory || isUserList.value) && isMobile.value)
// The series badge only carries information when films and series are mixed.
const isMixed = computed(() => {
  const kinds = new Set(
    (moviesList || []).map((movie) => (/SERIES|SHOW|сериал/i.test(String(movie?.type || '')) ? 'series' : 'film'))
  )
  return kinds.size > 1
})

const movieUrl = (movie) => {
  return router.resolve(getMovieSeoPath(movie)).href
}

const emit = defineEmits(['item-deleted'])
const removeFromHistory = async (kp_id) => {
  // UserLists owns mutations of its current list.
  if (!isHistory) {
    emit('item-deleted', kp_id)
    return
  }
  const normalizedId = String(kp_id)
  if (deletingIds.value.has(normalizedId)) return

  deletingIds.value.add(normalizedId)

  if (authStore.token) {
    const token = authStore.token
    const owner = mainStore.historyOwner
    const previousHistory = [...mainStore.history]
    mainStore.removeFromHistory(kp_id)
    emit('item-deleted', kp_id)

    try {
      await delFromList(kp_id, USER_LIST_TYPES_ENUM.HISTORY)
    } catch (error) {
      if (authStore.token !== token || mainStore.historyOwner !== owner) return
      const { code } = handleApiError(error)
      console.error('Ошибка загрузки истории:', error)
      if (code === 401) {
        await logoutAndRedirect({ authStore, router })
      } else if (isHistory) {
        mainStore.setHistory(previousHistory)
      }
    } finally {
      deletingIds.value.delete(normalizedId)
    }
  } else {
    mainStore.removeFromHistory(kp_id)
    emit('item-deleted', kp_id)
    deletingIds.value.delete(normalizedId)
  }
}

const handleKeyDown = (event) => {
  if (!moviesList?.length) return

  const focusedCard =
    event.target?.classList?.contains('movie-card') ? event.target : document.activeElement

  if (!focusedCard?.classList?.contains('movie-card')) {
    return
  }

  const focusedIndex = movieRefs.value.findIndex((element) => element === focusedCard)
  // Multiple lists can remain mounted while search hides the history.
  if (focusedIndex < 0) return
  const currentIndex = focusedIndex
  let nextIndex = null

  const grid = focusedCard.closest('.grid')
  const gridStyle = window.getComputedStyle(grid)
  const columns = gridStyle.gridTemplateColumns.split(' ').length

  switch (event.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % moviesList.length
      break
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + moviesList.length) % moviesList.length
      break
    case 'ArrowUp':
      event.preventDefault()
      if (currentIndex <= 0) {
        const searchInput = document.querySelector('.search-input')
        if (searchInput) {
          searchInput.focus()
        }
      } else {
        nextIndex = Math.max(currentIndex - columns, 0)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      nextIndex = Math.min(currentIndex + columns, moviesList.length - 1)
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = moviesList.length - 1
      break
    case 'Enter':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        window.open(movieUrl(moviesList[currentIndex]), '_blank')
      } else {
        router.push(getMovieSeoPath(moviesList[currentIndex]))
      }
      break
  }

  if (nextIndex !== null && movieRefs.value[nextIndex]) {
    movieRefs.value[nextIndex].scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
    movieRefs.value[nextIndex].focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* Posters are the interface: dense auto-fill grid, text under each poster. */
.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 28px 16px;
  box-sizing: border-box;
  width: 100%;
  min-height: 300px;
  margin: 0 auto;
  padding: 0 24px;
}

.grid.card-size-small {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.grid.card-size-large {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.grid.variant-related {
  min-height: 0;
}

/* "Продолжить просмотр": one horizontal ribbon of small posters on desktop. */
.grid.grid--ribbon {
  display: flex;
  gap: 16px;
  min-height: 0;
  margin: -8px auto 0;
  padding: 8px 24px 10px;
  overflow-x: auto;
  scroll-padding-inline: 24px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.grid.grid--ribbon > :deep(*) {
  flex: 0 0 96px;
  width: 96px;
  scroll-snap-align: start;
}

.grid.grid--ribbon :deep(.card-meta) {
  font-size: var(--fs-xs);
}

.grid.grid--ribbon :deep(.movie-header h3) {
  font-size: var(--fs-s);
}

.grid.grid--ribbon :deep(.poster-action) {
  display: none;
}

@media (max-width: 620px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 10px;
    padding: 0 12px;
  }

  .grid.card-size-small,
  .grid.card-size-large {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .grid.grid--rows {
    grid-template-columns: 1fr;
    gap: 8px;
    min-height: 0;
  }
}
</style>
