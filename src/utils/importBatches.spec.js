import { describe, expect, it } from 'vitest'
import { chunkByBytes } from './importBatches'

const envelope = (items) => ({ items })
const size = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength

describe('chunkByBytes', () => {
  it('respects the item limit and drops duplicate IDs', () => {
    const items = Array.from({ length: 95 }, (_, i) => ({ kp_id: String(i + 1) }))
    const batches = chunkByBytes([...items, { kp_id: '1' }], { maxItems: 40, maxBytes: 65536, envelope })
    expect(batches.map((batch) => batch.length)).toEqual([40, 40, 15])
  })
  it('splits on UTF-8 bytes of the whole envelope', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ kp_id: String(i + 1), title: 'Я'.repeat(1000) }))
    const batches = chunkByBytes(items, { maxItems: 40, maxBytes: 64 * 1024, envelope })
    expect(batches.length).toBeGreaterThan(1)
    for (const batch of batches) expect(size(envelope(batch))).toBeLessThanOrEqual(64 * 1024)
    expect(batches.flat()).toHaveLength(40)
  })
  it('rejects a single item that can never fit', () => {
    expect(() => chunkByBytes([{ kp_id: '1', title: 'x'.repeat(100) }], { maxItems: 40, maxBytes: 50, envelope })).toThrow()
  })
})
