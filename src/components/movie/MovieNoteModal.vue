<template>
  <div class="timing-modal note-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>
          <i class="fa-regular fa-note-sticky"></i>
          {{ movieNote ? 'Редактировать заметку' : 'Новая заметка' }}
        </h3>
        <button class="close-modal-btn" type="button" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <div class="note-info">
          <i class="fas fa-info-circle"></i>
          <span>Личная заметка о фильме, видна только вам</span>
        </div>
        <textarea
          :value="modelValue"
          placeholder="Напишите свою заметку о фильме..."
          class="timing-textarea note-textarea"
          rows="10"
          maxlength="10000"
          @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
        <div class="char-counter">{{ modelValue.length }} / 10000 символов</div>

        <div class="timing-form-actions note-form-actions">
          <button
            class="submit-timing-btn"
            type="button"
            :disabled="!modelValue.trim() || isSaving"
            @click="$emit('save')"
          >
            <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            <span>{{ movieNote ? 'Обновить' : 'Сохранить' }}</span>
          </button>
          <button
            v-if="movieNote"
            class="delete-note-btn"
            type="button"
            :disabled="isDeleting"
            @click="$emit('delete')"
          >
            <i v-if="isDeleting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-trash"></i>
            <span>Удалить</span>
          </button>
          <button class="cancel-note-btn" type="button" @click="$emit('close')">
            <i class="fas fa-times"></i>
            <span>Отмена</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  movieNote: {
    type: Object,
    default: null
  },
  isSaving: {
    type: Boolean,
    default: false
  },
  isDeleting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue', 'close', 'save', 'delete'])
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
  padding: 20px;
}

.timing-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.timing-modal-header h3,
.note-info,
.note-form-actions button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timing-modal-header h3 {
  margin: 0;
}

.close-modal-btn,
.submit-timing-btn,
.delete-note-btn,
.cancel-note-btn {
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  padding: 10px 14px;
}

.close-modal-btn {
  background: transparent;
  font-size: 20px;
  padding: 0;
}

.timing-submission-form {
  display: grid;
  gap: 14px;
}

.note-info {
  color: var(--text-secondary);
}

.timing-textarea {
  resize: vertical;
  border-radius: 8px;
  border: 1px solid #444;
  background: #111;
  color: #fff;
  padding: 12px;
}

.note-textarea {
  min-height: 220px;
}

.char-counter {
  color: var(--text-muted);
  text-align: right;
  font-size: 13px;
}

.note-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.submit-timing-btn {
  background: var(--accent-color);
}

.delete-note-btn {
  background: var(--error-color);
}

.cancel-note-btn {
  background: #444;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
