import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startHistoryTransfer, LEGACY_ORIGIN } from './historyTransfer'

describe('published bridge protocol', () => {
  const nonce = '00000000-0000-4000-8000-000000000001'
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    localStorage.clear()
    document.body.innerHTML = '<p id="status"></p><button id="transfer" disabled></button><button id="download" disabled></button>'
    vi.stubGlobal('location', { origin: LEGACY_ORIGIN, hash: '#' + nonce })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })
  it('sends only movie fields to the fixed destination and does not alter old storage', async () => {
    const old = JSON.stringify({ history: [{ kp_id: 301, title: 'Матрица', token: 'secret' }] })
    localStorage.setItem('main', old)
    localStorage.setItem('auth', '{"token":"private"}')
    const opener = { closed: false, postMessage: vi.fn() }
    vi.stubGlobal('opener', opener)
    await import('../../migration/history-transfer/transfer.js')
    expect(document.querySelector('#transfer').disabled).toBe(false)
    expect(opener.postMessage).not.toHaveBeenCalled()
    document.querySelector('#transfer').click()
    const [payload, target] = opener.postMessage.mock.calls[0]
    expect(target).toBe('https://reyhoho.fun')
    expect(payload.nonce).toBe(nonce)
    expect(payload.history[0].kp_id).toBe('301')
    expect(JSON.stringify(payload)).not.toMatch(/secret|private|token/)
    expect(localStorage.getItem('main')).toBe(old)
    expect(document.querySelector('#transfer').disabled).toBe(true)
  })
  it('shows an actionable message for an empty old browser', async () => {
    vi.stubGlobal('opener', null)
    await import('../../migration/history-transfer/transfer.js')
    expect(document.querySelector('#status').textContent).toContain('История не найдена')
    expect(document.querySelector('#download').disabled).toBe(true)
  })
  it('receives once, then removes listener and timers', () => {
    const popup = { closed: false }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(nonce)
    const receive = vi.fn()
    const error = vi.fn()
    const cancel = startHistoryTransfer(receive, error)
    expect(window.open.mock.calls[0][0]).toBe(LEGACY_ORIGIN + '/reyohoho-history-transfer/#' + nonce)
    const send = () => window.dispatchEvent(new window.MessageEvent('message', {
      origin: LEGACY_ORIGIN, source: popup,
      data: { type: 'reyohoho-history', nonce, history: [{ kp_id: 301 }] }
    }))
    send()
    send()
    vi.advanceTimersByTime(120000)
    expect(receive).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    cancel()
  })
  it('reports popup blocking and closing without importing anything', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const receive = vi.fn()
    const error = vi.fn()
    startHistoryTransfer(receive, error)
    expect(error).toHaveBeenCalledWith('Разрешите всплывающие окна для переноса истории')
    const popup = { closed: false }
    open.mockReturnValue(popup)
    startHistoryTransfer(receive, error)
    popup.closed = true
    vi.advanceTimersByTime(1000)
    expect(error.mock.calls.at(-1)[0]).toContain('закрыто')
    expect(receive).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
