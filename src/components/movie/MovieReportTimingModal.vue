<template>
  <div class="timing-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>Пожаловаться на тайминг</h3>
        <button class="close-modal-btn" type="button" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <textarea
          :value="modelValue"
          placeholder="Опишите причину жалобы..."
          class="timing-textarea"
          rows="4"
          @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>

        <div class="timing-form-actions">
          <button
            class="submit-timing-btn"
            type="button"
            :disabled="!modelValue.trim() || isSubmitting"
            @click="$emit('submit')"
          >
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            <span v-else>Отправить жалобу</span>
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
  width: min(640px, 100%);
  padding: 20px;
}

.timing-modal-header,
.timing-form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.timing-modal-header {
  margin-bottom: 16px;
}

.timing-modal-header h3 {
  margin: 0;
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
  resize: vertical;
  border-radius: 8px;
  border: 1px solid #444;
  background: #111;
  color: #fff;
  padding: 12px;
}

.timing-form-actions {
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
