<template>
  <div class="rating-container">
    <div class="rating-display">
      <a
        href="#"
        class="rating-link"
        @mouseenter="isHovered = true"
        @mouseleave="handleMouseLeave"
        @click.prevent="toggleTooltip"
      >
        <img src="/icons/icon-192x192.png" alt="ReYohoho" class="rating-logo" />
        <span class="average-rating">{{ averageRating ? averageRating.toFixed(1) : '—' }}</span>
      </a>
      <div
        v-show="isHovered || isTooltipVisible"
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
              hover: num === hoverRating
            }"
            @click="setRating(num)"
            @mouseenter="hoverRating = num"
            @mouseleave="hoverRating = 0"
          >
            {{ num }}
          </button>
        </div>
      </div>
    </div>
    <Notification ref="notificationRef" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getRating, setRating as setRatingApi } from '@/api/movies'
import Notification from '@/components/notification/ToastMessage.vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/store/main'

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
const totalRatings = ref(0)
const hoverRating = ref(0)
const isHovered = ref(false)
const isTooltipVisible = ref(false)
let hideTimeout = null

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
  }
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
  gap: 8px;
  position: relative;
  min-height: 40px;
}

.rating-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.rating-link {
  display: inline-flex;
  align-items: center;
  color: rgb(224, 224, 224);
  text-decoration: none;
  font-weight: 700;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  cursor: pointer;
}

.rating-logo {
  width: 20px;
  height: 20px;
  margin-right: 5px;
  opacity: 0.8;
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
}

.rating-display:hover .rating-tooltip {
  opacity: 1;
}

.rating-numbers {
  display: flex;
  gap: 4px;
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
}

.number-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.number-btn.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
}

.number-btn.hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
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
}

.number-btn:nth-child(1):hover {
  color: #ff4444;
}
.number-btn:nth-child(2):hover {
  color: #ff6b6b;
}
.number-btn:nth-child(3):hover {
  color: #ff8e8e;
}
.number-btn:nth-child(4):hover {
  color: #ffb347;
}
.number-btn:nth-child(5):hover {
  color: #ffcc33;
}
.number-btn:nth-child(6):hover {
  color: #ffd700;
}
.number-btn:nth-child(7):hover {
  color: #9acd32;
}
.number-btn:nth-child(8):hover {
  color: #7cfc00;
}
.number-btn:nth-child(9):hover {
  color: #32cd32;
}
.number-btn:nth-child(10):hover {
  color: #00ff00;
}

.number-btn.active:nth-child(1) {
  background: #ff4444;
}
.number-btn.active:nth-child(2) {
  background: #ff6b6b;
}
.number-btn.active:nth-child(3) {
  background: #ff8e8e;
}
.number-btn.active:nth-child(4) {
  background: #ffb347;
}
.number-btn.active:nth-child(5) {
  background: #ffcc33;
}
.number-btn.active:nth-child(6) {
  background: #ffd700;
}
.number-btn.active:nth-child(7) {
  background: #9acd32;
}
.number-btn.active:nth-child(8) {
  background: #7cfc00;
}
.number-btn.active:nth-child(9) {
  background: #32cd32;
}
.number-btn.active:nth-child(10) {
  background: #00ff00;
}
</style>
