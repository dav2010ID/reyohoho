<template>
  <div class="source-modal-backdrop" @click.self="$emit('close')">
    <div class="source-modal">
      <div class="source-modal-header">
        <h3>Выбор источника KinoBD</h3>
        <button class="source-close-btn" type="button" @click="$emit('close')">×</button>
      </div>
      <div v-if="loading" class="source-loading">Загрузка источников...</div>
      <div v-else-if="error" class="source-error">{{ error }}</div>
      <div v-else-if="candidates.length === 0" class="source-empty">Источники не найдены</div>
      <ul v-else class="source-candidate-list">
        <li v-for="candidate in candidates" :key="candidate.id">
          <button class="source-candidate-btn" type="button" @click="$emit('select', candidate)">
            <span class="source-title">{{ candidate.title || `ID ${candidate.id}` }}</span>
            <span class="source-meta">inid: {{ candidate.id }} · kp: {{ candidate.kp_id || '-' }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
defineProps({
  candidates: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

defineEmits(['close', 'select'])
</script>

<style scoped>
.source-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.source-modal {
  width: min(720px, 100%);
  max-height: 80vh;
  overflow: auto;
  background: #222;
  border: 1px solid #444;
  border-radius: 10px;
  padding: 14px;
}

.source-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.source-modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.source-close-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 26px;
  cursor: pointer;
}

.source-loading,
.source-error,
.source-empty {
  padding: 10px 0;
}

.source-error {
  color: #ff7a7a;
}

.source-candidate-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.source-candidate-btn {
  width: 100%;
  text-align: left;
  background: #333;
  border: 1px solid #4f4f4f;
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-candidate-btn:hover {
  border-color: var(--accent-color);
  background: #3a3a3a;
}

.source-title {
  font-weight: 600;
}

.source-meta {
  opacity: 0.8;
  font-size: 12px;
}
</style>
