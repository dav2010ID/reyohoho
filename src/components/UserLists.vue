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
              <span class="counter" v-if="listCounters[btn.value]">{{
                listCounters[btn.value]
              }}</span>
            </button>
            <button class="share-btn" @click="copyShareLink()" title="Поделиться списком">
              <span class="material-icons">{{ 'share' }}</span>
            </button>
            <button
              v-if="!user_id || String(user_id) === String(authStore.user?.id)"
              class="clear-btn"
              :class="{ disabled: !movies.length || typeFilter === USER_LIST_TYPES_ENUM.RATED }"
              @click="
                movies.length && typeFilter !== USER_LIST_TYPES_ENUM.RATED && (showModal = true)
              "
              title="Очистить список"
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
        :show-delete="typeFilter !== USER_LIST_TYPES_ENUM.RATED"
        :show-star="typeFilter === USER_LIST_TYPES_ENUM.RATED"
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
  { label: 'Брошено', value: USER_LIST_TYPES_ENUM.ABANDONED },
  { label: 'Оценено', value: USER_LIST_TYPES_ENUM.RATED }
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
      await fetchCounters()
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
  box-sizing: border-box;
}

.user-lists-page {
  flex: 1;
  padding-top: 20px;
  padding-bottom: 40px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.controls {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-bottom: 20px;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  box-sizing: border-box;
}

.filter-card {
  width: auto;
  background: rgba(37, 37, 37, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  margin: 0;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  font-size: 18px;
  color: #ff6b35;
  transition: color 0.3s;
  margin-right: 4px;
  opacity: 0.8;
}

.type-card .card-icon {
  color: #4a90e2;
}

.button-group {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  justify-content: flex-start;
  align-items: center;
  padding: 2px;
}

.button-group::-webkit-scrollbar {
  display: none;
}

.share-btn,
.clear-btn {
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(45, 45, 45, 0.6);
  color: #e0e0e0;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.share-btn:hover,
.clear-btn:hover:not(.disabled) {
  background: rgba(58, 58, 58, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.clear-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(26, 26, 26, 0.6);
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(45, 45, 45, 0.6);
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85em;
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: 80px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}

.filter-btn:hover {
  background: rgba(58, 58, 58, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.type-btn.active {
  background: #4a90e2;
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.2);
}

.counter {
  font-size: 0.8em;
  margin-left: 6px;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
  color: #fff;
}

.type-btn.active .counter {
  background: rgba(0, 0, 0, 0.2);
}

.filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

@media (max-width: 900px) {
  .controls {
    flex-direction: column;
    gap: 6px;
    padding: 0 10px;
  }

  .filter-card {
    width: 100%;
  }

  .button-group {
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .controls {
    padding: 0 5px;
    gap: 4px;
  }

  .filter-card {
    padding: 4px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .button-group {
    gap: 3px;
  }

  .card-icon {
    display: none;
  }
}

@media (max-width: 400px) {
  .button-group {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
