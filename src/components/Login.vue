<template>
  <div class="login-page">
    <h1>Вход в систему</h1>
    <div class="login-container dark-theme">
      <div v-if="loading" class="loading-container">
        <div class="loader"></div>
        <p>Загрузка данных...</p>
      </div>

      <div v-else class="login-methods">
        <!-- Кнопка входа через Telegram -->
        <div class="telegram-btn-container">
          <button class="telegram-btn" @click="loginWithTelegram">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512" class="telegram-icon">
              <path
                d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z"
              />
            </svg>
            Войти через Telegram
          </button>
        </div>

        <!-- Разделитель -->
        <div class="divider">
          <span>или</span>
        </div>

        <!-- Кнопка для показа QR-кода -->
        <div class="qr-btn-container">
          <button class="qr-btn" @click="showQRModal">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="qr-icon">
              <path
                d="M0 224h192V32H0v192zM64 96h64v64H64V96zm192-64v192h192V32H256zm128 128h-64V96h64v64zM0 480h192V288H0v192zm64-128h64v64H64v-64zm352-64h32v32h-32v-32zm0 64h32v32h-32v-32zm0 64h32v32h-32v-32zm-64-64h32v32h-32v-32zm0 64h32v32h-32v-32zm0 64h32v32h-32v-32zm-64-192h32v32h-32v-32zm0 64h32v32h-32v-32zm0 64h32v32h-32v-32zm0 64h32v32h-32v-32zm64-256h32v32h-32v-32zm0 64h32v32h-32v-32zm64-64h32v32h-32v-32z"
              />
            </svg>
            Войти через QR-код
          </button>
        </div>
      </div>

      <!-- Модальное окно с QR-кодом -->
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-qr-title"
          @click.stop
        >
          <div class="modal-header">
            <h3 id="telegram-qr-title">Вход через QR-код</h3>
            <button class="close-btn" aria-label="Закрыть QR-код" @click="closeModal">
              &times;
            </button>
          </div>
          <div class="modal-body">
            <p class="qr-hint">Отсканируйте QR-код для входа через Telegram</p>
            <div class="qr-background">
              <qrcode-vue v-if="!error" :value="qrValue" :size="qrSize" level="H" class="qr-code" />
              <div v-else class="error-placeholder">Ошибка загрузки QR-кода</div>
            </div>
            <p class="qr-hint">Используйте любое приложение для сканирования QR-кода</p>
            <p class="qr-hint">
              Передаётся только временный токен сайта через Telegram-бота, авторизация самого
              Telegram не нужна
            </p>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-message" role="alert" aria-live="polite">
        {{ error }}
        <button type="button" class="retry-btn" :disabled="loading" @click="retryAuth">
          Повторить
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount, onMounted } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { generateToken, getTGAuthResult } from '@/api/user'
import { createTelegramAuthPoller } from '@/utils/telegramAuthPoller'

export default {
  components: {
    QrcodeVue
  },
  setup() {
    const qrValue = ref('')
    const authValue = ref('')
    const qrSize = ref(250)
    const loading = ref(true)
    const error = ref(null)
    const popup = ref(null)
    const base = ref(import.meta.env.VITE_BASE_URL || '/')
    const showModal = ref(false)
    let popupCloseTimeout = null

    const closePopup = () => {
      if (popupCloseTimeout) {
        clearTimeout(popupCloseTimeout)
        popupCloseTimeout = null
      }
      if (popup.value && !popup.value.closed) {
        popup.value.close()
      }
      popup.value = null
    }

    const authPoller = createTelegramAuthPoller({
      checkAuth: getTGAuthResult,
      onAuthenticated: (accessToken) => {
        closePopup()
        window.location.href = `${base.value}auth-success?token=${accessToken}`
      },
      onExpired: () => {
        error.value = 'Время ожидания входа истекло. Создайте новый QR-код.'
      },
      onError: (pollError) => {
        console.warn('Ошибка проверки статуса Telegram-входа:', pollError)
      }
    })

    const initAuth = async () => {
      authPoller.stop()
      error.value = null
      loading.value = true
      try {
        const generateTokenResponse = await generateToken()
        const token = generateTokenResponse.token
        const authURL = generateTokenResponse.telegram_link
        qrValue.value = authURL
        authValue.value = authURL
        loading.value = false
        authPoller.start(token, generateTokenResponse.expires_in)
      } catch (err) {
        error.value = 'Не удалось получить данные для входа. Пожалуйста, попробуйте позже.'
        loading.value = false
        console.error('Ошибка при инициализации аутентификации:', err)
      }
    }

    function loginWithTelegram() {
      if (authValue.value) {
        closePopup()
        popup.value = window.open(authValue.value, 'tg_open')
        popupCloseTimeout = setTimeout(closePopup, 3000)
      } else {
        error.value = 'URL для входа не доступен'
      }
    }

    function showQRModal() {
      showModal.value = true
    }

    function closeModal() {
      showModal.value = false
    }

    const retryAuth = () => initAuth()

    onMounted(async () => {
      await initAuth()
    })

    onBeforeUnmount(() => {
      authPoller.stop()
      closePopup()
    })

    return {
      qrValue,
      qrSize,
      loading,
      error,
      loginWithTelegram,
      showModal,
      showQRModal,
      closeModal,
      retryAuth
    }
  }
}
</script>

<style scoped>
.login-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
  color: #e0e0e0;
}

.login-container {
  max-width: 450px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--accent-transparent);
}

.dark-theme {
  background: #2a2a2a;
  color: #e0e0e0;
}

h1 {
  text-align: center;
  margin-bottom: 2.5rem;
  color: #ffffff;
  font-size: 2rem;
  font-weight: 500;
}

.login-methods {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.telegram-btn-container {
  margin-bottom: 1rem;
}

.telegram-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.telegram-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.telegram-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.divider {
  display: flex;
  align-items: center;
  color: #aaa;
  font-size: 0.9rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #444;
}

.divider::before {
  margin-right: 0.5rem;
}

.divider::after {
  margin-left: 0.5rem;
}

.qr-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.qr-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.qr-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.qr-hint {
  color: #aaa;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

/* Анимации */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-container {
  animation: fadeIn 0.5s ease-out;
}

.telegram-btn {
  animation: fadeIn 0.7s ease-out;
}

.qr-section {
  animation: fadeIn 0.9s ease-out;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background-color: #1e1e1e;
  padding: 2rem;
  border-radius: 10px;
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #aaa;
  cursor: pointer;
}

.qr-background {
  background: white;
  padding: 10px;
  border-radius: 5px;
  display: inline-block;
}

.qr-code {
  margin: 0 auto;
}

.retry-btn {
  display: block;
  margin: 12px auto 0;
  padding: 8px 16px;
  border: 0;
  border-radius: 5px;
  background: var(--accent-color);
  color: #fff;
  cursor: pointer;
}

.retry-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
