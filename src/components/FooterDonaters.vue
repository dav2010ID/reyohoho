<template>
  <footer>
    <div class="donaters-wrapper">
      <transition name="fade" mode="out-in">
        <span v-if="currentDonater" class="donater" :key="currentIndex">
          {{ currentDonater }}
        </span>
      </transition>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const donaters = ref([]);
const currentIndex = ref(-1);
const CACHE_KEY_DONATERS = 'donatersCache';
const apiUrl = import.meta.env.VITE_APP_API_URL;
let intervalId = null;

const currentDonater = computed(() => {
  if (currentIndex.value === -1 || !donaters.value.length) return '';
  return donaters.value[currentIndex.value];
});

const fetchDonaters = async () => {
  const today = new Date().toISOString().split('T')[0];
  const cached = localStorage.getItem(CACHE_KEY_DONATERS);

  if (cached) {
    try {
      const { date, data } = JSON.parse(cached);
      if (date === today) {
        donaters.value = data;
        return;
      }
    } catch (e) {
      console.error('Ошибка кэша донатеров:', e);
    }
  }

  try {
    const response = await fetch(`${apiUrl}/get_dons`);
    const text = await response.text();
    donaters.value = text.split('\n').map(line => line.trim()).filter(line => line);
    localStorage.setItem(CACHE_KEY_DONATERS, JSON.stringify({
      date: today,
      data: donaters.value
    }));
  } catch (error) {
    console.error('Ошибка загрузки донатеров:', error);
  }
};

function updateCurrentDonater() {
  if (!donaters.value.length) return;
  const newIndex = Math.floor(Math.random() * donaters.value.length);
  currentIndex.value = newIndex;
}

function startShowingDonaters() {
  if (donaters.value.length === 0) return;
  updateCurrentDonater();
  intervalId = setInterval(updateCurrentDonater, 4000);
}

onMounted(async () => {
  await fetchDonaters();
  startShowingDonaters();
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
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
  color: #558839cb;
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