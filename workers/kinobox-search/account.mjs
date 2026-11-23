import { normalizeHistory } from '../../shared/history-data.js'
import {
  boundedJson,
  checkLimit,
  primaryDb,
  privateReply,
  secureOrigin,
  verifyWorkerSession
} from './private-api.mjs'
import { serveHistory } from './history.mjs'
import { metadataUpdate, readMetadataPatch } from './metadata.mjs'

const TYPES = new Set(['favorite', 'later', 'watching', 'completed', 'abandoned', 'history'])
// Older clients send full provider responses. Bound reads, then store only card fields.
const MAX_LIST_BODY_BYTES = 64 * 1024
export const LIST_CAPACITY = 1000
// A title has at most one viewing status; the other lists are independent.
export const STATUS_TYPES = ['watching', 'completed', 'abandoned']
const VALID_ID = /^[1-9]\d{0,11}$/
const capacityReply = (reply, extra = {}) =>
  reply({ error: 'list_capacity', limit: LIST_CAPACITY, remaining: 0, ...extra }, 409)

export async function serveAccount(request, env, origin) {
  const reply = privateReply(origin)
  if (!secureOrigin(origin)) return reply({ error: 'HTTPS required' }, 403)
  if (request.method === 'OPTIONS') return reply(null, 204)
  // Sessions stay valid while new logins are switched off (TELEGRAM_AUTH_ENABLED).
  if (!env.HISTORY_DB) return reply({ error: 'Accounts not configured' }, 503)
  try {
    if (
      !(await checkLimit(
        env.ACCOUNT_RATE_LIMITER,
        request.headers.get('CF-Connecting-IP') || 'local'
      ))
    )
      return reply({ error: 'Too many requests' }, 429)
    const user = await verifyWorkerSession(request, env)
    if (!user) return reply({ error: 'Invalid session' }, 401)
    const path = new URL(request.url).pathname
    const db = primaryDb(env)
    const uid = `worker-tg:${user.id}`
    const importMatch = /^\/api\/list\/([a-z]+)\/import$/.exec(path)
    if (importMatch && request.method === 'POST') {
      const type = importMatch[1]
      if (!TYPES.has(type) || type === 'history') return reply({ error: 'Invalid list' }, 400)
      let items
      try {
        const body = await boundedJson(request.body, MAX_LIST_BODY_BYTES)
        if (!Array.isArray(body.items) || body.items.length > 40) throw new Error('Invalid batch')
        if (!body.items.every((item) => VALID_ID.test(String(item?.kp_id ?? item?.id ?? ''))))
          throw new Error('Invalid IDs')
        // Duplicates collapse to the newest copy instead of failing the batch.
        items = normalizeHistory(body.items, 40)
      } catch (error) {
        if (error.message === 'Body too large')
          return reply({ error: 'Import batch too large', maxBytes: MAX_LIST_BODY_BYTES }, 413)
        return reply({ error: 'Invalid import batch' }, 400)
      }
      if (!items.length) return reply({ added: 0, rejected: 0 })
      const ids = items.map((item) => item.kp_id)
      const marks = ids.map(() => '?').join(',')
      const status = STATUS_TYPES.includes(type)
      const [{ results: present }, { results: size }] = await Promise.all([
        db
          .prepare(
            `SELECT DISTINCT kp_id FROM account_lists WHERE user_id=? AND kp_id IN (${marks}) AND ${
              status ? `list_type IN (${STATUS_TYPES.map(() => '?').join(',')})` : 'list_type=?'
            }`
          )
          .bind(uid, ...ids, ...(status ? STATUS_TYPES : [type]))
          .all(),
        db
          .prepare('SELECT COUNT(*) AS n FROM account_lists WHERE user_id=? AND list_type=?')
          .bind(uid, type)
          .all()
      ])
      // Import never overrides an entry already in this list or a status the
      // account already chose for that title.
      const known = new Set(present.map((row) => String(row.kp_id)))
      const fresh = items.filter((item) => !known.has(item.kp_id))
      const room = Math.max(0, LIST_CAPACITY - Number(size[0]?.n || 0))
      const rejected = Math.max(0, fresh.length - room)
      if (!fresh.length) return reply({ added: 0, rejected: 0 })
      if (!room) return capacityReply(reply, { added: 0, rejected })
      const results = await db.batch(
        fresh.slice(0, room).map((item) =>
          db
            .prepare(
              'INSERT INTO account_lists(user_id,list_type,kp_id,metadata,added_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,list_type,kp_id) DO NOTHING'
            )
            .bind(uid, type, item.kp_id, JSON.stringify(item), item.addedAt)
        )
      )
      return reply({ added: results.reduce((sum, result) => sum + result.meta.changes, 0), rejected })
    }
    const status = /^\/api\/list-status\/([1-9]\d{0,11})$/.exec(path)
    if (status && request.method === 'GET') {
      const { results } = await db
        .prepare(
          "SELECT list_type FROM account_lists WHERE user_id=? AND kp_id=? UNION ALL SELECT 'history' AS list_type FROM user_history WHERE user_id=? AND kp_id=? AND deleted=0"
        )
        .bind(uid, status[1], uid, status[1])
        .all()
      const active = new Set(results.map((row) => row.list_type))
      return reply(Object.fromEntries([...TYPES].map((type) => [type, active.has(type)])))
    }
    if (path === '/api/notifications' && request.method === 'GET')
      return reply({ notifications: [], unread_count: 0 })
    if (path === '/api/notifications/unread-count' && request.method === 'GET')
      return reply({ unread_count: 0 })
    if (path === '/api/user' && request.method === 'GET')
      return reply({
        id: user.id,
        telegram_id: user.id,
        name: user.name,
        photo: null,
        role: 'user',
        allow_comments: 0
      })
    if (path === '/api/user/name' && request.method === 'PUT') {
      const body = await boundedJson(request.body, 1024)
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80)
        return reply({ error: 'Invalid name' }, 400)
      await db
        .prepare('UPDATE tg_users SET name=? WHERE telegram_id=?')
        .bind(body.name.trim(), user.id)
        .run()
      return reply({ ok: true })
    }
    const counters = /^\/api\/user-list-counters\/([1-9]\d{0,19})$/.exec(path)
    if (counters && request.method === 'GET') {
      if (counters[1] !== user.id) return reply({ error: 'Private profile' }, 404)
      const { results } = await db
        .prepare(
          'SELECT list_type, COUNT(*) AS count FROM account_lists WHERE user_id=? GROUP BY list_type'
        )
        .bind(uid)
        .all()
      const counts = Object.fromEntries([...TYPES].map((type) => [type, 0]))
      for (const row of results) counts[row.list_type] = row.count
      counts.history = (
        await db
          .prepare('SELECT COUNT(*) AS count FROM user_history WHERE user_id=? AND deleted=0')
          .bind(uid)
          .first()
      ).count
      return reply(counts)
    }
    let match = /^\/api\/list\/([a-z]+)(?:\/([1-9]\d{0,11}))?$/.exec(path)
    const publicMatch = /^\/api\/user-list\/([1-9]\d{0,19})\/([a-z]+)$/.exec(path)
    if (publicMatch) {
      if (publicMatch[1] !== user.id) return reply({ error: 'Private profile' }, 404)
      match = [null, publicMatch[2], undefined]
    }
    if (!match || !TYPES.has(match[1])) return reply({ error: 'Not found' }, 404)
    const [, type, id] = match
    if (publicMatch && request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405)
    if (type === 'history') {
      // Old clients use this alias. It is already authenticated and charged
      // above, so hand the verified identity through instead of re-checking.
      const url = new URL(request.url)
      url.pathname = `/api/history${id ? `/${id}` : ''}`
      const response = await serveHistory(new Request(url, request), env, origin, uid)
      if (request.method !== 'GET' || !response.ok) return response
      // Keep the bare-array shape; expose the next page through a header.
      const page = await response.json()
      const listed = reply(page.history)
      if (page.nextCursor) {
        listed.headers.set('X-Next-Cursor', page.nextCursor)
        listed.headers.set('Access-Control-Expose-Headers', 'X-Next-Cursor')
      }
      return listed
    }
    if (id && request.method === 'PATCH') {
      let metadata
      try {
        metadata = await readMetadataPatch(request, id)
      } catch {
        return reply({ error: 'Invalid metadata' }, 400)
      }
      const update = metadataUpdate('account_lists', metadata, { userId: uid, id, type })
      if (update)
        await db
          .prepare(update.sql)
          .bind(...update.params)
          .run()
      return reply({ ok: true })
    }
    if (!id && request.method === 'GET') {
      const { results } = await db
        .prepare(
          'SELECT metadata FROM account_lists WHERE user_id=? AND list_type=? ORDER BY added_at DESC LIMIT 1000'
        )
        .bind(uid, type)
        .all()
      return reply(results.map((row) => JSON.parse(row.metadata)))
    }
    if (request.method === 'DELETE') {
      await db
        .prepare(
          `DELETE FROM account_lists WHERE user_id=? AND list_type=?${id ? ' AND kp_id=?' : ''}`
        )
        .bind(...(id ? [uid, type, id] : [uid, type]))
        .run()
      return reply({ ok: true })
    }
    if (id && request.method === 'PUT') {
      let item
      try {
        if (!(request.headers.get('Content-Type') || '').startsWith('application/json'))
          throw new Error('JSON required')
        const body = await boundedJson(request.body, MAX_LIST_BODY_BYTES)
        ;[item] = normalizeHistory([
          { ...body.metadata, kp_id: id, addedAt: new Date().toISOString() }
        ])
      } catch (error) {
        if (error.message === 'Body too large')
          return reply({ error: 'Metadata payload too large' }, 413)
        return reply({ error: 'Invalid metadata' }, 400)
      }
      const upsert = db
        .prepare(
          `INSERT INTO account_lists(user_id,list_type,kp_id,metadata,added_at) VALUES (?,?,?,?,?)
         ON CONFLICT(user_id,list_type,kp_id) DO UPDATE SET metadata=excluded.metadata,added_at=excluded.added_at`
        )
        .bind(uid, type, id, JSON.stringify(item), item.addedAt)
      if (!STATUS_TYPES.includes(type)) {
        await upsert.run()
        return reply({ ok: true })
      }
      // Choosing a status replaces the previous one in the same transaction.
      const others = STATUS_TYPES.filter((other) => other !== type)
      const [removed] = await db.batch([
        db
          .prepare(
            `DELETE FROM account_lists WHERE user_id=? AND kp_id=? AND list_type IN (${others.map(() => '?').join(',')})`
          )
          .bind(uid, id, ...others),
        upsert
      ])
      return reply({ ok: true, replaced: removed.meta.changes > 0 })
    }
    return reply({ error: 'Method not allowed' }, 405)
  } catch (error) {
    if (/list_capacity/.test(error.message)) return capacityReply(reply)
    return reply({ error: 'Account service unavailable' }, 503)
  }
}
