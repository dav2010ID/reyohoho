import { describe, expect, it } from 'vitest'
import { mergeHistory, normalizeHistory, readLegacyHistory } from '../../migration/history-transfer/history-data.js'
import { LEGACY_ORIGIN, validateTransferMessage } from './historyTransfer'

describe('history migration', () => {
  it('reads supported legacy formats without auth or other settings', () => {
    const read = []
    const storage = { getItem(key) {
      read.push(key)
      if (key === 'main') return JSON.stringify({ history: [{ kp_id: 301, title: 'Матрица', token: 'secret' }], token: 'private' })
      if (key === 'vuex_backup') return JSON.stringify({ history: [{ kp_id: 42, title: 'old' }, { kp_id: 301, title: 'stale' }] })
      return null
    } }
    const history = readLegacyHistory(storage)
    expect(history).toHaveLength(2)
    expect(history.find((item) => item.kp_id === '301').title).toBe('Матрица')
    expect(JSON.stringify(history)).not.toContain('secret')
    expect(read).not.toContain('auth')
  })
  it('sanitizes URLs, limits fields and merges without replacing current metadata', () => {
    const history = normalizeHistory([{ kp_id: 1, poster: 'javascript:alert(1)', title: 'x'.repeat(500) }, { kp_id: 'bad' }])
    expect(history[0].poster).toBe('')
    expect(history[0].title).toHaveLength(300)
    expect(mergeHistory([{ kp_id: 301, title: 'current' }], [{ kp_id: 301, title: 'old' }, { kp_id: 42 }])[0].title).toBe('current')
    expect(() => normalizeHistory(Array(1001).fill({ kp_id: 1 }))).toThrow()
  })
  it('requires exact origin, popup and nonce', () => {
    const popup = {}
    const event = { origin: LEGACY_ORIGIN, source: popup, data: { type: 'reyohoho-history', nonce: 'nonce', history: [{ kp_id: 301 }] } }
    expect(validateTransferMessage(event, popup, 'nonce')).toHaveLength(1)
    expect(validateTransferMessage({ ...event, origin: `${LEGACY_ORIGIN}.evil` }, popup, 'nonce')).toBeNull()
    expect(validateTransferMessage(event, {}, 'nonce')).toBeNull()
    expect(validateTransferMessage(event, popup, 'other')).toBeNull()
  })
  it('keeps all current entries when the merged history exceeds the limit', () => {
    const current = Array.from({ length: 999 }, (_, i) => ({ kp_id: i + 1 }))
    const imported = [{ kp_id: 2000 }, { kp_id: 2001 }]
    const merged = mergeHistory(current, imported)
    expect(merged).toHaveLength(1000)
    expect(current.every((item) => merged.some((entry) => entry.kp_id === String(item.kp_id)))).toBe(true)
    expect(merged.some((item) => item.kp_id === '2000')).toBe(true)
  })
  it('reads nested Vuex history and skips damaged stores', () => {
    const storage = { getItem(key) {
      if (key === 'main') return '{broken'
      if (key === 'reyohoho.store') return JSON.stringify({ main: { history: [{ id: 301 }] } })
      if (key === 'reyohoho-user-lists') return JSON.stringify({ history: [{ kp_id: 42 }] })
      return null
    } }
    expect(readLegacyHistory(storage).map((item) => item.kp_id)).toEqual(['301', '42'])
  })
})
