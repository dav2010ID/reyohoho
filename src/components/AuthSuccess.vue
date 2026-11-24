<template>
  <div class="auth-success-container">
    <div v-if="loading" class="loading-message">
      <p>Происходит авторизация...</p>
      <div class="spinner"></div>
    </div>
    <div v-if="moveHistory" class="loading-message2">
      <p>Синхронизируем историю и списки...</p>
      <div class="spinner"></div>
    </div>
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <router-link to="/login" class="retry-button">Попробовать снова</router-link>
      <button
        v-if="syncFailed"
        :disabled="loading || moveHistory"
        class="retry-button"
        @click="processAuth"
      >
        Повторить синхронизацию
      </button>
    </div>
    <div v-if="success" class="success-message">
      <p>Авторизация прошла успешно!</p>
      <router-link to="/" class="home-button">На главную</router-link>
    </div>
  </div>
</template>

<script>
import { useConfirmation } from '@/composables/useConfirmation'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getMyLists, getUser, importWorkerList } from '@/api/user'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { getLocalList } from '@/utils/localUserLists'
import { consumeAuthRedirect } from '@/utils/authRedirect'
import { importCloudHistory } from '@/api/cloudHistory'
import { HISTORY_CAPACITY, normalizeHistory } from '../../shared/history-data.js'
import { clearPendingSync, readPendingSync, savePendingSync } from '@/utils/pendingAccountSync'
export default {
  name: 'AuthSuccess',
  setup() {
    const askConfirmation = useConfirmation()
    const router = useRouter()
    const authStore = useAuthStore()
    const mainStore = useMainStore()
    const loading = ref(true)
    const moveHistory = ref(false)
    const success = ref(false)
    const error = ref(null)
    const syncFailed = ref(false)
    let redirectTimeout = null
    let running = false
    let disposed = false

    const processAuth = async () => {
      if (running || disposed) return
      running = true
      loading.value = true
      error.value = null
      syncFailed.value = false
      const token = authStore.token
      try {
        const guestHistory = mainStore.historyOwner === 'guest' ? [...mainStore.history] : []
        if (!authStore.isWorkerSession) {
          if (token) authStore.logout()
          throw new Error('Не удалось подтвердить вход. Войдите через Telegram ещё раз.')
        }
        const assertCurrent = () => {
          if (disposed || authStore.token !== token) throw new Error('Аккаунт изменился')
        }

        let user = await getUser()
        assertCurrent()
        authStore.setUser(user)
        const owner = `worker:${user.id}`
        const syncedListTypes = [
          USER_LIST_TYPES_ENUM.FAVORITE,
          USER_LIST_TYPES_ENUM.LATER,
          USER_LIST_TYPES_ENUM.WATCHING,
          USER_LIST_TYPES_ENUM.COMPLETED,
          USER_LIST_TYPES_ENUM.ABANDONED
        ]
        let pending = readPendingSync(owner)
        if (!pending) {
          pending = {
            history: normalizeHistory(guestHistory, HISTORY_CAPACITY),
            lists: Object.fromEntries(
              syncedListTypes.map((type) => [type, [...getLocalList(type, 'guest')]])
            ),
            approved: false
          }
          savePendingSync(owner, pending)
        }
        const localHistory = pending.history
        const localLists = new Map(syncedListTypes.map((type) => [type, pending.lists[type] || []]))
        let response
        loading.value = false
        moveHistory.value = true
        try {
          response = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY, { fresh: true })
          assertCurrent()
          const hasLocalData =
            localHistory.length || [...localLists.values()].some((items) => items.length)
          if (
            hasLocalData &&
            (pending.approved ||
              await askConfirmation(
                'Синхронизировать локальную историю и списки этого браузера с облаком?'
              ))
          ) {
            assertCurrent()
            pending.approved = true
            savePendingSync(owner, pending)
            if (localHistory.length) response = await importCloudHistory(localHistory)
            assertCurrent()
            pending.history = []
            savePendingSync(owner, pending)
            for (const type of syncedListTypes) {
              const existing = new Set(
                (await getMyLists(type, { fresh: true })).map((item) => String(item.kp_id))
              )
              assertCurrent()
              const missing = (localLists.get(type) || []).filter(item => !existing.has(String(item.kp_id)))
              await importWorkerList(type, missing)
              assertCurrent()
              pending.lists[type] = []
              savePendingSync(owner, pending)
              await getMyLists(type)
            }
            assertCurrent()
            clearPendingSync(owner)
          } else {
            // Keep a local backup if the user declines importing guest history.
            if (localHistory.length)
              localStorage.setItem(
                'reyohoho-guest-history-backup',
                JSON.stringify(normalizeHistory(localHistory, HISTORY_CAPACITY))
              )
            for (const type of syncedListTypes) await getMyLists(type)
          }
          if (authStore.token !== token) throw new Error('Аккаунт изменился')
          mainStore.setHistory(response)
        } catch (err) {
          console.error('Auth error:', err)
          error.value =
            'Не удалось синхронизировать историю и списки. Попробуйте позже в настройках.'
          moveHistory.value = false
          syncFailed.value = true
        }
        moveHistory.value = false
        success.value = true
        if (!syncFailed.value)
          redirectTimeout = setTimeout(async () => {
            if (disposed || authStore.token !== token) return
            await router.replace(consumeAuthRedirect())
          }, 2000)
      } catch (err) {
        if (!disposed && token && authStore.token === token && err.response?.status === 401)
          authStore.logout()
        console.error('Auth error:', err)
        error.value = 'Не удалось завершить вход. Попробуйте войти через Telegram ещё раз.'
        loading.value = false
      } finally {
        running = false
      }
    }

    onMounted(() => {
      processAuth()
    })

    onBeforeUnmount(() => {
      disposed = true
      if (redirectTimeout) {
        clearTimeout(redirectTimeout)
        redirectTimeout = null
      }
    })

    return {
      loading,
      success,
      moveHistory,
      error,
      syncFailed,
      processAuth
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
  border-radius: var(--radius-m);
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
  color: var(--accent-text);
  border: 1px solid var(--accent-ui);
  border-radius: var(--radius-m);
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid var(--accent-ui);
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
  background-color: var(--accent-solid);
  color: var(--accent-contrast);
  text-decoration: none;
  border-radius: var(--radius-s);
  transition: background-color 0.3s;
}

.retry-button:hover,
.home-button:hover {
  background-color: var(--accent-solid-hover);
}
</style>
