<template>
  <transition name="modal">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal modern-dark-dialog random-movie-modal">
        <div class="modal-header">
          <h3>
            <i class="fas fa-dice"></i>
            Случайный фильм
          </h3>
          <button class="close-btn" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-content">
          <div v-if="loading" class="loading-container">
            <div class="spinner"></div>
            <p>Подбираем фильм...</p>
          </div>

          <div v-else-if="movie" class="movie-content">
            <div class="movie-poster-section">
              <img
                v-lazy="movie.cover"
                :alt="movie.title"
                class="movie-poster"
                @error="handleImageError"
              />
            </div>

            <div class="movie-info-section">
              <h4 class="movie-title">{{ movie.title }}</h4>

              <div v-if="movie.year" class="movie-year">
                {{ movie.year }}
              </div>

              <div v-if="movie.type" class="movie-type">
                {{ formatType(movie.type) }}
              </div>

              <div v-if="movie.countries" class="movie-countries">
                <strong>Страны:</strong> {{ movie.countries }}
              </div>

              <div v-if="movie.genres" class="movie-genres">
                <strong>Жанры:</strong> {{ movie.genres }}
              </div>

              <div class="ratings">
                <div v-if="movie.rating_reyohoho" class="rating rating-our">
                  <img src="/icons/icon-192x192.png" alt="ReYohoho" class="rating-logo" />
                  {{ movie.rating_reyohoho.toFixed(1) }}
                </div>

                <div v-if="movie.rating_kp" class="rating rating-kp">
                  <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
                  {{ movie.rating_kp }}
                </div>

                <div v-if="movie.rating_imdb" class="rating rating-imdb">
                  <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
                  {{ movie.rating_imdb }}
                </div>
              </div>

              <div class="external-links">
                <a v-if="movie.url_kp" :href="movie.url_kp" target="_blank" class="external-link">
                  <img src="/src/assets/icon-kp-logo.svg" alt="КП" />
                  Кинопоиск
                </a>
                <a
                  v-if="movie.url_imdb"
                  :href="movie.url_imdb"
                  target="_blank"
                  class="external-link"
                >
                  <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" />
                  IMDb
                </a>
              </div>
            </div>
          </div>

          <div v-else-if="error" class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <p>{{ error }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <button class="modern-dark-btn" @click="close">Закрыть</button>
          <router-link
            v-if="movie && !loading"
            :to="{ name: 'movie-info', params: { kp_id: movie.kp_id } }"
            class="modern-dark-btn primary"
            @click="close"
          >
            Посмотреть
          </router-link>
          <button class="modern-dark-btn primary" :disabled="loading" @click="getNewMovie">
            <i class="fas fa-dice"></i>
            Еще раз
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  isOpen: Boolean,
  movie: Object,
  loading: Boolean,
  error: String
})

const emit = defineEmits(['close', 'get-new-movie'])

const close = () => {
  emit('close')
}

const getNewMovie = () => {
  emit('get-new-movie')
}

const formatType = (type) => {
  const typeMap = {
    'FilmType.FILM': 'Фильм',
    'FilmType.TV_SERIES': 'Сериал',
    'FilmType.TV_SHOW': 'ТВ-шоу',
    'FilmType.MINI_SERIES': 'Мини-сериал'
  }
  return typeMap[type] || type
}

const handleImageError = (event) => {
  event.target.src = '/src/assets/image-no-poster.gif'
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: overlay-in 0.3s;
}

.modal {
  transform: translateY(-50px);
  animation: modal-in 0.3s forwards;
}

.random-movie-modal {
  width: 600px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modern-dark-dialog {
  background-color: #1d1d1d;
  color: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.25);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--accent-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  color: #e2e8f0;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-btn:hover {
  opacity: 1;
}

.modal-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  color: #ff6b6b;
}

.error-content i {
  font-size: 3rem;
}

.movie-content {
  display: flex;
  gap: 20px;
}

.movie-poster-section {
  flex-shrink: 0;
}

.movie-poster {
  width: 150px;
  height: 225px;
  object-fit: cover;
  border-radius: 8px;
}

.movie-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.movie-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.3;
}

.movie-year {
  font-size: 1.1rem;
  color: #a0a0a0;
}

.movie-type {
  background: var(--accent-color);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  align-self: flex-start;
}

.movie-countries,
.movie-genres {
  font-size: 0.9rem;
  line-height: 1.4;
}

.movie-countries strong,
.movie-genres strong {
  color: #a0a0a0;
}

.ratings {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.rating {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 10px;
  border-radius: 6px;
  font-weight: 600;
}

.rating-logo {
  width: 20px;
  height: 20px;
}

.total-ratings {
  font-size: 0.8rem;
  opacity: 0.7;
}

.external-links {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.external-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  text-decoration: none;
  color: #e2e8f0;
  font-size: 0.9rem;
  transition: background 0.2s ease;
}

.external-link:hover {
  background: rgba(255, 255, 255, 0.2);
}

.external-link img {
  width: 16px;
  height: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #333;
}

.modern-dark-btn {
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  background-color: #242424;
  color: #e2e8f0;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.modern-dark-btn:hover {
  background-color: #2b2b2b;
}

.modern-dark-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modern-dark-btn.primary {
  background-color: var(--accent-color);
  color: white;
}

.modern-dark-btn.primary:hover {
  background-color: var(--accent-hover-color);
}

@keyframes modal-in {
  to {
    transform: translateY(0);
  }
}

@keyframes overlay-in {
  from {
    backdrop-filter: blur(0);
  }
  to {
    backdrop-filter: blur(4px);
  }
}

@media (max-width: 768px) {
  .random-movie-modal {
    width: 95vw;
    margin: 0 10px;
  }

  .movie-content {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .movie-poster {
    width: 120px;
    height: 180px;
  }

  .modal-actions {
    flex-direction: column;
    gap: 8px;
    padding: 16px 20px;
  }

  .modal-actions .modern-dark-btn,
  .modal-actions a.modern-dark-btn {
    width: 100%;
    justify-content: center;
    box-sizing: border-box;
  }
}
</style>
