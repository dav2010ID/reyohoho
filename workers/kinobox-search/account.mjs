import { normalizeHistory } from '../../migration/history-transfer/history-data.js'
import {
  boundedJson,
  checkLimit,
  primaryDb,
  privateReply,
  secureOrigin,
  verifyWorkerSession
} from './private-api.mjs'
import { serveHistory } from './history.mjs'

const TYPES = new Set(['favorite', 'later', 'watching', 'completed', 'abandoned', 'history'])

export async function serveAccount(request, env, origin) {
  const reply = privateReply(origin)
  if (!secureOrigin(origin)) return reply({ error: 'HTTPS required' }, 403)
  if (request.method === 'OPTIONS') return reply(null, 204)
  if (env.TELEGRAM_AUTH_ENABLED !== 'true' || !env.HISTORY_DB)
    return reply({ error: 'Accounts not configured' }, 503)
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
      const url = new URL(request.url)
      url.pathname = `/api/history${id ? `/${id}` : ''}`
      const response = await serveHistory(new Request(url, request), env, origin)
      if (request.method === 'GET' && response.ok) return reply((await response.json()).history)
      return response
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
        const body = await boundedJson(request.body, 8192)
        ;[item] = normalizeHistory([
          { ...body.metadata, kp_id: id, addedAt: new Date().toISOString() }
        ])
      } catch {
        return reply({ error: 'Invalid metadata' }, 400)
      }
      await db
        .prepare(
          `INSERT INTO account_lists(user_id,list_type,kp_id,metadata,added_at) VALUES (?,?,?,?,?)
         ON CONFLICT(user_id,list_type,kp_id) DO UPDATE SET metadata=excluded.metadata,added_at=excluded.added_at`
        )
        .bind(uid, type, id, JSON.stringify(item), item.addedAt)
        .run()
      return reply({ ok: true })
    }
    return reply({ error: 'Method not allowed' }, 405)
  } catch (error) {
    return reply(
      { error: 'Account service unavailable' },
      /list_capacity/.test(error.message) ? 409 : 503
    )
  }
}
