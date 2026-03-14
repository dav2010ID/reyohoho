import { defineStore } from 'pinia'

const createNoopStorage = () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
})

export const useThemeStore = defineStore('theme', {
  state: () => ({
    accentColor: '#4caf50',
    customColors: [],
    accentColors: [
      { name: 'Material Green', value: '#4caf50', hover: '#45a049' },
      { name: 'Classic Purple', value: '#6c5ce7', hover: '#5a4fcf' },
      { name: 'Cherry Lacquer', value: '#c41e3a', hover: '#a51e2f' },
      { name: 'Retro Blue', value: '#2196f3', hover: '#1976d2' },
      { name: 'Neon Orange', value: '#ff5722', hover: '#e64a19' },
      { name: 'Future Dusk', value: '#3f51b5', hover: '#303f9f' },
      { name: 'Deep Red', value: '#d32f2f', hover: '#c62828' },
      { name: 'Ocean Blue', value: '#0277bd', hover: '#01579b' },
      { name: 'Brown Slate', value: '#795548', hover: '#5d4037' },
      { name: 'Sky Blue', value: '#03a9f4', hover: '#0288d1' },
      { name: 'Teal Green', value: '#009688', hover: '#00796b' },
      { name: 'Digital Mint', value: '#26a69a', hover: '#00695c' },
      { name: 'Coral Red', value: '#f44336', hover: '#d32f2f' },
      { name: 'Electric Cyan', value: '#00bcd4', hover: '#0097a7' },
      { name: 'Warm Orange', value: '#ff9800', hover: '#f57c00' },
      { name: 'Forest Green', value: '#388e3c', hover: '#2e7d32' },
      { name: 'Amber Gold', value: '#ffc107', hover: '#ffb300' },
      { name: 'Deep Purple', value: '#7b1fa2', hover: '#6a1b9a' },
      { name: 'Indigo Blue', value: '#3949ab', hover: '#303f9f' },
      { name: 'Pink Rose', value: '#e91e63', hover: '#c2185b' },
      { name: 'Lime Green', value: '#8bc34a', hover: '#689f38' },
      { name: 'Dark Gray', value: '#424242', hover: '#212121' },
      { name: 'Violet Purple', value: '#9c27b0', hover: '#7b1fa2' }
    ]
  }),

  getters: {
    allColors: (state) => [...state.accentColors, ...state.customColors],

    currentAccentColor: (state) => {
      const allColors = [...state.accentColors, ...state.customColors]
      const color = allColors.find((c) => c.value === state.accentColor)
      return color || state.accentColors[0]
    },

    accentHoverColor: (state) => {
      const allColors = [...state.accentColors, ...state.customColors]
      const color = allColors.find((c) => c.value === state.accentColor)
      return color?.hover || '#5a4fcf'
    }
  },

  actions: {
    setAccentColor(color) {
      this.accentColor = color
      this.updateCSSVariables()
    },

    addCustomColor(colorValue) {
      const existsInPredefined = this.accentColors.some((c) => c.value === colorValue)
      const existsInCustom = this.customColors.some((c) => c.value === colorValue)

      if (!existsInPredefined && !existsInCustom) {
        const hoverColor = this.generateHoverColor(colorValue)
        this.customColors.push({
          name: 'Custom Color',
          value: colorValue,
          hover: hoverColor,
          isCustom: true
        })
      }
    },

    removeCustomColor(colorValue) {
      this.customColors = this.customColors.filter((c) => c.value !== colorValue)
      if (this.accentColor === colorValue) {
        this.setAccentColor(this.accentColors[0].value)
      }
    },

    generateHoverColor(hex) {
      const rgb = this.hexToRgb(hex)
      if (!rgb) return hex

      const factor = 0.8
      const r = Math.max(0, Math.round(rgb.r * factor))
      const g = Math.max(0, Math.round(rgb.g * factor))
      const b = Math.max(0, Math.round(rgb.b * factor))

      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    },

    updateCSSVariables() {
      if (typeof document === 'undefined') return

      const root = document.documentElement
      const currentColor = this.currentAccentColor

      root.style.setProperty('--accent-color', currentColor.value)
      root.style.setProperty('--accent-hover', currentColor.hover)

      const lighterShade = this.lightenColor(currentColor.value, 20)
      const darkerShade = this.darkenColor(currentColor.value, 20)

      root.style.setProperty('--accent-light', lighterShade)
      root.style.setProperty('--accent-dark', darkerShade)
      root.style.setProperty('--accent-transparent', `${currentColor.value}30`)
      root.style.setProperty('--accent-semi-transparent', `${currentColor.value}80`)
    },

    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          }
        : null
    },

    lightenColor(hex, percent) {
      const rgb = this.hexToRgb(hex)
      if (!rgb) return hex

      const factor = 1 + percent / 100
      const r = Math.min(255, Math.round(rgb.r * factor))
      const g = Math.min(255, Math.round(rgb.g * factor))
      const b = Math.min(255, Math.round(rgb.b * factor))

      return `rgb(${r}, ${g}, ${b})`
    },

    darkenColor(hex, percent) {
      const rgb = this.hexToRgb(hex)
      if (!rgb) return hex

      const factor = 1 - percent / 100
      const r = Math.max(0, Math.round(rgb.r * factor))
      const g = Math.max(0, Math.round(rgb.g * factor))
      const b = Math.max(0, Math.round(rgb.b * factor))

      return `rgb(${r}, ${g}, ${b})`
    },

    initTheme() {
      this.updateCSSVariables()
    }
  },

  persist: {
    key: 'theme-settings-5',
    storage: typeof window !== 'undefined' ? window.localStorage : createNoopStorage(),
    paths: ['accentColor', 'customColors']
  }
})
