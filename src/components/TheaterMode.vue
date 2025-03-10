<!-- НЕ АКТИВНЫЙ, ДУМАЮ НАД ПЕРЕНОСОМ, НО ПОКА ХЗ НАДО ЛИ -->
<template>
    <!-- Единый контейнер плеера -->
    <div
      ref="containerRef"
      :class="['player-container', { 'theater-mode': theaterMode }]"
      :style="!theaterMode ? containerStyle : {}"
    >
      <slot></slot>
  
      <!-- Кнопка закрытия в театральном режиме -->
      <button
        v-if="theaterMode"
        @click="toggleTheaterMode"
        class="close-theater-btn"
        :class="{'visible': closeButtonVisible}"
      >
        ✖
      </button>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  
  const emit = defineEmits(['update:modelValue']);
  const props = defineProps({
    modelValue: Boolean,
    containerStyle: Object
  });
  
  const theaterMode = ref(props.modelValue);
  const closeButtonVisible = ref(false);
  const containerRef = ref(null);
  
  const toggleTheaterMode = () => {
    theaterMode.value = !theaterMode.value;
    emit('update:modelValue', theaterMode.value);
    const action = theaterMode.value ? 'add' : 'remove';
    
    document.documentElement.classList[action]('no-scroll');
    document.body.classList[action]('no-scroll');
    
    if (theaterMode.value) {
      document.addEventListener('mousemove', showCloseButton);
      document.addEventListener('keydown', onKeyDown);
    } else {
      document.removeEventListener('mousemove', showCloseButton);
      document.removeEventListener('keydown', onKeyDown);
    }
    
    closeButtonVisible.value = theaterMode.value;
  };
  
  const showCloseButton = (event) => {
    closeButtonVisible.value = event.clientY < 50;
  };
  
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && theaterMode.value) {
      toggleTheaterMode();
    }
  };
  
  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', showCloseButton);
    document.removeEventListener('keydown', onKeyDown);
    document.body.classList.remove('no-scroll');
  });
  </script>
  
  <style scoped>
  .player-container {
    width: 100%;
    transition: all 0.3s ease;
  }
  
  .player-container.theater-mode {
    position: fixed;
    top: 0 !important;
    left: 0 !important;
    z-index: 9999;
    width: 100vw !important;
    height: 100vh !important;
    background: #000;
    margin: 0;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-theater-btn {
    position: fixed;
    top: 20px;
    right: 80px;
    background: rgba(255, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 20px;
    border-radius: 50%;
    cursor: pointer;
    transition: opacity 0.3s;
    z-index: 1001;
    opacity: 0;
  }
  
  .close-theater-btn.visible {
    opacity: 1;
  }
  
  .close-theater-btn:hover {
    background: rgba(255, 0, 0, 1);
  }
  
  html.no-scroll {
    overflow: hidden;
  }
  </style>