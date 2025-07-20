<template>
  <div class="profile-container">
    <div class="profile-header">
      <h1>Профиль</h1>
    </div>

    <div class="profile-content" v-if="user">
      <div class="profile-photo">
        <img v-lazy="photoURL" alt="Profile Photo" v-if="user.photo && photoURL" />
        <div class="photo-placeholder" v-else>
          {{ String.fromCodePoint(user.name.codePointAt(0)).toLocaleUpperCase() }}
        </div>
      </div>

      <div class="profile-info">
        <div class="info-item">
          <label>Имя:</label>
          <div class="editable-field">
            <span v-if="!isEditingName" @click="startEditName" class="editable-text">
              {{ user.name }}
              <i class="fas fa-edit edit-icon"></i>
            </span>
            <div v-else class="edit-input-container">
              <input
                v-model="editingName"
                @keyup.enter="saveName"
                @keyup.esc="cancelEditName"
                @blur="saveName"
                ref="nameInput"
                class="edit-input"
                maxlength="50"
              />
              <button @click="saveName" class="save-btn">✓</button>
              <button @click="cancelEditName" class="cancel-btn">✕</button>
            </div>
          </div>
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
import { ref, onMounted, nextTick } from 'vue'
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
    const isEditingName = ref(false)
    const editingName = ref('')
    const nameInput = ref(null)

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

    const startEditName = () => {
      editingName.value = user.value.name
      isEditingName.value = true
      nextTick(() => {
        nameInput.value?.focus()
        nameInput.value?.select()
      })
    }

    const saveName = async () => {
      if (editingName.value.trim() && editingName.value.trim() !== user.value.name) {
        try {
          await authStore.updateUserName(editingName.value.trim())
          user.value.name = editingName.value.trim()
        } catch (error) {
          console.error('Ошибка при обновлении имени:', error)
        }
      }
      isEditingName.value = false
    }

    const cancelEditName = () => {
      isEditingName.value = false
      editingName.value = ''
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
      photoURL,
      isEditingName,
      editingName,
      nameInput,
      startEditName,
      saveName,
      cancelEditName
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
  border: 2px solid var(--accent-color);
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
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.info-item label {
  font-weight: bold;
  color: #555;
}

.editable-field {
  flex: 1;
  margin-left: 10px;
}

.editable-text {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.editable-text:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.edit-icon {
  font-size: 12px;
  color: #999;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.editable-text:hover .edit-icon {
  opacity: 1;
  color: var(--accent-color);
}

.edit-input-container {
  display: flex;
  align-items: center;
  gap: 5px;
}

.edit-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  color: #333;
}

.save-btn,
.cancel-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.save-btn {
  background-color: #10b981;
  color: white;
}

.save-btn:hover {
  background-color: #059669;
}

.cancel-btn {
  background-color: #ef4444;
  color: white;
}

.cancel-btn:hover {
  background-color: #dc2626;
}

.logout-btn {
  margin-top: 30px;
  padding: 10px 20px;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background-color: var(--accent-hover);
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
  border-bottom: 1px solid var(--accent-color);
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
