<template>
  <transition name="modal">
    <div v-if="props.isOpen" class="modal-overlay" @click.self="close">
      <div class="modal modern-dark-dialog">
        <div class="modal-header">
          <h3>Подтверждение</h3>
        </div>
        <div class="modal-content">
          <slot name="content">
            <div class="message-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"
                />
              </svg>
              <p class="message" v-html="props.message"></p>
            </div>
          </slot>
        </div>
        <div class="modal-actions">
          <button class="modern-dark-btn" @click="close">Отмена</button>
          <button class="modern-dark-btn danger" @click="confirm">OK</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean,
  message: String
})

const emit = defineEmits(['confirm', 'close'])

const confirm = () => {
  emit('confirm')
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: overlay-in 0.3s;
}

.modal {
  transform: translateY(-50px);
  animation: modal-in 0.3s forwards;
}

.modern-dark-dialog {
  background-color: #1d1d1d;
  color: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  width: 420px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.25);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--accent-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.modal-content {
  padding: 20px;
}

.message-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.icon {
  width: 48px;
  height: 48px;
  color: #db4f4f;
}

.message {
  font-size: 1rem;
  color: #e2e8f0;
  line-height: 1.5;
  margin: 0;
  text-align: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
}

.modern-dark-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background-color: #242424;
  color: #e2e8f0;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.modern-dark-btn:hover {
  background-color: #2b2b2b;
}

.modern-dark-btn.danger {
  background-color: #7f1d1d;
  color: #fecaca;
}

.modern-dark-btn.danger:hover {
  background-color: #991b1b;
}

@keyframes modal-in {
  to {
    transform: translateY(0);
  }
}

@keyframes overlay-in {
  from {
    -webkit-backdrop-filter: blur(0);
    backdrop-filter: blur(0);
  }
  to {
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }
}

@media (max-width: 600px) {
  .modern-dark-dialog {
    width: 340px;
    margin: 0 20px;
  }

  .modal-actions {
    padding: 12px 16px;
  }

  .modern-dark-btn {
    padding: 10px 16px;
    font-size: 0.9rem;
  }
}
</style>
