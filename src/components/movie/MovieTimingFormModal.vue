<template>
  <div class="timing-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>{{ editingTiming ? 'Редактировать тайминг' : 'Добавить тайминг' }}</h3>
        <button class="close-modal-btn" type="button" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <textarea
          :value="modelValue"
          placeholder="Пожалуйста, указывайте длительность фильма в [] скобках, например [01:36] или [01:36:55], и тайминги диапазоном: 00:12:31-00:13:04 - текст. Для сериалов указывайте сезон и номер эпизода."
          class="timing-textarea"
          @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>

        <div v-if="parsedTimingPreview.length > 0" class="timing-preview">
          <div class="timing-preview-header">
            <i class="fas fa-eye"></i>
            <span>Предпросмотр парсера</span>
          </div>
          <div class="timing-preview-content">
            <div
              v-for="(range, index) in parsedTimingPreview"
              :key="index"
              class="timing-preview-item"
            >
              <span class="timing-preview-range">
                {{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}
              </span>
              <span class="timing-preview-duration">({{ Math.round(range[1] - range[0]) }}с)</span>
            </div>
          </div>
        </div>

        <div class="timing-form-actions">
          <button
            class="submit-timing-btn"
            type="button"
            :disabled="!canSubmit || isSubmitting"
            @click="$emit('submit')"
          >
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            <span v-else>{{ editingTiming ? 'Обновить тайминг' : 'Добавить тайминг' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatSecondsToTime } from '@/utils/dateUtils'

defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  editingTiming: {
    type: Object,
    default: null
  },
  parsedTimingPreview: {
    type: Array,
    default: () => []
  },
  canSubmit: {
    type: Boolean,
    default: false
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue', 'close', 'submit'])
</script>

<style scoped>
.timing-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.timing-modal-content {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  width: min(720px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 20px;
}

.timing-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.timing-modal-header h3 {
  margin: 0;
  font-size: 20px;
}

.close-modal-btn,
.submit-timing-btn {
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
}

.close-modal-btn {
  background: transparent;
  font-size: 20px;
}

.timing-submission-form {
  display: grid;
  gap: 14px;
}

.timing-textarea {
  min-height: 180px;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid #444;
  background: #111;
  color: #fff;
  padding: 12px;
}

.timing-preview {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.timing-preview-header,
.timing-preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timing-preview-content {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.timing-preview-duration {
  color: var(--text-muted);
}

.timing-form-actions {
  display: flex;
  justify-content: flex-end;
}

.submit-timing-btn {
  background: var(--accent-color);
  padding: 10px 16px;
  font-weight: 600;
}

.submit-timing-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
