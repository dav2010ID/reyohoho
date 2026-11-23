const encoder = new TextEncoder()
const byteLength = (value) => encoder.encode(JSON.stringify(value)).byteLength

// Split items into request bodies that respect both the server's item limit and
// its byte limit (measured on the whole JSON envelope, in UTF-8). Duplicate IDs
// are dropped first so a retry never resends the same title twice.
export function chunkByBytes(items, { maxItems, maxBytes, envelope }) {
  const unique = new Map()
  for (const item of items || []) {
    const id = String(item?.kp_id ?? item?.id ?? '')
    if (id && !unique.has(id)) unique.set(id, item)
  }
  const batches = []
  let batch = []
  for (const item of unique.values()) {
    if (byteLength(envelope([item])) > maxBytes)
      throw new Error(`Запись ${item.kp_id ?? item.id} слишком большая для импорта`)
    const next = [...batch, item]
    if (batch.length && (next.length > maxItems || byteLength(envelope(next)) > maxBytes)) {
      batches.push(batch)
      batch = [item]
    } else batch = next
  }
  if (batch.length) batches.push(batch)
  return batches
}
