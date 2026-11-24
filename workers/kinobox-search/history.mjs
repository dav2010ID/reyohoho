import { HISTORY_CAPACITY, normalizeHistory } from '../../shared/history-data.js'
import { boundedJson, checkLimit, secureOrigin, verifyWorkerSession } from './private-api.mjs'
import { metadataUpdate, readMetadataPatch } from './metadata.mjs'

// `verifiedUserId` is set only by the account router after it has already
// authenticated and rate-limited this request (the /api/list/history alias).
const REPLAY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
// Queued clients replay a viewing later; keep its real time if it is plausible.
// A replay older than the window is clamped to the window start, not stamped as
// new: it must not revive a title deleted after it (or overtake a newer viewing).
function viewedAt(value, now = Date.now()) {
  const time = Date.parse(value)
  if (!Number.isFinite(time) || time > now + 5 * 60 * 1000) return new Date(now).toISOString()
  return new Date(Math.max(time, now - REPLAY_WINDOW_MS)).toISOString()
}

export async function serveHistory(request, env, origin, verifiedUserId) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || 'https://reyhoho.fun',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'private, no-store',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff'
  }
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })
  // History never accepts bearer credentials over an insecure browser origin.
  if (!secureOrigin(origin, env)) return reply({ error: 'HTTPS required' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  const path = new URL(request.url).pathname
  const id = path.match(/^\/api\/history\/([1-9]\d{0,11})$/)?.[1]
  const root = path === '/api/history'
  const importing = path === '/api/history/import'
  if (!root && !id && !importing) return reply({ error: 'Not found' }, 404)
  if (
    !(
      (root && ['GET', 'DELETE'].includes(request.method)) ||
      (id && ['PUT', 'PATCH', 'DELETE'].includes(request.method)) ||
      (importing && request.method === 'POST')
    )
  )
    return reply({ error: 'Method not allowed' }, 405)
  // Sessions stay valid while new logins are switched off (TELEGRAM_AUTH_ENABLED).
  if (!env.HISTORY_DB) return reply({ error: 'History not configured' }, 503)
  const authorization = request.headers.get('Authorization') || ''
  if (!verifiedUserId && !/^Bearer [^\s]{1,4096}$/.test(authorization))
    return reply({ error: 'Authentication required' }, 401)
  let userId = verifiedUserId
  if (userId) {
    /* Already authenticated by the caller. */
  } else if (authorization.startsWith('Bearer rh1_')) {
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
      userId = `worker-tg:${user.id}`
    } catch {
      return reply({ error: 'Authentication service unavailable' }, 503)
    }
  } else {
    if (!env.HISTORY_AUTH_USER_URL) return reply({ error: 'Invalid session' }, 401)
    try {
      const authUrl = new URL(env.HISTORY_AUTH_USER_URL)
      if (authUrl.protocol !== 'https:' || authUrl.username || authUrl.password)
        throw new Error('Invalid authority')
      const response = await fetch(authUrl, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        // workerd supports manual/follow only; reject non-200 responses below.
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      })
      if (response.status === 401 || response.status === 403)
        return reply({ error: 'Invalid token' }, 401)
      if (!response.ok) throw new Error('Authority unavailable')
      const user = await boundedJson(response.body, 16384)
      if (!/^[1-9]\d{0,19}$/.test(String(user?.id || ''))) throw new Error('Invalid identity')
      // Scope identities to the configured authority, not a client-supplied ID.
      userId = `${authUrl.href}:${user.id}`
    } catch {
      return reply({ error: 'Authentication service unavailable' }, 503)
    }
  }
  try {
    const db = env.HISTORY_DB.withSession
      ? env.HISTORY_DB.withSession('first-primary')
      : env.HISTORY_DB
    if (request.method === 'PATCH') {
      let metadata
      try {
        metadata = await readMetadataPatch(request, id)
      } catch {
        return reply({ error: 'Invalid metadata' }, 400)
      }
      const update = metadataUpdate('user_history', metadata, { userId, id })
      if (update)
        await db
          .prepare(update.sql)
          .bind(...update.params)
          .run()
      return reply({ ok: true })
    }
    if (request.method === 'GET') {
      const cursor = new URL(request.url).searchParams.get('cursor')
      let position
      if (cursor) {
        try {
          if (cursor.length > 256) throw new Error()
          position = JSON.parse(atob(cursor))
          if (
            !Array.isArray(position) ||
            position.length !== 2 ||
            typeof position[0] !== 'string' ||
            position[0].length > 32 ||
            !Number.isFinite(Date.parse(position[0])) ||
            !/^[1-9]\d{0,11}$/.test(position[1])
          )
            throw new Error()
        } catch {
          return reply({ error: 'Invalid history cursor' }, 400)
        }
      }
      const { results } = await db
        .prepare(
          `SELECT metadata, added_at, kp_id FROM user_history WHERE user_id = ? AND deleted = 0
           ${position ? 'AND (added_at < ? OR (added_at = ? AND kp_id < ?))' : ''}
           ORDER BY added_at DESC, kp_id DESC LIMIT 1001`
        )
        .bind(...(position ? [userId, position[0], position[0], position[1]] : [userId]))
        .all()
      const page = results.slice(0, 1000)
      const last = page[page.length - 1]
      return reply({
        history: page.map((row) => JSON.parse(row.metadata)),
        nextCursor: results.length > 1000 ? btoa(JSON.stringify([last.added_at, last.kp_id])) : null
      })
    }
    if (request.method === 'DELETE') {
      await db
        .prepare(
          // added_at keeps the deletion time: a viewing replayed from an older
          // offline queue must not bring the title back (see the PUT below).
          `UPDATE user_history SET deleted = 1, metadata = '{}', added_at = ? WHERE user_id = ? AND deleted = 0${id ? ' AND kp_id = ?' : ''}`
        )
        .bind(new Date().toISOString(), ...(id ? [userId, id] : [userId]))
        .run()
      return reply({ ok: true })
    }
    let items
    let partial = false
    try {
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json'))
        throw new Error('JSON required')
      const body = await boundedJson(request.body, importing ? 400000 : 8192)
      if (importing && (!Array.isArray(body.history) || body.history.length > 40))
        throw new Error('Import batch limit')
      // Clients that read `rejected` opt in; older ones keep all-or-nothing.
      partial = importing && body.partial === true
      // The /api/list/history alias sends `{ metadata }` like the other lists.
      const single = body?.metadata && typeof body.metadata === 'object' ? body.metadata : body
      items = normalizeHistory(
        importing
          ? body.history
          : [{ ...single, kp_id: id, addedAt: viewedAt(body?.viewedAt) }]
      )
      if (!items.length) throw new Error('Empty history')
    } catch {
      return reply({ error: 'Invalid history payload (maximum 40 items per import)' }, 400)
    }
    if (importing) {
      // Existing rows and deletion tombstones are skipped. The counts below are
      // advisory; concurrent writes are resolved inside the transaction.
      const ids = items.map((item) => item.kp_id)
      const presentSql = `SELECT kp_id FROM user_history WHERE user_id = ? AND kp_id IN (${ids.map(() => '?').join(',')})`
      const [{ results: present }, { results: quota }] = await Promise.all([
        db
          .prepare(presentSql)
          .bind(userId, ...ids)
          .all(),
        db.prepare('SELECT item_count FROM history_quota WHERE user_id = ?').bind(userId).all()
      ])
      const known = new Set(present.map((row) => String(row.kp_id)))
      const fresh = items.filter((item) => !known.has(item.kp_id))
      if (!fresh.length) return reply({ ok: true, changed: 0, rejected: 0 })
      const room = Math.max(0, HISTORY_CAPACITY - Number(quota[0]?.item_count || 0))
      if (!room || (!partial && fresh.length > room))
        return reply(
          { error: 'history_capacity', changed: 0, rejected: fresh.length - room, remaining: room },
          409
        )
      // Partial imports re-check the quota per row and stop at the limit; legacy
      // imports keep the aborting trigger, so the whole batch rolls back.
      const insertSql = partial
        ? `INSERT INTO user_history(user_id,kp_id,metadata,added_at,deleted)
           SELECT ?,?,?,?,0 WHERE COALESCE((SELECT item_count FROM history_quota WHERE user_id = ?),0) < ${HISTORY_CAPACITY}
           ON CONFLICT(user_id,kp_id) DO NOTHING`
        : `INSERT INTO user_history(user_id,kp_id,metadata,added_at,deleted) VALUES (?,?,?,?,0)
           ON CONFLICT(user_id,kp_id) DO NOTHING`
      const result = await db.batch([
        ...fresh.map((item) =>
          db
            .prepare(insertSql)
            .bind(
              userId,
              item.kp_id,
              JSON.stringify(item),
              item.addedAt,
              ...(partial ? [userId] : [])
            )
        ),
        db.prepare(presentSql).bind(userId, ...ids)
      ])
      // Counted from the rows themselves: meta.changes includes quota-trigger
      // writes. Whatever is still absent was left out for capacity.
      const stored = new Set((result.at(-1).results || []).map((row) => String(row.kp_id)))
      const changed = fresh.filter((item) => stored.has(item.kp_id)).length
      return reply({ ok: true, changed, rejected: fresh.length - changed })
    }
    // A viewing. It never moves a newer viewing back in time, and it revives a
    // deleted title only when it happened after the deletion (added_at holds the
    // deletion time; tombstones written before that change have '' and revive).
    const [item] = items
    const result = await db
      .prepare(
        `INSERT INTO user_history(user_id,kp_id,metadata,added_at,deleted) VALUES (?,?,?,?,0)
         ON CONFLICT(user_id,kp_id) DO UPDATE SET metadata=excluded.metadata, added_at=excluded.added_at, deleted=0
         WHERE excluded.added_at >= user_history.added_at`
      )
      .bind(userId, item.kp_id, JSON.stringify(item), item.addedAt)
      .run()
    if (!(result.meta?.changes > 0)) return reply({ ok: true, changed: 0, stale: true })
    return reply({ ok: true, changed: result.meta.changes, rejected: 0 })
  } catch (error) {
    return /history_capacity/.test(error.message)
      ? reply({ error: 'history_capacity', remaining: 0 }, 409)
      : reply({ error: 'History storage unavailable' }, 503)
  }
}
