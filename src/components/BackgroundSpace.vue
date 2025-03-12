<template>
  <div>
    <div class="background-container">
      <!-- Фон по умолчанию -->
      <div 
        class="background-layer default-background"
        :style="defaultBackgroundStyle"
        :class="{ active: !isExternalBackgroundActive }"
      ></div>
      
      <!-- Внешний фон -->
      <div 
        class="background-layer external-background"
        :style="externalBackgroundStyle"
        :class="{ active: isExternalBackgroundActive }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const props = defineProps({
  externalBackgroundUrl: {
    type: String,
    default: null,
  },
  isBackgroundActive: {
    type: Boolean,
    default: false,
  },
});

const topMovie = ref(null);
const CACHE_KEY = 'topMovieCache';
const apiUrl = import.meta.env.VITE_APP_API_URL;

// Проверка, активирован ли внешний фон
const isExternalBackgroundActive = computed(() => {
  return props.isBackgroundActive && props.externalBackgroundUrl !== null;
});

// Стиль для фона по умолчанию
const defaultBackgroundStyle = computed(() => ({
  backgroundImage: topMovie.value ? `url(${topMovie.value.cover})` : 'none',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}));

// Стиль для внешнего фона
const externalBackgroundStyle = computed(() => ({
  backgroundImage: props.externalBackgroundUrl ? `url(${props.externalBackgroundUrl})` : 'none',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}));

const fetchTopMovie = async () => {
  const today = new Date().toISOString().split('T')[0];
  const cached = localStorage.getItem(CACHE_KEY);
  
  if (cached) {
    try {
      const { date, data } = JSON.parse(cached);
      if (date === today) {
        topMovie.value = data;
        return;
      }
    } catch (e) {
      console.error('Ошибка кэша:', e);
    }
  }

  try {
    const response = await fetch(`${apiUrl}/top/24h`);
    const data = await response.json();
    if (data?.[0]) {
      topMovie.value = data[0];
      localStorage.setItem(CACHE_KEY, JSON.stringify({ 
        date: today, 
        data: topMovie.value 
      }));
      
      // Предзагрузка изображения
      const img = new Image();
      img.src = topMovie.value.cover;
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error);
  }
};

onMounted(fetchTopMovie);
</script>

<style scoped>
.background-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -3;
  overflow: hidden;
}

.background-layer {
  position: fixed;
  width: 100vw;
  height: 100vh;
  opacity: 0;
  transition: opacity 2s ease-in-out; /* Плавный переход */
  pointer-events: none;
  filter: brightness(20%) blur(20px);
  z-index: -2;
}

.default-background.active {
  opacity: 1;
  z-index: -1;
}

.external-background.active {
  opacity: 1;
  z-index: -1; 
}
</style>