<template>
  <div class="players-list">
    <span>Плеер:</span>
    <button
      class="player-btn"
      type="button"
      aria-label="Выбрать плеер"
      @click="$emit('open-player-modal')"
    >
      {{ selectedLabel }}
    </button>
    <button
      v-if="showSourceButton"
      class="source-btn"
      type="button"
      aria-label="Выбрать источник"
      @click="$emit('open-source-modal')"
    >
      Источник
    </button>
  </div>
</template>

<script setup>
defineProps({
  selectedLabel: {
    type: String,
    required: true
  },
  showSourceButton: {
    type: Boolean,
    default: false
  }
})

defineEmits(['open-player-modal', 'open-source-modal'])
</script>

<style scoped>
.players-list {
  width: 100%;
  max-width: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px auto 18px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
  box-sizing: border-box;
}

.player-btn {
  display: flex;
  align-items: center;
  justify-content: left;
  background: rgba(48, 48, 48, 0.92);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 5px;
  padding: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  width: 100%;
  max-width: 440px;
  text-align: left;
  font-size: 16px;
}

.player-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.player-btn:active {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.player-btn:focus {
  outline: none;
  box-shadow: 0 0 5px var(--accent-color);
}

.source-btn {
  padding: 10px 14px;
  border: 2px solid #505050;
  border-radius: 5px;
  background: #2f2f2f;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
}

.source-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

@media (max-width: 700px) {
  .players-list {
    max-width: calc(100vw - 12px);
    margin-bottom: 10px;
  }

  .player-btn {
    max-width: none;
  }
}
</style>
