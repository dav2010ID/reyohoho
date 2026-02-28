<template>
  <div
    v-if="isVisible"
    class="image-picker"
    @mouseenter="$emit('mouse-enter')"
    @mouseleave="$emit('mouse-leave')"
    @click.stop
  >
    <button class="close-btn mobile-only" @click="$emit('close')">
      <i class="fas fa-times"></i>
    </button>

    <div v-if="!currentUser" class="auth-required">
      <div class="auth-message">
        <i class="fas fa-lock"></i>
        <h3>Требуется авторизация</h3>
        <p>Для поиска изображений необходимо войти в аккаунт</p>
        <button class="login-button" @click="$emit('login-required')">Войти</button>
      </div>
    </div>

    <div v-else>
      <div class="image-picker-header">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Введите название смайла 7tv"
          class="image-search-input"
          @input="handleSearch"
          @click.stop
          @focus="$emit('mouse-enter')"
          @blur="handleInputBlur"
        />
      </div>
      <div class="image-content">
        <div v-if="isLoading" class="loading-spinner">
          <div class="spinner"></div>
          <p>Поиск изображений...</p>
        </div>
        <div v-else-if="images.length > 0" class="image-grid">
          <div
            v-for="(image, index) in images"
            :key="index"
            class="image-item"
            @click="selectImage(image)"
          >
            <img :src="image" :alt="'Image ' + (index + 1)" />
          </div>
        </div>
        <div v-else-if="searchQuery.trim()" class="no-images">
          <p>Нет результатов</p>
        </div>
        <div v-else class="no-search">
          <p>Введите запрос для поиска</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import debounce from 'lodash/debounce'
import { searchEmotes } from '@/api/emotes'

export default {
  name: 'ImagePicker',
  props: {
    isVisible: {
      type: Boolean,
      required: true
    },
    currentUser: {
      type: Object,
      default: null
    }
  },
  emits: ['image-selected', 'mouse-enter', 'mouse-leave', 'close', 'login-required'],
  setup(props, { emit }) {
    const searchQuery = ref('')
    const images = ref([])
    const searchInput = ref(null)
    const isLoading = ref(false)

    const searchImages = async (query) => {
      if (!props.currentUser) {
        console.warn('Попытка поиска изображений без авторизации')
        return
      }

      if (!query.trim()) {
        images.value = []
        isLoading.value = false
        return
      }

      isLoading.value = true
      try {
        images.value = await searchEmotes(query)
      } catch (error) {
        console.error('Error searching images:', error)
        images.value = []
      } finally {
        isLoading.value = false
      }
    }

    const debouncedSearch = debounce(searchImages, 300)

    const handleSearch = () => {
      if (!props.currentUser) {
        emit('login-required')
        return
      }

      if (searchQuery.value.trim()) {
        isLoading.value = true
      }
      debouncedSearch(searchQuery.value)
    }

    const selectImage = (imageUrl) => {
      if (!props.currentUser) {
        emit('login-required')
        return
      }

      emit('image-selected', imageUrl)
      emit('close')
    }

    const handleInputBlur = () => {
      setTimeout(() => {
        if (!props.isVisible) return
        emit('mouse-leave')
      }, 100)
    }

    watch(
      () => props.isVisible,
      (newValue) => {
        if (newValue) {
          searchQuery.value = ''
          images.value = []
          isLoading.value = false
        }
      }
    )

    return {
      searchQuery,
      images,
      searchInput,
      isLoading,
      handleSearch,
      selectImage,
      handleInputBlur
    }
  }
}
</script>

<style scoped>
.image-picker {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 0.5rem;
  padding: 0.75rem;
  z-index: 99999;
  width: 320px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.5rem;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.875rem;
  transition: color 0.2s;
  z-index: 10000;
}

.close-btn:hover {
  color: #fff;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: block;
  }

  .image-picker {
    width: 300px;
    padding-top: 2rem;
  }
}

.auth-required {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-message {
  text-align: center;
  color: #999;
  padding: 2rem 1rem;
}

.auth-message i {
  font-size: 2rem;
  color: #666;
  margin-bottom: 1rem;
}

.auth-message h3 {
  color: #fff;
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.auth-message p {
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.login-button {
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover {
  background: var(--accent-hover);
}

.image-picker-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #444;
}

.image-search-input {
  width: 100%;
  padding: 0.5rem;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 0.375rem;
  color: #fff;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.image-search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.image-search-input::placeholder {
  color: #999;
}

.image-content {
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: #999;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #444;
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-spinner p {
  font-size: 0.9rem;
  margin: 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  max-height: 240px;
  overflow-y: auto;
}

.image-item {
  min-height: 60px;
  max-height: 80px;
  cursor: pointer;
  border-radius: 0.375rem;
  overflow: hidden;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
}

.image-item:hover {
  transform: scale(1.05);
  border-color: var(--accent-semi-transparent);
  background: #333;
}

.image-item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.no-images,
.no-search {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  text-align: center;
  color: #999;
  font-size: 0.9rem;
}

.no-search {
  color: #666;
}

.image-grid::-webkit-scrollbar {
  width: 4px;
}

.image-grid::-webkit-scrollbar-track {
  background: #333;
  border-radius: 2px;
}

.image-grid::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 2px;
}

.image-grid::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>
