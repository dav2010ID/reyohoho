<template>
  <label class="toggle">
    <span class="switch">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        @change="onChange"
        @keydown.enter.prevent="toggle"
      />
      <span class="slider"></span>
    </span>
    <span class="label-text"><slot></slot></span>
  </label>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

function onChange(event) {
  if (!props.disabled) {
    emit('update:modelValue', event.target.checked)
  }
}

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
}

/* Touch: the whole row (switch + text) is one 44px target. */
@media (max-width: 768px), (pointer: coarse) {
  .toggle {
    min-height: 44px;
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #444;
  transition: 0.3s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.label-text {
  color: #fff;
  font-size: 0.875rem;
  white-space: normal;
  word-break: break-word;
  overflow: visible;
  text-overflow: clip;
}

input:focus-visible + .slider {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

@media (max-width: 360px) {
  .switch {
    width: 36px;
    height: 18px;
  }

  .slider:before {
    height: 14px;
    width: 14px;
  }

  input:checked + .slider:before {
    transform: translateX(18px);
  }

  .toggle {
    gap: 6px;
  }

  .label-text {
    font-size: 0.8rem;
  }
}
</style>
