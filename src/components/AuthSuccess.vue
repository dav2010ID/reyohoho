<template>
  <div class="auth-success-container">
    <div v-if="loading" class="loading-message">
      <p>Происходит авторизация...</p>
      <div class="spinner"></div>
    </div>
    <div v-if="moveHistory" class="loading-message2">
      <p>Переносим историю...</p>
      <div class="spinner"></div>
    </div>
    <div v-if="error" class="error-message">
      <p>Ошибка авторизации: {{ error }}</p>
      <router-link to="/login" class="retry-button">Попробовать снова</router-link>
    </div>
    <div v-if="success" class="success-message">
      <p>Авторизация прошла успешно!</p>
      <router-link to="/" class="home-button">На главную</router-link>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import { ref, onMounted } from 'vue'
import { getMyLists, addToList, getUser } from '@/api/user'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { getKpInfo } from '@/api/movies'
import { getLocalList } from '@/utils/localUserLists'
export default {
  name: 'AuthSuccess',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const mainStore = useMainStore()
    const loading = ref(true)
    const moveHistory = ref(false)
    const success = ref(false)
    const error = ref(null)
    const base = ref(import.meta.env.VITE_BASE_URL || '/')

    const processAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')

        if (!token) {
          throw new Error('Токен авторизации не найден')
        }
        authStore.setToken(token)

        window.history.replaceState({}, document.title, `${base.value}auth-success`)

        let user = await getUser()
        authStore.setUser(user)
        const localHistory = [...mainStore.history]
        const syncedListTypes = [
          USER_LIST_TYPES_ENUM.FAVORITE,
          USER_LIST_TYPES_ENUM.LATER,
          USER_LIST_TYPES_ENUM.WATCHING,
          USER_LIST_TYPES_ENUM.COMPLETED,
          USER_LIST_TYPES_ENUM.ABANDONED
        ]
        const localLists = new Map(
          syncedListTypes.map((type) => [type, [...getLocalList(type)]])
        )
        let response = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
        loading.value = false
        moveHistory.value = true
        try {
          const candidates = new Map()
          for (const title of response) candidates.set(String(title.kp_id), title)
          for (const title of localHistory) candidates.set(String(title.kp_id), title)

          for (const title of [...candidates.values()].reverse()) {
            let metadata = title
            const needsMetadata =
              !title.title ||
              !title.poster ||
              (title.rating_kinopoisk == null && title.rating_kp == null)
            if (needsMetadata) {
              try {
                const movie = await getKpInfo(title.kp_id)
                metadata = {
                  ...movie,
                  ...title,
                  title: title.title || movie?.name_ru || movie?.name_original || '',
                  poster: title.poster || movie?.poster_url_preview || movie?.poster_url || ''
                }
              } catch (metadataError) {
                console.warn(`Не удалось дополнить историю для ${title.kp_id}`, metadataError)
              }
            }
            await addToList(title.kp_id, USER_LIST_TYPES_ENUM.HISTORY, metadata)
          }
          response = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
          mainStore.setHistory(response)

          for (const type of syncedListTypes) {
            const serverList = await getMyLists(type)
            const merged = new Map(
              [...serverList, ...(localLists.get(type) || [])].map((item) => [
                String(item.kp_id),
                item
              ])
            )
            for (const item of merged.values()) {
              await addToList(item.kp_id, type, item)
            }
            await getMyLists(type)
          }
        } catch (err) {
          console.error('Auth error:', err)
          error.value = 'Произошла ошибка при переноси истории, попробуйте позднее...'
          moveHistory.value = false
        }
        moveHistory.value = false
        success.value = true
        setTimeout(async () => {
          await router.push({ path: '/' })
          router.go(0)
        }, 2000)
      } catch (err) {
        console.error('Auth error:', err)
        error.value = err.message
        loading.value = false
      }
    }

    onMounted(() => {
      processAuth()
    })

    return {
      loading,
      success,
      moveHistory,
      error
    }
  }
}
</script>

<style scoped>
.auth-success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
  padding: 20px;
}

.loading-message,
.loading-message2,
.success-message,
.error-message {
  max-width: 400px;
  padding: 20px;
  border-radius: 8px;
}

.loading-message {
  background-color: #1d1d1d;
}

.success-message {
  background-color: #1d1d1d;
  color: white;
}

.error-message {
  background-color: #1d1d1d;
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  border-radius: 8px;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid var(--accent-color);
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.retry-button,
.home-button {
  display: inline-block;
  margin-top: 15px;
  padding: 8px 16px;
  background-color: var(--accent-color);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.retry-button:hover,
.home-button:hover {
  background-color: var(--accent-hover);
}
</style>
