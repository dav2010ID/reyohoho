<template>
  <div class="rating-container">
    <div class="rating-display">
      <a
        href="#"
        class="rating-link"
        :class="{ 'has-rating': userRating }"
        @mouseenter="isHovered = true"
        @mouseleave="handleMouseLeave"
        @click.prevent="toggleTooltip"
      >
        <img src="/icons/icon-192x192.png" alt="ReYohoho" class="rating-logo" />
        <span class="average-rating" :class="getRatingColor(averageRating)">{{
          averageRating ? averageRating.toFixed(1).replace(/\.0$/, '') : '—'
        }}</span>
      </a>
      <div
        v-show="(isHovered || isTooltipVisible) && !mainStore.isMobile"
        class="rating-tooltip"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <div class="rating-numbers">
          <button
            v-for="num in 10"
            :key="num"
            class="number-btn"
            :class="{
              active: num === userRating,
              hover: num === hoverRating,
              'average-highlight': averageRating && num <= Math.round(averageRating)
            }"
            @click="setRating(num)"
            @mouseenter="hoverRating = num"
            @mouseleave="hoverRating = 0"
          >
            {{ num }}
          </button>
        </div>
        <div v-if="voteCount" class="tooltip-footer">Оценок: {{ voteCount }}</div>
      </div>
    </div>
    <Notification ref="notificationRef" />

    <div
      v-if="mainStore.isMobile && isTooltipVisible"
      class="mobile-modal-overlay"
      @click="closeModal"
    >
      <div class="mobile-modal" @click.stop>
        <div class="mobile-modal-header">
          <h3>Оценить фильм</h3>
          <button class="close-button" @click="closeModal">&times;</button>
        </div>
        <div class="rating-numbers mobile-rating-numbers">
          <button
            v-for="num in 10"
            :key="num"
            class="number-btn"
            :class="{
              active: num === userRating,
              'average-highlight': averageRating && num <= Math.round(averageRating)
            }"
            @click="setRating(num)"
          >
            {{ num }}
          </button>
        </div>
        <div v-if="voteCount" class="mobile-modal-footer">Оценок: {{ voteCount }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getRating, setRating as setRatingApi } from '@/api/movies'
import Notification from '@/components/notification/ToastMessage.vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/store/main'
import { getRatingColor } from '@/utils/ratingUtils'

const mainStore = useMainStore()
const router = useRouter()
const props = defineProps({
  kpId: {
    type: String,
    required: true
  },
  showDash: {
    type: Boolean,
    default: false
  }
})

const notificationRef = ref(null)
const userRating = ref(null)
const averageRating = ref(null)
const voteCount = ref(null)
const hoverRating = ref(0)
const isHovered = ref(false)
const isTooltipVisible = ref(false)
let hideTimeout = null

const formatRatingNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

const handleMouseLeave = () => {
  hideTimeout = setTimeout(() => {
    isHovered.value = false
    if (!mainStore.isMobile) {
      isTooltipVisible.value = false
    }
  }, 100)
}

const handleMouseEnter = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  isHovered.value = true
}

const toggleTooltip = () => {
  if (mainStore.isMobile) {
    isTooltipVisible.value = !isTooltipVisible.value
  }
}

const openLogin = () => {
  router.push('/login')
}

const loadRating = async () => {
  try {
    const data = await getRating(props.kpId)
    userRating.value = data.user_rating
    averageRating.value = data.average_rating
    voteCount.value = formatRatingNumber(data.vote_count)
  } catch (error) {
    console.error('Error loading rating:', error)
  }
}

const setRating = async (rating) => {
  try {
    if (rating === userRating.value) {
      await setRatingApi(props.kpId, null)
      userRating.value = null
      notificationRef.value.showNotification('Оценка удалена')
    } else {
      await setRatingApi(props.kpId, rating)
      userRating.value = rating
      notificationRef.value.showNotification('Оценка сохранена')
    }

    if (mainStore.isMobile) {
      isTooltipVisible.value = false
    }
    loadRating()
  } catch (error) {
    console.error('Error setting rating:', error)
    if (error.response?.status === 401) {
      notificationRef.value.showNotification(
        'Для оценки необходимо <a class="auth-link">авторизоваться</a>',
        5000,
        { onClick: openLogin }
      )
    } else {
      notificationRef.value.showNotification('Ошибка при сохранении оценки')
    }
    if (mainStore.isMobile) {
      isTooltipVisible.value = false
    }
  }
}

const closeModal = () => {
  isTooltipVisible.value = false
}

onMounted(() => {
  loadRating()
})
</script>

<style scoped>
.rating-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  position: relative;
  min-height: 32px;
}

.rating-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 0;
  padding: 0;
}

.rating-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(224, 224, 224);
  text-decoration: none;
  font-weight: 700;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  padding: 5px 10px;
  margin: 0;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 5px;
  box-sizing: border-box;
  vertical-align: middle;
}

.rating-link.has-rating {
  position: relative;
  padding: 5px 10px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid var(--accent-transparent);
}

.rating-link.has-rating::after {
  content: '★';
  position: absolute;
  top: -6px;
  left: -6px;
  font-size: 12px;
  color: var(--accent-color);
  line-height: 1;
  padding-bottom: 1px;
}

