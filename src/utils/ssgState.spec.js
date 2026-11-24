import { describe, expect, it } from 'vitest'
import { moveStateToJson, restoreSsgState, SSG_STATE_ID } from './ssgState'

describe('prerendered state without inline script', () => {
  const state = { publicPages: { 'top:/top': { title: '<b>"Матрица"</b>' } } }
  // The literal exactly as vite-ssg serializes it.
  const literal = JSON.stringify(JSON.stringify(state)).replace(
    /[<>/]/g,
    (char) => ({ '<': '\\u003C', '>': '\\u003E', '/': '\\u002F' })[char]
  )
  const html = `<div id="app"></div>\n<script>window.__INITIAL_STATE__=${literal}</script><script type="module" src="/a.js"></script>`

  it('moves the state into a JSON element that vite-ssg can read back', () => {
    const output = moveStateToJson(html)
    expect(output).not.toContain('window.__INITIAL_STATE__')
    expect(output).toContain(`<script type="application/json" id="${SSG_STATE_ID}">`)
    document.body.innerHTML = output
    const win = {}
    restoreSsgState(document, win)
    expect(JSON.parse(win.__INITIAL_STATE__)).toEqual(state)
  })
  it('leaves pages without state and existing state untouched', () => {
    expect(moveStateToJson('<p>no state</p>')).toBe('<p>no state</p>')
    document.body.innerHTML = moveStateToJson(html)
    const win = { __INITIAL_STATE__: 'kept' }
    restoreSsgState(document, win)
    expect(win.__INITIAL_STATE__).toBe('kept')
  })
})
