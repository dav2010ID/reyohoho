<template>
  <!-- Auto-width chip on the right: the player is a setting, not the headline. -->
  <div class="players-list" :class="{ 'players-list--inline': inline }">
    <span class="players-list__label">Плеер</span>
    <button
      class="player-btn"
      type="button"
      :disabled="!hasPlayers"
      :aria-label="`Выбрать плеер: ${selectedLabel}`"
      aria-haspopup="dialog"
      @click="$emit('open-player-modal')"
    >
      <span class="player-btn__name">{{ selectedLabel }}</span>
      <i class="fas fa-chevron-right player-btn__caret" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  hasPlayers: Boolean,
  // Inline: part of a row (movie header, phone tool row), no own margins or full width.
  inline: Boolean,
  selectedLabel: {
    type: String,
    required: true
  }
})

defineEmits(['open-player-modal'])
</script>

<style scoped>
.players-list {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  margin: 0 auto 12px;
  padding: 0;
}

.players-list__label {
  color: var(--text-faint);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.player-btn,
.source-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: var(--surface-raised);
  color: #fff;
  font-size: var(--fs-s);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.player-btn__name {
  max-width: 260px;
  overflow: hidden;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.player-btn__caret {
  color: var(--text-dim);
  font-size: 11px;
  transform: rotate(90deg);
}

.player-btn:hover:not(:disabled),
.source-btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: var(--surface-overlay);
}

.player-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.player-btn:focus-visible,
.source-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.players-list--inline {
  width: auto;
  margin: 0;
  justify-content: flex-start;
}

@media (max-width: 700px) {
  .players-list:not(.players-list--inline) {
    padding: 0 10px;
    margin-bottom: 8px;
  }

  .players-list:not(.players-list--inline) .player-btn {
    flex: 1 1 auto;
    justify-content: space-between;
    min-width: 0;
  }

  .players-list:not(.players-list--inline) .player-btn__name {
    max-width: none;
  }

  /* Phone tool row: no label, the chip shrinks before the tools do. */
  .players-list--inline {
    flex: 0 1 auto;
    min-width: 0;
  }

  .players-list--inline .players-list__label {
    display: none;
  }

  .players-list--inline .player-btn {
    min-width: 0;
  }

  .players-list--inline .player-btn__name {
    max-width: 40vw;
  }
}
</style>
