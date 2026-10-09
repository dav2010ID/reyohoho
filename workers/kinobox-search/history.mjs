import { normalizeHistory } from '../../migration/history-transfer/history-data.js'
import { boundedJson, checkLimit, verifyWorkerSession } from './private-api.mjs'
import { metadataUpdate, readMetadataPatch } from './metadata.mjs'

export async function serveHistory(request, env, origin) {
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
  if (
    origin &&
    !origin.startsWith('https://') &&
    !/^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
  )
    return reply({ error: 'HTTPS required' }, 403)
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
  if (!env.HISTORY_DB || (!env.HISTORY_AUTH_USER_URL && env.TELEGRAM_AUTH_ENABLED !== 'true'))
    return reply({ error: 'History not configured' }, 503)
  const authorization = request.headers.get('Authorization') || ''
  if (!/^Bearer [^\s]{1,4096}$/.test(authorization))
    return reply({ error: 'Authentication required' }, 401)
  let userId
  if (authorization.startsWith('Bearer rh1_')) {
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
      try { metadata = await readMetadataPatch(request, id) }
      catch { return reply({ error: 'Invalid metadata' }, 400) }
      const update = metadataUpdate('user_history', metadata, { userId, id })
      if (update) await db.prepare(update.sql).bind(...update.params).run()
      return reply({ ok: true })
    }
    if (request.method === 'GET') {
      const { results } = await db
        .prepare(
          'SELECT metadata FROM user_history WHERE user_id = ? AND deleted = 0 ORDER BY added_at DESC LIMIT 1000'
        )
        .bind(userId)
        .all()
      return reply({ history: results.map((row) => JSON.parse(row.metadata)) })
    }
    if (request.method === 'DELETE') {
      await db
        .prepare(
          `UPDATE user_history SET deleted = 1, metadata = '{}', added_at = '' WHERE user_id = ? AND deleted = 0${id ? ' AND kp_id = ?' : ''}`
        )
        .bind(...(id ? [userId, id] : [userId]))
        .run()
      return reply({ ok: true })
    }
    let items
    try {
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json'))
        throw new Error('JSON required')
      const body = await boundedJson(request.body, importing ? 400000 : 8192)
      if (importing && (!Array.isArray(body.history) || body.history.length > 40))
        throw new Error('Import batch limit')
      items = normalizeHistory(
        importing ? body.history : [{ ...body, kp_id: id, addedAt: new Date().toISOString() }]
      )
      if (!items.length) throw new Error('Empty history')
    } catch {
      return reply({ error: 'Invalid history payload (maximum 40 items per import)' }, 400)
    }
    // Atomic batch, parameterized SQL, no client-selected user_id.
    // Import preserves existing records AND deletion tombstones. PUT is an explicit new viewing.
    const statements = items.map((item) =>
      db
        .prepare(
          `INSERT INTO user_history(user_id,kp_id,metadata,added_at,deleted) VALUES (?,?,?,?,0)
       ON CONFLICT(user_id,kp_id) ${
         importing
           ? 'DO NOTHING'
           : 'DO UPDATE SET metadata=excluded.metadata, added_at=excluded.added_at, deleted=0'
       }`
        )
        .bind(userId, item.kp_id, JSON.stringify(item), item.addedAt)
    )
    const result = await db.batch(statements)
    if (!importing && !result.some((entry) => entry.meta.changes > 0))
      return reply({ error: 'History capacity reached' }, 409)
    return reply({ ok: true, changed: result.reduce((sum, entry) => sum + entry.meta.changes, 0) })
  } catch (error) {
    return reply(
      { error: 'History storage unavailable' },
      /history_capacity/.test(error.message) ? 409 : 503
    )
  }
}