.rating-link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.rating-logo {
  width: 20px;
  height: 20px;
  margin-right: 5px;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.rating-link:hover .rating-logo {
  opacity: 1;
}

.vote-count {
  margin-left: 4px;
  font-size: 14px;
  color: rgba(224, 224, 224, 0.8);
}

.rating-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  z-index: 1000;
  background: #1a1a1a;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  padding: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
  min-width: 220px;
}

.rating-display:hover .rating-tooltip {
  opacity: 1;
}

.rating-numbers {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  justify-content: center;
}

.number-btn {
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  color: rgb(224, 224, 224);
  transition: all 0.2s;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 700;
  font-family: Roboto, sans-serif;
  position: relative;
}

.number-btn:hover {
  transform: scale(1.1);
}

.number-btn.active {
  color: #fff;
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

.number-btn.hover {
  color: #fff;
  transform: scale(1.1);
}

.number-btn.average-highlight {
  color: rgb(224, 224, 224);
}

.number-btn.active.average-highlight {
  color: #fff;
}

.average-rating {
  font-weight: 700;
  color: rgb(224, 224, 224);
  font-size: 16px;
  font-family: Roboto, sans-serif;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
}

.rating-link:hover .average-rating {
  color: #fff;
}

.average-rating.low {
  color: #ff6b6b !important;
}

.average-rating.medium {
  color: #ffd93d !important;
}

.average-rating.high {
  color: #51cf66 !important;
}

.tooltip-footer {
  text-align: center;
  font-size: 12px;
  color: rgba(224, 224, 224, 0.8);
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Color effects for numbers */
.number-btn:nth-child(1):hover {
  color: #ff4444;
  text-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
}
.number-btn:nth-child(2):hover {
  color: #ff6b6b;
  text-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
}
.number-btn:nth-child(3):hover {
  color: #ff8e8e;
  text-shadow: 0 0 8px rgba(255, 142, 142, 0.5);
}
.number-btn:nth-child(4):hover {
  color: #ffb347;
  text-shadow: 0 0 8px rgba(255, 179, 71, 0.5);
}
.number-btn:nth-child(5):hover {
  color: #ffcc33;
  text-shadow: 0 0 8px rgba(255, 204, 51, 0.5);
}
.number-btn:nth-child(6):hover {
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}
.number-btn:nth-child(7):hover {
  color: #9acd32;
  text-shadow: 0 0 8px rgba(154, 205, 50, 0.5);
}
.number-btn:nth-child(8):hover {
  color: #7cfc00;
  text-shadow: 0 0 8px rgba(124, 252, 0, 0.5);
}
.number-btn:nth-child(9):hover {
  color: #32cd32;
  text-shadow: 0 0 8px rgba(50, 205, 50, 0.5);
}
.number-btn:nth-child(10):hover {
  color: #00ff00;
  text-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
}

.number-btn.active:nth-child(1) {
  background: #ff4444;
  box-shadow: 0 0 12px rgba(255, 68, 68, 0.7);
}
.number-btn.active:nth-child(2) {
  background: #ff6b6b;
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.7);
}
.number-btn.active:nth-child(3) {
  background: #ff8e8e;
  box-shadow: 0 0 12px rgba(255, 142, 142, 0.7);
}
.number-btn.active:nth-child(4) {
  background: #ffb347;
  box-shadow: 0 0 12px rgba(255, 179, 71, 0.7);
}
.number-btn.active:nth-child(5) {
  background: #ffcc33;
  box-shadow: 0 0 12px rgba(255, 204, 51, 0.7);
}
.number-btn.active:nth-child(6) {
  background: #ffd700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.7);
}
.number-btn.active:nth-child(7) {
  background: #9acd32;
  box-shadow: 0 0 12px rgba(154, 205, 50, 0.7);
}
.number-btn.active:nth-child(8) {
  background: #7cfc00;
  box-shadow: 0 0 12px rgba(124, 252, 0, 0.7);
}
.number-btn.active:nth-child(9) {
  background: #32cd32;
  box-shadow: 0 0 12px rgba(50, 205, 50, 0.7);
}
.number-btn.active:nth-child(10) {
  background: #00ff00;
  box-shadow: 0 0 12px rgba(0, 255, 0, 0.7);
}

.mobile-tooltip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin-top: 0;
  z-index: 1001;
}

.mobile-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.mobile-modal {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mobile-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.mobile-modal-header h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.close-button:hover {
  opacity: 1;
  color: var(--accent-color);
}

.mobile-rating-numbers {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.mobile-rating-numbers .number-btn {
  font-size: 18px;
  padding: 12px 0;
}

.mobile-modal-footer {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 620px) {
  .rating-container {
    min-height: auto;
  }

  .rating-link {
    padding: 4px 8px;
    margin: 0;
    font-size: 0.8em;
  }

  .rating-link.has-rating {
    padding: 4px 8px;
    margin: 0;
  }

  .rating-link.has-rating::after {
    top: -5px;
    left: -5px;
    font-size: 10px;
    padding-bottom: 1px;
  }

  .rating-logo {
    width: 15px;
    height: 15px;
  }
}
</style>
