<template>
  <div class="spinner-wrapper">
    <img src="@/assets/icon-spinner.svg" alt="Loading..." class="spinner" />
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.spinner-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.spinner {
  width: 70px;
  height: 70px;
  animation: spin 1s linear infinite;
  pointer-events: none;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
