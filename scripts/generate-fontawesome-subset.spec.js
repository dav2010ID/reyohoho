import { describe, expect, it } from 'vitest'
import {
  collectIconNamesFromSource,
  extractIconCodepoints
} from './generate-fontawesome-subset'

describe('Font Awesome subset generation', () => {
  it('collects icon names while ignoring style and animation classes', () => {
    const source = `
      <i class="fas fa-home fa-spin"></i>
      <i class="fa-solid fa-gear"></i>
      <i class="far fa-calendar"></i>
      --fa-style: 900;
      url('./fonts/fa-solid-subset.woff2');
      url('./fonts/fa-regular-subset.woff2');
    `

    expect(collectIconNamesFromSource(source)).toEqual(
      new Set(['home', 'gear', 'calendar'])
    )
  })

  it('resolves aliases from Font Awesome CSS mappings', () => {
    const css = [
      '.fa-house,.fa-home{--fa:"\\f015"}',
      '.fa-gear{--fa:"\\f013"}',
      '.fa-add,.fa-plus{--fa:"\\+"}'
    ].join('')

    expect(extractIconCodepoints(css, new Set(['home', 'gear', 'plus']))).toEqual(
      new Set(['f015', 'f013', '002b'])
    )
  })
})
