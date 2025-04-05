<template>
  <div class="profile-container">
    <div class="profile-header">
      <h1>Профиль</h1>
    </div>

    <div class="profile-content" v-if="user">
      <div class="profile-photo">
        <img :src="photoURL" alt="Profile Photo" v-if="user.photo && photoURL" />
        <div class="photo-placeholder" v-else>
          {{ String.fromCodePoint(user.name.codePointAt(0)).toLocaleUpperCase() }}
        </div>
      </div>

      <div class="profile-info">
        <div class="info-item">
          <label>Имя:</label>
          <span>{{ user.name }}</span>
        </div>

        <div class="info-item">
          <label>Никнейм:</label>
          <span>{{ user.username ?? 'Не указан' }}</span>
        </div>
      </div>

      <button class="logout-btn" @click="confirmLogout">Выйти</button>
    </div>

    <div class="loading" v-else>Загрузка профиля...</div>

    <div class="dialog-overlay" v-if="showDialog">
      <div class="dialog modern-dark-dialog">
        <div class="dialog-header">
          <h3>Выход</h3>
        </div>
        <div class="dialog-body">
          <p>Вы уверены?</p>
        </div>
        <div class="dialog-footer">
          <button class="modern-dark-btn" @click="showDialog = false">Отмена</button>
          <button class="modern-dark-btn danger" @click="logout">Выйти</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { getBaseURL } from '@/api/axios'

export default {
  name: 'ProfilePage',

  setup() {
    const showDialog = ref(false)
    const authStore = useAuthStore()
    const router = useRouter()
    const user = ref(authStore.user)
    const photoURL = ref(null)

    const confirmLogout = () => {
      showDialog.value = true
    }

    const logout = async (openLogin = false) => {
      showDialog.value = false
      authStore.logout()
      if (openLogin) {
        await router.push('/')
      } else {
        await router.push('/login')
      }
      router.go(0)
    }

    onMounted(async () => {
      if (!user.value) {
        logout(true)
      }

      if (user.value.photo) {
        const baseURL = await getBaseURL()
        photoURL.value = `${baseURL}${user.value.photo}`
      }
    })

    return {
      user,
      showDialog,
      confirmLogout,
      logout,
      photoURL
    }
  }
}
</script>

<style scoped>
.profile-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.profile-header {
  text-align: center;
  margin-bottom: 30px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.profile-photo {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  font-size: 60px;
  color: #666;
}

.profile-info {
  width: 100%;
  max-width: 300px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.info-item label {
  font-weight: bold;
  color: #555;
}

.logout-btn {
  margin-top: 30px;
  padding: 10px 20px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background-color: #cc0000;
}

.loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 400px;
  width: 100%;
}
/* Modern Dark Dialog */
.modern-dark-dialog {
  background-color: #1d1d1d;
  color: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  width: 320px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.25);
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #4caf50;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.dialog-body {
  padding: 20px;
}

.dialog-body p {
  margin: 0;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
}

.modern-dark-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background-color: #242424;
  color: #e2e8f0;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.modern-dark-btn:hover {
  background-color: #2b2b2b;
}

.modern-dark-btn.danger {
  background-color: #7f1d1d;
  color: #fecaca;
}

.modern-dark-btn.danger:hover {
  background-color: #991b1b;
}
</style>
