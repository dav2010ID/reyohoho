<template>
  <div class="theme-selector">
    <!-- Live preview: the current accent on the elements it actually colours. -->
    <div class="accent-preview" aria-hidden="true">
      <span class="accent-preview__button">Смотреть</span>
      <span class="accent-preview__link">Ссылка</span>
      <span class="accent-preview__rank">№ 12</span>
      <span class="accent-preview__bar"></span>
    </div>

    <div class="theme-selector__colors" role="radiogroup" aria-label="Цвет акцента">
      <span v-for="color in sortedColors" :key="color.value" class="swatch">
        <button
          type="button"
          role="radio"
          class="color-option"
          :class="{ active: themeStore.accentColor === color.value }"
          :aria-checked="themeStore.accentColor === color.value"
          :aria-label="color.name || color.value"
          :title="color.name"
          @click="selectColor(color.value)"
        >
          <span class="color-option__dot" :style="{ backgroundColor: color.value }">
            <i
              v-if="themeStore.accentColor === color.value"
              class="material-icons"
              :style="{ color: checkColor(color.value) }"
              aria-hidden="true"
              >check</i
            >
          </span>
        </button>
        <button
          v-if="color.isCustom"
          type="button"
          class="remove-color"
          :aria-label="`Удалить цвет ${color.value}`"
          @click="removeCustomColor(color.value)"
        >
          <i class="material-icons" aria-hidden="true">close</i>
        </button>
      </span>
      <label class="color-picker-wrapper" title="Добавить свой цвет">
        <input
          v-model="customColorValue"
          type="color"
          class="color-picker"
          aria-label="Добавить свой цвет"
          @change="addCustomColor"
        />
        <i class="fas fa-plus" aria-hidden="true"></i>
      </label>
    </div>
  </div>
</template>

<script>
import { useThemeStore } from '@/store/theme'
import { computed, ref } from 'vue'
import { contrastRatio } from '@/utils/accentContrast'

// Hue in degrees; greys (no saturation) sort last.
const hueOf = (rgb) => {
  if (!rgb) return 999
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta < 0.08) return 900 + max
  let hue
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}

export default {
  name: 'ThemeSelector',
  setup() {
    const themeStore = useThemeStore()
    const customColorValue = ref('#ffffff')

    const sortedColors = computed(() =>
      [...themeStore.allColors].sort(
        (a, b) => hueOf(themeStore.hexToRgb(a.value)) - hueOf(themeStore.hexToRgb(b.value))
      )
    )

    const selectColor = (color) => {
      themeStore.setAccentColor(color)
    }

    const addCustomColor = () => {
      themeStore.addCustomColor(customColorValue.value)
    }

    const removeCustomColor = (color) => {
      themeStore.removeCustomColor(color)
    }

    // The check mark sits on the swatch itself: white on dark swatches, dark on light ones (3:1 for icons).
    const checkColor = (hex) => {
      const rgb = themeStore.hexToRgb(hex)
      if (!rgb) return '#fff'
      return contrastRatio([rgb.r, rgb.g, rgb.b], [255, 255, 255]) >= 3 ? '#fff' : '#1a1a1a'
    }

    return {
      themeStore,
      customColorValue,
      sortedColors,
      selectColor,
      addCustomColor,
      removeCustomColor,
      checkColor
    }
  }
}
</script>

<style scoped>
.theme-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.accent-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: var(--radius-m);
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 1px var(--hairline);
}

.accent-preview__button {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-m);
  background: var(--accent-solid);
  color: var(--accent-contrast);
  font-size: var(--fs-s);
  font-weight: 600;
}

.accent-preview__link {
  color: var(--accent-light);
  font-size: var(--fs-s);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.accent-preview__rank {
  color: var(--accent-text);
  font-size: var(--fs-xs);
  font-weight: 700;
}

.accent-preview__bar {
  flex: 1 1 60px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--accent-ui) 60%, rgba(255, 255, 255, 0.16) 60%);
}

.theme-selector__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.swatch {
  position: relative;
}

/* 44px hit area around a 32px circle. */
.color-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.color-option__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.15s ease;
}

.color-option:hover .color-option__dot {
  transform: scale(1.08);
}

.color-option.active .color-option__dot {
  box-shadow:
    0 0 0 2px var(--bg-primary),
    0 0 0 4px #fff;
}

.color-option:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -2px;
}

.color-option i {
  font-size: 18px;
  font-weight: bold;
}

.remove-color {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #000;
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.swatch:hover .remove-color,
.remove-color:focus-visible {
  opacity: 1;
}

@media (hover: none) {
  .remove-color {
    opacity: 1;
  }
}

.remove-color i {
  font-size: 12px;
}

.color-picker-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-dim);
  cursor: pointer;
}

.color-picker-wrapper::before {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  border: 1px dashed rgba(255, 255, 255, 0.4);
  border-radius: 50%;
}

.color-picker-wrapper:hover {
  color: #fff;
}

.color-picker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.color-picker-wrapper:focus-within::before {
  border-color: #fff;
  border-style: solid;
}
</style>
