import { describe, expect, it } from 'vitest'
import { contrastRatio, getAccentSolid, getAccentText, getAccentUi } from './accentContrast'

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

const PRESETS = [
  '#4caf50', '#6c5ce7', '#c41e3a', '#2196f3', '#ff5722', '#3f51b5', '#d32f2f', '#0277bd',
  '#795548', '#03a9f4', '#009688', '#26a69a', '#f44336', '#00bcd4', '#ff9800', '#388e3c',
  '#ffc107', '#7b1fa2', '#3949ab', '#e91e63', '#8bc34a', '#424242', '#9c27b0'
]

describe('getAccentSolid', () => {
  it.each(PRESETS)('%s даёт текст с контрастом не ниже 4.5:1', (accent) => {
    const { fill, text } = getAccentSolid(accent)
    expect(contrastRatio(rgbOf(fill), rgbOf(text))).toBeGreaterThanOrEqual(4.5)
  })

  it('оставляет тёмный акцент без изменений с белым текстом', () => {
    expect(getAccentSolid('#3949ab')).toMatchObject({ fill: '#3949ab', text: '#ffffff' })
  })

  it('для светлого акцента сохраняет цвет и берёт тёмный текст', () => {
    expect(getAccentSolid('#ffc107')).toMatchObject({ fill: '#ffc107', text: '#1a1a1a' })
  })

  it('затемняет средний акцент вместо смены цвета текста', () => {
    const { fill, text } = getAccentSolid('#4caf50')
    expect(text).toBe('#ffffff')
    expect(fill).not.toBe('#4caf50')
  })

  it('не падает на некорректном значении', () => {
    expect(getAccentSolid('not-a-color').text).toBe('#ffffff')
  })
})

describe('getAccentText', () => {
  const SURFACE = [45, 45, 45]

  it.each(PRESETS)('%s читается на тёмном фоне не хуже 4.5:1', (accent) => {
    expect(contrastRatio(rgbOf(getAccentText(accent)), SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('не меняет акцент, который уже читается', () => {
    expect(getAccentText('#4caf50')).toBe('#4caf50')
    expect(getAccentText('#ffc107')).toBe('#ffc107')
  })

  it('осветляет тёмный акцент', () => {
    expect(getAccentText('#424242')).not.toBe('#424242')
  })

  it('не падает на некорректном значении', () => {
    expect(getAccentText('not-a-color')).toBe('not-a-color')
  })
})

describe('getAccentUi', () => {
  const SURFACE = [45, 45, 45]

  it.each(PRESETS)('%s виден на тёмной поверхности не хуже 3:1', (accent) => {
    expect(contrastRatio(rgbOf(getAccentUi(accent)), SURFACE)).toBeGreaterThanOrEqual(3)
  })

  it('не меняет акцент, который уже виден', () => {
    expect(getAccentUi('#4caf50')).toBe('#4caf50')
  })
})

describe('getAccentSolid on a dark card', () => {
  it.each(PRESETS)('%s: заливка отличается от карточки #2d2d2d', (accent) => {
    expect(contrastRatio(rgbOf(getAccentSolid(accent).fill), [45, 45, 45])).toBeGreaterThanOrEqual(1.5)
  })

  it('почти чёрный акцент получает светлую заливку и тёмный текст', () => {
    expect(getAccentSolid('#424242')).toMatchObject({ text: '#1a1a1a' })
  })
})
