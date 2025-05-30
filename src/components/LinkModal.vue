<template>
  <div v-if="isVisible" class="link-modal-overlay" @click="closeModal">
    <div class="link-modal" @click.stop>
      <div class="link-modal-header">
        <h3>Добавить ссылку</h3>
        <button class="close-button" @click="closeModal">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="link-modal-content">
        <div class="form-group">
          <label for="link-url">URL ссылки:</label>
          <input
            id="link-url"
            ref="urlInput"
            v-model="linkUrl"
            type="url"
            placeholder="https://example.com"
            class="link-input"
            @keydown="handleKeydown"
          />
        </div>

        <div class="form-group">
          <label for="link-title">Название ссылки:</label>
          <input
            id="link-title"
            ref="titleInput"
            v-model="linkTitle"
            type="text"
            placeholder="Название для отображения"
            class="link-input"
            @keydown="handleKeydown"
          />
        </div>
      </div>

      <div class="link-modal-footer">
        <button class="cancel-button" @click="closeModal">Отмена</button>
        <button class="submit-button" :disabled="!isValidLink" @click="submitLink">Добавить</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'

export default {
  name: 'LinkModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    selectedText: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    const linkUrl = ref('')
    const linkTitle = ref('')
    const urlInput = ref(null)
    const titleInput = ref(null)

    const isValidLink = computed(() => {
      const urlPattern = /^https?:\/\/.+/
      return urlPattern.test(linkUrl.value.trim()) && linkTitle.value.trim()
    })

    const closeModal = () => {
      emit('close')
      resetForm()
    }

    const submitLink = () => {
      if (isValidLink.value) {
        emit('submit', {
          url: linkUrl.value.trim(),
          title: linkTitle.value.trim()
        })
        closeModal()
      }
    }

    const resetForm = () => {
      linkUrl.value = ''
      linkTitle.value = ''
    }

    const handleKeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (isValidLink.value) {
          submitLink()
        } else if (event.target === urlInput.value && linkUrl.value.trim()) {
          titleInput.value?.focus()
        }
      } else if (event.key === 'Escape') {
        closeModal()
      }
    }

    watch(
      () => props.isVisible,
      (newVal) => {
        if (newVal) {
          if (props.selectedText.trim()) {
            linkTitle.value = props.selectedText.trim()
          }
          nextTick(() => {
            urlInput.value?.focus()
          })
        }
      }
    )

    return {
      linkUrl,
      linkTitle,
      urlInput,
      titleInput,
      isValidLink,
      closeModal,
      submitLink,
      handleKeydown
    }
  }
}
</script>

<style scoped>
.link-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.link-modal {
  background: #2a2a2a;
  border-radius: 0.5rem;
  min-width: 400px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
}

.link-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
}

.link-modal-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-button:hover {
  color: #fff;
}

.link-modal-content {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
}

.link-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #444;
  border-radius: 0.375rem;
  background: #333;
  color: #fff;
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.link-input:focus {
  outline: none;
  border-color: #4a90e2;
}

.link-input::placeholder {
  color: #999;
}

.link-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #444;
}

.cancel-button {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid #666;
  border-radius: 0.375rem;
  color: #999;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.cancel-button:hover {
  background: #333;
  color: #fff;
  border-color: #777;
}

.submit-button {
  padding: 0.5rem 1rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #357abd;
}

.submit-button:disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 480px) {
  .link-modal {
    min-width: auto;
    margin: 1rem;
  }

  .link-modal-header,
  .link-modal-content,
  .link-modal-footer {
    padding: 1rem;
  }
}
</style>
