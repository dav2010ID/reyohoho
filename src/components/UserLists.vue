<template>
  <div class="wrapper">
    <div class="user-lists-page" tabindex="0">
      <div class="controls">
        <div class="filter-card type-card">
          <div class="button-group type-buttons">
            <i class="material-icons card-icon">movie</i>
            <button
              v-for="(btn, idx) in typeFilters"
              :key="idx"
              class="filter-btn type-btn"
              :class="{ active: typeFilter === btn.value }"
              @click="changeTypeFilter(btn.value)"
            >
              {{ btn.label }}
              <span class="counter" v-if="listCounters[btn.value]"
                >({{ listCounters[btn.value] }})</span
              >
            </button>
            <button class="share-btn" @click="copyShareLink()">
              <span class="material-icons">{{ 'share' }}</span>
            </button>
            <button
              v-if="
                movies.length > 0 && (!user_id || String(user_id) === String(authStore.user?.id))
              "
              class="clear-btn"
              @click="showModal = true"
            >
              <span class="material-icons">{{ 'delete_sweep' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="movies.length === 0 && !loading" class="empty-state">
        <span class="material-icons">movie</span>
        <p>Нет фильмов для отображения</p>
      </div>

      <MovieList
        v-else-if="!errorMessage"
        :movies-list="movies"
        :is-history="false"
        :is-mobile="mainStore.isMobile"
        :is-user-list="true"
        :loading="loading"
        @item-deleted="handleItemDeleted"
      />

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />
    </div>
  </div>
  <Notification ref="notificationRef" />
  <BaseModal
    :is-open="showModal"
    message="Вы уверены, что хотите очистить список?"
    @confirm="clearList"
    @close="showModal = false"
  />
</template>

<script setup>
import { getMyLists, getUserLists, delFromList, delAllFromList, getListCounters } from '@/api/user'
import { useAuthStore } from '@/store/auth'
import { handleApiError, USER_LIST_TYPES_ENUM } from '@/constants'
import { MovieList } from '@/components/MovieList'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorMessage from '@/components/ErrorMessage.vue'
import Notification from '@/components/notification/ToastMessage.vue'
import BaseModal from '@/components/BaseModal.vue'
import { useMainStore } from '@/store/main'

const movies = ref([])
const loading = ref(true)
const typeFilter = ref(USER_LIST_TYPES_ENUM.FAVORITE)
const errorMessage = ref('')
const errorCode = ref(null)
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const user_id = ref(route.params.user_id)
const showModal = ref(false)
const listCounters = ref({})
const mainStore = useMainStore()

const notificationRef = ref(null)
const copyShareLink = async () => {
  try {
    if (user_id.value) {
      await navigator.clipboard.writeText(`${window.location.href}`)
    } else {
      await navigator.clipboard.writeText(`${window.location.href}/${authStore.user.id}`)
    }
    notificationRef.value.showNotification('Скопировано')
  } catch (err) {
    console.error('Ошибка копирования:', err)
  }
}

const typeFilters = [
  { label: 'Избранное', value: USER_LIST_TYPES_ENUM.FAVORITE },
  { label: 'Смотрю', value: USER_LIST_TYPES_ENUM.WATCHING },
  { label: 'Позже', value: USER_LIST_TYPES_ENUM.LATER },
  { label: 'Просмотрено', value: USER_LIST_TYPES_ENUM.COMPLETED },
  { label: 'Брошено', value: USER_LIST_TYPES_ENUM.ABANDONED }
]

const fetchCounters = async () => {
  try {
    const targetUserId = user_id.value || authStore.user?.id
    if (targetUserId) {
      listCounters.value = await getListCounters(targetUserId)
    }
  } catch (error) {
    console.error('Error fetching counters:', error)
  }
}

const fetchMovies = async () => {
  loading.value = true
  errorMessage.value = ''
  errorCode.value = null

  try {
    if (user_id.value) {
      movies.value = await getUserLists(typeFilter.value, user_id.value)
    } else {
      movies.value = await getMyLists(typeFilter.value)
    }
    await fetchCounters()
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    movies.value = []
  } finally {
    loading.value = false
  }
}

const changeTypeFilter = (value) => {
  typeFilter.value = value
  fetchMovies()
}

const clearList = async () => {
  loading.value = true
  if (authStore.token) {
    try {
      await delAllFromList(typeFilter.value)
      movies.value = []
      notificationRef.value.showNotification('Список очищен')
    } catch (error) {
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      console.error('Ошибка при очистке списка:', error)
      if (code === 401) {
        authStore.logout()
        await router.push('/login')
        router.go(0)
      }
    }
  }
  loading.value = false
  showModal.value = false
}

const handleItemDeleted = async (deletedItemId) => {
  if (authStore.token) {
    try {
      await delFromList(deletedItemId, typeFilter.value)
      movies.value = movies.value.filter((item) => item.kp_id !== deletedItemId)
      notificationRef.value.showNotification('Фильм удален из списка')
      await fetchCounters()
    } catch (error) {
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      console.error('Ошибка при удалении фильма:', error)
      if (code === 401) {
        authStore.logout()
        await router.push('/login')
        router.go(0)
      }
    }
  }
}

onMounted(fetchMovies)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.material-icons {
  font-size: 1.1em;
}

.empty-state .material-icons {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.wrapper {
  display: flex;
  min-height: 100vh;
}

.user-lists-page {
  flex: 1;
  padding-top: 20px;
  padding-bottom: 40px;
  max-width: calc(258px * 5);
  margin: 0 auto;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.filter-card {
  max-width: 800px;
  width: 100%;
  background: #252525;
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  margin: 0 auto;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  position: relative;
}

.card-title {
  font-weight: 600;
  color: #e0e0e0;
  font-size: 1.1em;
  position: relative;
  z-index: 1;
}

.card-title::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #ff6b35, #ff44cc);
  border-radius: 2px;
  opacity: 0.6;
  z-index: -1;
}

.card-icon {
  font-size: 24px;
  color: #ff6b35;
  transition: color 0.3s;
}

.type-card .card-icon {
  color: #4a90e2;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: nowrap;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  justify-content: space-between;
  width: 100%;
  align-items: center;
}

.button-group::-webkit-scrollbar {
  display: none;
}

.share-btn {
  padding: 10px 10px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #2d2d2d;
  color: #e0e0e0;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.share-btn:hover {
  background: #3a3a3a;
}

.clear-btn {
  padding: 10px 10px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #2d2d2d;
  color: #e0e0e0;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.clear-btn:hover {
  background: #3a3a3a;
}

.filter-btn {
  padding: 10px 15px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #2d2d2d;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  white-space: nowrap;
  flex: 1 1 calc(25% - 10px);
  min-width: 100px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.filter-btn:hover {
  background: #3a3a3a;
}

.filter-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.time-btn.active {
  background: #ff6b35;
  border-color: #ff6b35;
  color: white;
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
}

.type-btn.active {
  background: #4a90e2;
  border-color: #4a90e2;
  color: white;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
}

.counter {
  font-size: 0.8em;
  margin-left: 4px;
  opacity: 0.8;
}

.filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

@media (max-width: 620px) {
  .user-lists-pagem {
    max-width: 100%;
    padding: 0 5px 5px 5px;
  }

  .filter-card {
    max-width: 100%;
    padding: 10px;
  }

  .controls {
    margin-bottom: 5px;
    gap: 5px;
  }

  .card-icon {
    display: none;
  }

  .filter-btn,
  .share-btn {
    flex: 1 1 48%;
  }
}

@media (max-width: 480px) {
  .filter-card {
    padding: 0px;
    margin: 0px;
    background: none;
  }

  .card-header {
    margin-bottom: 5px;
  }

  .button-group {
    flex-wrap: nowrap;
    justify-content: center;
    gap: 3px;
  }

  .filter-btn,
  .share-btn {
    flex: 1 1 45%;
    min-width: 30px;
    padding: 8px 8px;
    font-size: 0.8em;
    margin: 5px 0;
  }
}

@media (max-width: 750px) {
  .button-group {
    flex-wrap: wrap;
  }
}
</style>
