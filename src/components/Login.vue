<template>
  <div class="login-container dark-theme">
    <h1>Вход в систему</h1>

    <div v-if="loading" class="loading-container">
      <div class="loader"></div>
      <p>Загрузка данных...</p>
    </div>

    <div v-else class="login-methods">
      <!-- Кнопка входа через Telegram -->
      <div class="telegram-btn-container">
        <button @click="loginWithTelegram" class="telegram-btn">
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

      <!-- QR-код для входа -->
      <div class="qr-section">
        <h3>Отсканируйте QR-код</h3>
        <div class="qr-background">
          <qrcode-vue v-if="!error" :value="qrValue" :size="qrSize" level="H" class="qr-code" />
          <div v-else class="error-placeholder">Ошибка загрузки QR-кода</div>
        </div>
        <p class="qr-hint">
          Используйте любое приложение для сканирования QR(это не QR код приложения телеграмм)
        </p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { generateToken, getTGAuthResult } from '@/api/user'

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

    const initAuth = async () => {
      try {
        const generateTokenResponse = await generateToken()
        const token = generateTokenResponse.token
        const authURL = generateTokenResponse.telegram_link
        qrValue.value = authURL
        authValue.value = authURL
        loading.value = false

        setInterval(async () => {
          const response = await getTGAuthResult(token)
          if (response.authenticated && response.token) {
            if (popup.value) {
              popup.value.close()
              popup.value = null
            }
            window.location.href = `${base.value}auth-success?token=${response.token}`
          }
        }, 2000)
      } catch (err) {
        error.value = 'Не удалось получить данные для входа. Пожалуйста, попробуйте позже.'
        loading.value = false
        console.error('Ошибка при инициализации аутентификации:', err)
      }
    }

    function loginWithTelegram() {
      if (authValue.value) {
        popup.value = window.open(authValue.value, 'tg_open')
        setTimeout(function () {
          if (popup.value) {
            popup.value.close()
            popup.value = null
          }
        }, 3000)
      } else {
        error.value = 'URL для входа не доступен'
      }
    }

    onMounted(async () => {
      await initAuth()
    })

    return {
      qrValue,
      qrSize,
      loading,
      error,
      loginWithTelegram
    }
  }
}
</script>

<style scoped>
.login-container {
  max-width: 450px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.dark-theme {
  background: #1e1e1e;
  color: #e0e0e0;
}

h1 {
  color: #ffffff;
  margin-bottom: 2rem;
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
  background: #0088cc;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.telegram-btn:hover {
  background: #0077b3;
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

.qr-background {
  background: white;
  padding: 10px;
  border-radius: 5px;
  display: inline-block;
}

.qr-code {
  margin: 0 auto;
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
</style>
