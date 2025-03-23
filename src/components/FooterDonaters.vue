<template>
  <footer>
    <div class="donaters-wrapper">
      <transition name="fade" mode="out-in">
        <span v-if="currentDonater" :key="currentIndex" class="donater">
          {{ currentDonater }}
        </span>
      </transition>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDons } from '@/api/movies'

const donaters = ref([])
const currentIndex = ref(-1)
const CACHE_KEY_DONATERS = 'donatersCache'
let intervalId = null

const currentDonater = computed(() => {
  if (currentIndex.value === -1 || !donaters.value.length) return ''
  return donaters.value[currentIndex.value]
})

const fetchDonaters = async () => {
  const today = new Date().toISOString().split('T')[0]
  const cached = localStorage.getItem(CACHE_KEY_DONATERS)

  if (cached) {
    try {
      const { date, data } = JSON.parse(cached)
      if (date === today) {
        donaters.value = data
        return
      }
    } catch (e) {
      console.error('Ошибка кэша донатеров:', e)
    }
  }

  try {
    const dons = await getDons()
    donaters.value = dons
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)
    localStorage.setItem(
      CACHE_KEY_DONATERS,
      JSON.stringify({
        date: today,
        data: donaters.value
      })
    )
  } catch (error) {
    console.error('Ошибка загрузки донатеров:', error)
  }
}

function updateCurrentDonater() {
  if (!donaters.value.length) return
  const newIndex = Math.floor(Math.random() * donaters.value.length)
  currentIndex.value = newIndex
}

function startShowingDonaters() {
  if (donaters.value.length === 0) return
  updateCurrentDonater()
  intervalId = setInterval(updateCurrentDonater, 4000)
}

onMounted(async () => {
  await fetchDonaters()
  startShowingDonaters()
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.donaters-wrapper {
  width: 100%;
  height: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: 10px;
}

.donater {
  font-family: Neucha, sans-serif;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.945);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
