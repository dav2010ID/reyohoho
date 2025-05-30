<template>
  <div>
    <div v-show="!loading" class="grid">
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CardMovie, CardMovieSwipeWrapper } from '../CardMovie'
import { delFromList } from '@/api/user'
import { handleApiError } from '@/constants'
import { USER_LIST_TYPES_ENUM } from '@/constants'

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
  showStar = false
} = defineProps({
  moviesList: Array,
  isHistory: Boolean,
  loading: Boolean,
  showDelete: Boolean,
  showStar: Boolean
})

const movieRefs = ref([])
const activeMovieIndex = ref(null)

const isCardBorder = computed(() => backgroundStore.isCardBorder)
const isMobile = computed(() => mainStore.isMobile)
const isUserList = computed(() => {
  return (
    route.name === 'lists' &&
    (!route.params.user_id || String(route.params.user_id) === String(authStore.user?.id))
  )
})

const movieUrl = (movie) => {
  return router.resolve({ name: 'movie-info', params: { kp_id: movie.kp_id } }).href
}

const emit = defineEmits(['item-deleted'])
const removeFromHistory = async (kp_id) => {
  if (authStore.token) {
    try {
      await delFromList(kp_id, USER_LIST_TYPES_ENUM.HISTORY)
      emit('item-deleted', kp_id)
    } catch (error) {
      const { code } = handleApiError(error)
      console.error('Ошибка загрузки истории:', error)
      if (code === 401) {
        authStore.logout()
        await router.push('/login')
        router.go(0)
      }
    }
  } else {
    mainStore.removeFromHistory(kp_id)
  }
}

const handleKeyDown = (event) => {
  if (!moviesList?.length) return

  if (!event.target?.classList?.contains('movie-card')) {
    return
  }

  const grid = document.querySelector('.grid')
  const gridStyle = window.getComputedStyle(grid)
  const columns = gridStyle.gridTemplateColumns.split(' ').length

  switch (event.key) {
    case 'ArrowRight':
      activeMovieIndex.value = (activeMovieIndex.value + 1) % moviesList.length
      break
    case 'ArrowLeft':
      activeMovieIndex.value = (activeMovieIndex.value - 1 + moviesList.length) % moviesList.length
      break
    case 'ArrowUp':
      event.preventDefault()
      if (activeMovieIndex.value <= 0) {
        const searchInput = document.querySelector('.search-input')
        if (searchInput) {
          searchInput.focus()
        }
      } else {
        activeMovieIndex.value = Math.max(activeMovieIndex.value - columns, 0)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      activeMovieIndex.value = Math.min(activeMovieIndex.value + columns, moviesList.length - 1)
      break
    case 'Home':
      activeMovieIndex.value = 0
      break
    case 'End':
      activeMovieIndex.value = moviesList.length - 1
      break
    case 'Enter':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        window.open(movieUrl(moviesList[activeMovieIndex.value]), '_blank')
      } else {
        router.push({
          name: 'movie-info',
          params: { kp_id: moviesList[activeMovieIndex.value]?.kp_id }
        })
      }
      break
  }
}

watch(activeMovieIndex, (newIndex) => {
  if (movieRefs.value[newIndex]) {
    movieRefs.value[newIndex].scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
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

@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 5px;
  }
}
</style>
