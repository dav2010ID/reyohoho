<template>
  <transition name="modal">
    <div v-if="props.isOpen" class="modal-overlay" @click.self="close">
      <div class="modal">
        <button class="close-btn" @click="close">&times;</button>
        <div class="modal-content">
          <slot name="content">
            <div class="message-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"
                />
              </svg>
              <p class="message">{{ props.message }}</p>
            </div>
          </slot>
        </div>
        <div class="modal-actions">
          <button class="btn confirm" @click="confirm">OK</button>
          <button class="btn cancel" @click="close">Отмена</button>
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
  -webkit-backdrop-filter: blur(4px); /* Для Safari 9+ */
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 11;
  animation: overlay-in 0.3s;
}

.modal {
  background: rgb(66, 66, 66);
  padding: 2rem;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  position: relative;
  transform: translateY(-50px);
  animation: modal-in 0.3s forwards;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.modal-content {
  margin: 1.5rem 0;
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
  color: #ffffff;
  line-height: 1.5;
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cancel {
  background: #1c8855;
  color: rgb(255, 255, 255);
}

.cancel:hover {
  background: rgb(55, 184, 104);
  transform: translateY(-1px);
}

.confirm {
  background: transparent;
  color: #ffffff;
  border: 1px solid #ffffff;
}

.confirm:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #ffffff;
  cursor: pointer;
  padding: 0.25rem;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: #d0dcee;
}

@keyframes modal-in {
  to {
    transform: translateY(0);
  }
}

@keyframes overlay-in {
  from {
    -webkit-backdrop-filter: blur(0); /* Для Safari 9+ */
    backdrop-filter: blur(0);
  }
  to {
    -webkit-backdrop-filter: blur(4px); /* Для Safari 9+ */
    backdrop-filter: blur(4px);
  }
}

@media (max-width: 600px) {
  .modal {
    width: 80%;
    padding: 1.5rem;
  }

  .btn {
    padding: 0.7rem 1.5rem;
    font-size: 0.9rem;
  }
}
</style>
