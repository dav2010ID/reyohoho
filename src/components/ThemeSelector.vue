<template>
  <div class="theme-selector">
    <div class="theme-selector__header">
      <i class="material-icons">palette</i>
      <span>Цвет акцента:</span>
    </div>

    <div class="color-picker-section">
      <div class="color-picker-wrapper">
        <input
          v-model="customColorValue"
          type="color"
          class="color-picker"
          @change="addCustomColor"
        />
        <span class="color-picker-label">Добавить цвет</span>
      </div>
    </div>

    <div class="theme-selector__colors">
      <button
        v-for="color in themeStore.allColors"
        :key="color.value"
        class="color-option"
        :class="{ active: themeStore.accentColor === color.value }"
        :style="{ backgroundColor: color.value }"
        :title="color.name"
        @click="selectColor(color.value)"
      >
        <i v-if="themeStore.accentColor === color.value" class="material-icons">check</i>
        <button
          v-if="color.isCustom"
          class="remove-color"
          title="Удалить цвет"
          @click.stop="removeCustomColor(color.value)"
        >
          <i class="material-icons">close</i>
        </button>
      </button>
    </div>
  </div>
</template>

<script>
import { useThemeStore } from '@/store/theme'
import { ref } from 'vue'

export default {
  name: 'ThemeSelector',
  setup() {
    const themeStore = useThemeStore()
    const customColorValue = ref('#ffffff')

    const selectColor = (color) => {
      themeStore.setAccentColor(color)
    }

    const addCustomColor = () => {
      themeStore.addCustomColor(customColorValue.value)
    }

    const removeCustomColor = (color) => {
      themeStore.removeCustomColor(color)
    }

    return {
      themeStore,
      customColorValue,
      selectColor,
      addCustomColor,
      removeCustomColor
    }
  }
}
</script>

<style scoped>
.theme-selector {
  background: rgba(30, 30, 30, 0.95);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #444;
  backdrop-filter: blur(10px);
}

.theme-selector__header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}

.theme-selector__header i {
  font-size: 18px;
  color: var(--accent-color);
}

.color-picker-section {
  margin-bottom: 16px;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 36px;
  height: 36px;
  border: 2px solid #444;
  border-radius: 8px;
  cursor: pointer;
  background: none;
  padding: 0;
  outline: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
  border-radius: 6px;
  overflow: hidden;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 6px;
}

.color-picker::-moz-color-swatch {
  border: none;
  border-radius: 6px;
}

.color-picker-label {
  color: #fff;
  font-size: 12px;
  opacity: 0.8;
}

.theme-selector__colors {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.color-option {
  width: 36px;
  height: 36px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.color-option:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.color-option i {
  color: #fff;
  font-size: 16px;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  font-weight: bold;
}

.remove-color {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: rgba(0, 0, 0, 0.8);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1;
}

.color-option:hover .remove-color {
  opacity: 1;
}

.remove-color i {
  color: #fff;
  font-size: 10px;
  text-shadow: none;
}

.remove-color:hover {
  background: rgba(255, 0, 0, 0.9);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .theme-selector {
    padding: 12px;
  }

  .color-picker-section {
    margin-bottom: 12px;
  }

  .color-picker {
    width: 32px;
    height: 32px;
  }

  .theme-selector__colors {
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .color-option {
    width: 32px;
    height: 32px;
  }

  .color-option i {
    font-size: 14px;
  }

  .remove-color {
    width: 14px;
    height: 14px;
    top: 1px;
    right: 1px;
  }

  .remove-color i {
    font-size: 8px;
  }
}
</style>
