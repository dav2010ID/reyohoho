import { normalizeHistory } from '../../migration/history-transfer/history-data.js'
import { CARD_FIELDS } from '../../migration/history-transfer/movie-metadata.js'
import { boundedJson } from './private-api.mjs'

// Fill empty fields at write time, not read/merge/write: preserves concurrent edits,
// viewing dates, list membership and deletion tombstones. Identity is server-owned.
export function metadataFillExpression(metadata) {
  let expression = 'metadata'
  const params = []
  for (const field of CARD_FIELDS) {
    const value = metadata[field]
    if (typeof value !== 'string' || !value.trim()) continue
    expression = `json_set(${expression}, '$.${field}', CASE WHEN TRIM(COALESCE(CAST(json_extract(metadata,'$.${field}') AS TEXT),''))='' THEN ? ELSE json_extract(metadata,'$.${field}') END)`
    params.push(value)
  }
  return { expression, params }
}

export function metadataUpdate(table, metadata, { userId, id, type } = {}) {
  if (!['user_history', 'account_lists'].includes(table)) throw new Error('Invalid table')
  const { expression, params } = metadataFillExpression(metadata)
  if (!params.length) return null
  const predicates = [
    'user_id=?', 'kp_id=?',
    table === 'user_history' ? 'deleted=0' : 'list_type=?'
  ]
  params.push(userId, id, ...(table === 'account_lists' ? [type] : []))
  return { sql: `UPDATE ${table} SET metadata=${expression} WHERE ${predicates.join(' AND ')}`, params }
}

export async function readMetadataPatch(request, id) {
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json'))
    throw new Error('JSON required')
  const body = await boundedJson(request.body, 8192)
  return normalizeHistory([{ ...body.metadata, kp_id: id }])[0]
}
