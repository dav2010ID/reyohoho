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

    const processAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')

        if (!token) {
          throw new Error('Токен авторизации не найден')
        }
        authStore.setToken(token)

        window.history.replaceState({}, document.title, '/auth-success')

        let user = await getUser()
        authStore.setUser(user)
        let response = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
        console.log(`response.length: ${response.length}`)
        if (response.length !== 0) {
          loading.value = false

          success.value = true
          setTimeout(async () => {
            await router.push({ path: '/' })
            router.go(0)
          }, 2000)
          return
        }
        loading.value = false
        moveHistory.value = true
        try {
          for (const title of [...mainStore.history].reverse()) {
            await addToList(title.kp_id, USER_LIST_TYPES_ENUM.HISTORY)
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
        console.log(response)
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
  color: white;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4caf50;
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
  background-color: #4caf50;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.retry-button:hover,
.home-button:hover {
  background-color: #242424;
}
</style>
