// Читаемый текст на заливке акцентным цветом (WCAG AA, 4.5:1).
// Тёмные и средние акценты затемняются до нужного контраста с белым текстом,
// светлые (янтарь, лайм, циан) сохраняют цвет и получают тёмный текст.

const MIN_CONTRAST = 4.5
const DARK_TEXT = '#1a1a1a'
const LIGHT_TEXT = '#ffffff'

const parseHex = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

export const relativeLuminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastRatio = (rgbA, rgbB) => {
  const a = relativeLuminance(rgbA)
  const b = relativeLuminance(rgbB)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const WHITE = [255, 255, 255]
const DARK = parseHex(DARK_TEXT)

const darken = (rgb, factor) => rgb.map((v) => v * factor)

// Заливка кнопки должна отличаться от карточки #2d2d2d, на которой лежит.
const SURFACE = [45, 45, 45]
const MIN_FILL_SURFACE = 1.5

/**
 * @param {string} accentHex акцентный цвет (#rrggbb)
 * @returns {{ fill: string, hover: string, text: string }} заливка, заливка при наведении и цвет текста
 */
export const getAccentSolid = (accentHex) => {
  const rgb = parseHex(accentHex)
  if (!rgb) return { fill: accentHex, hover: accentHex, text: LIGHT_TEXT }

  // Почти сливается с тёмной карточкой (например #424242): яркая светлая заливка и тёмный текст,
  // чтобы основная кнопка не выглядела отключённой.
  if (contrastRatio(rgb, SURFACE) < MIN_FILL_SURFACE) {
    const fill = parseHex(lightenUntil(accentHex, 8))
    return { fill: toHex(fill), hover: toHex(darken(fill, 0.92)), text: DARK_TEXT }
  }

  if (contrastRatio(rgb, WHITE) >= MIN_CONTRAST) {
    return { fill: accentHex, hover: toHex(darken(rgb, 0.88)), text: LIGHT_TEXT }
  }

  // Светлый акцент: проще и красивее оставить цвет и взять тёмный текст.
  if (contrastRatio(rgb, DARK) >= MIN_CONTRAST + 1 && contrastRatio(rgb, WHITE) < 2.2) {
    return { fill: accentHex, hover: toHex(darken(rgb, 0.92)), text: DARK_TEXT }
  }

  // Средний акцент: затемняем заливку до читаемого контраста с белым.
  let factor = 0.95
  let solid = darken(rgb, factor)
  while (contrastRatio(solid, WHITE) < MIN_CONTRAST && factor > 0.3) {
    factor -= 0.03
    solid = darken(rgb, factor)
  }
  return { fill: toHex(solid), hover: toHex(darken(solid, 0.88)), text: LIGHT_TEXT }
}

// Самый светлый фон, на котором встречается акцентный текст (--bg-tertiary).
const TEXT_SURFACE = parseHex('#2d2d2d')

const lighten = (rgb, t) => rgb.map((v) => v + (255 - v) * t)

/**
 * Акцентный цвет для текста, ссылок и кольца фокуса на тёмном фоне.
 * Тёмные акценты подмешивают белый, пока контраст с фоном не достигнет 4.5:1.
 * @param {string} accentHex акцентный цвет (#rrggbb)
 * @returns {string}
 */
const lightenUntil = (accentHex, minContrast) => {
  const rgb = parseHex(accentHex)
  if (!rgb) return accentHex
  if (contrastRatio(rgb, TEXT_SURFACE) >= minContrast) return accentHex

  let t = 0.05
  let color = lighten(rgb, t)
  while (contrastRatio(color, TEXT_SURFACE) < minContrast && t < 1) {
    t += 0.05
    color = lighten(rgb, t)
  }
  return toHex(color)
}

export const getAccentText = (accentHex) => lightenUntil(accentHex, MIN_CONTRAST)

/**
 * Акцент для рамок, полос активного пункта, нативных контролов и подсветок:
 * не текст, поэтому достаточно 3:1 к тёмной поверхности (WCAG 1.4.11).
 * @param {string} accentHex акцентный цвет (#rrggbb)
 * @returns {string}
 */
export const getAccentUi = (accentHex) => lightenUntil(accentHex, 3)
