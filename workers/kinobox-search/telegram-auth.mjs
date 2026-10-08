import {
  boundedJson,
  checkLimit,
  primaryDb,
  privateReply,
  randomToken,
  secureOrigin,
  sha256,
  verifyWorkerSession
} from './private-api.mjs'

export const LOGIN_TTL = 600
const SESSION_TTL = 30 * 86400
const validNonce = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ''))

async function equalSecret(a, b) {
  if (!a || !b || a.length > 256 || b.length > 256) return false
  const [left, right] = await Promise.all([sha256(a), sha256(b)])
  let difference = 0
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return difference === 0
}

async function telegramCall(env, method, payload) {
  // Telegram's API requires the bot token in its URL. Never log fetch errors/URLs.
  let phase = 'fetch'
  let status = null
  let telegramErrorCode = null
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // workerd rejects redirect: 'error'. Never follow a bot-token URL redirect.
        redirect: 'manual',
        signal: AbortSignal.timeout(8000)
      }
    )
    status = response.status
    if (status >= 300 && status < 400) {
      phase = 'redirect'
      await response.body?.cancel()
      throw new Error('Telegram redirect refused')
    }
    phase = 'read'
    const data = await boundedJson(response.body, 32768)
    phase = 'api'
    telegramErrorCode = Number.isInteger(data.error_code) ? data.error_code : null
    if (!response.ok || data.ok !== true) throw new Error('Telegram unavailable')
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'telegram_call_failed',
        method,
        phase,
        status,
        telegramErrorCode,
        timeout: error?.name === 'TimeoutError' || error?.name === 'AbortError'
      })
    )
    throw new Error('Telegram unavailable')
  }
}

async function handleWebhook(request, env, reply) {
  if (
    !(await equalSecret(
      request.headers.get('X-Telegram-Bot-Api-Secret-Token'),
      env.TELEGRAM_WEBHOOK_SECRET
    ))
  )
    return reply({ error: 'Forbidden' }, 403)
  let update
  try {
    update = await boundedJson(request.body, 65536)
  } catch {
    return reply({ error: 'Invalid update' }, 400)
  }
  const db = primaryDb(env)
  const now = Math.floor(Date.now() / 1000)
  const message = update.message
  const callback = update.callback_query
  if (message) {
    const match = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{43})$/.exec(String(message.text || '').trim())
    const sender = message.from
    if (
      !match ||
      !validId(sender?.id) ||
      sender.is_bot ||
      message.chat?.type !== 'private' ||
      String(message.chat.id) !== String(sender.id)
    )
      return reply({ ok: true })
    const startHash = await sha256(match[1])
    const id = String(sender.id)
    const name = String(sender.first_name || sender.username || 'Пользователь').slice(0, 80)
    await db
      .prepare(
        `UPDATE tg_login SET candidate_id=?, candidate_name=?
       WHERE start_hash=? AND status='pending' AND expires_at>?
       AND (candidate_id IS NULL OR candidate_id=?)`
      )
      .bind(id, name, startHash, now, id)
      .run()
    const login = await db
      .prepare(
        `SELECT code FROM tg_login WHERE start_hash=? AND candidate_id=?
       AND status='pending' AND expires_at>?`
      )
      .bind(startHash, id, now)
      .first()
    if (!login) {
      await telegramCall(env, 'sendMessage', {
        chat_id: id,
        text: 'Ссылка истекла или уже использована. Создайте новый запрос входа на reyhoho.fun.'
      })
      return reply({ ok: true })
    }
    await telegramCall(env, 'sendMessage', {
      chat_id: id,
      text: `Вход на reyhoho.fun\nКод: ${login.code}\nПодтверждайте только свой запрос. Если вы не открывали сайт — не нажимайте кнопку. Не передавайте эту ссылку другим.`,
      reply_markup: {
        inline_keyboard: [[{ text: 'Подтвердить вход', callback_data: `ok:${match[1]}` }]]
      }
    })
  } else if (callback) {
    const match = /^ok:([A-Za-z0-9_-]{43})$/.exec(String(callback.data || ''))
    const id = String(callback.from?.id || '')
    if (
      !match ||
      !validId(id) ||
      callback.from?.is_bot ||
      callback.message?.chat?.type !== 'private' ||
      String(callback.message.chat.id) !== id ||
      typeof callback.id !== 'string' ||
      callback.id.length > 128
    )
      return reply({ ok: true })
    const startHash = await sha256(match[1])
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO tg_users(telegram_id,name)
         SELECT candidate_id,candidate_name FROM tg_login
         WHERE start_hash=? AND candidate_id=? AND status='pending' AND expires_at>?
         ON CONFLICT(telegram_id) DO NOTHING`
        )
        .bind(startHash, id, now),
      db
        .prepare(
          `UPDATE tg_login SET status='confirmed' WHERE start_hash=? AND candidate_id=?
         AND status='pending' AND expires_at>?`
        )
        .bind(startHash, id, now)
    ])
    await telegramCall(env, 'answerCallbackQuery', {
      callback_query_id: callback.id,
      text:
        results[1].meta.changes > 0
          ? 'Вход подтверждён. Вернитесь на сайт.'
          : 'Запрос уже обработан или истёк.'
    })
  }
  return reply({ ok: true })
}

export async function serveTelegramAuth(request, env, origin) {
  const reply = privateReply(origin)
  if (!secureOrigin(origin)) return reply({ error: 'HTTPS required' }, 403)
  if (request.method === 'OPTIONS') return reply(null, 204)
  const path = new URL(request.url).pathname
  if (
    ![
      '/api/auth/telegram-login-token',
      '/api/auth/check-telegram-auth',
      '/api/auth/telegram-webhook',
      '/api/auth/logout'
    ].includes(path)
  )
    return reply({ error: 'Not found' }, 404)
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  if (
    env.TELEGRAM_AUTH_ENABLED !== 'true' ||
    !env.HISTORY_DB ||
    !/^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_USERNAME || '') ||
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_WEBHOOK_SECRET
  )
    return reply({ error: 'Telegram auth not configured' }, 503)
  try {
    if (path === '/api/auth/telegram-webhook') return await handleWebhook(request, env, reply)
    if (
      !(await checkLimit(
        env.AUTH_RATE_LIMITER,
        `${path}:${request.headers.get('CF-Connecting-IP') || 'local'}`
      ))
    )
      return reply({ error: 'Too many requests' }, 429)
    const db = primaryDb(env)
    const now = Math.floor(Date.now() / 1000)
    if (path === '/api/auth/logout') {
      const user = await verifyWorkerSession(request, env)
      if (!user) return reply({ error: 'Invalid session' }, 401)
      await db
        .prepare('DELETE FROM tg_sessions WHERE token_hash=?')
        .bind(await sha256(request.headers.get('Authorization').slice(7)))
        .run()
      return reply({ ok: true })
    }
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json'))
      return reply({ error: 'JSON required' }, 400)
    if (path === '/api/auth/telegram-login-token') {
      if (
        !(await checkLimit(
          env.LOGIN_RATE_LIMITER,
          request.headers.get('CF-Connecting-IP') || 'local'
        ))
      )
        return reply({ error: 'Too many login requests' }, 429)
      // Browser polling credential and Telegram link credential are DIFFERENT.
      const poll = randomToken()
      const start = randomToken()
      const code = (await sha256(start)).slice(0, 6).toUpperCase()
      await db
        .prepare('INSERT INTO tg_login(poll_hash,start_hash,code,expires_at) VALUES (?,?,?,?)')
        .bind(await sha256(poll), await sha256(start), code, now + LOGIN_TTL)
        .run()
      return reply({
        token: poll,
        telegram_link: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${start}`,
        code,
        expires_in: LOGIN_TTL
      })
    }
    let token
    try {
      token = (await boundedJson(request.body, 1024)).token
    } catch {
      return reply({ error: 'Invalid login token' }, 400)
    }
    if (!validNonce(token)) return reply({ error: 'Invalid login token' }, 400)
    const pollHash = await sha256(token)
    const access = `rh1_${randomToken()}`
    const sessionHash = await sha256(access)
    // Consume once AND insert session atomically; a concurrent poll cannot mint a second session.
    const results = await db.batch([
      db
        .prepare(
          `UPDATE tg_login SET status='consumed',session_hash=?
         WHERE poll_hash=? AND status='confirmed' AND expires_at>? RETURNING candidate_id`
        )
        .bind(sessionHash, pollHash, now),
      db
        .prepare(
          `INSERT INTO tg_sessions(token_hash,telegram_id,expires_at,created_at)
         SELECT session_hash,candidate_id,?,? FROM tg_login
         WHERE poll_hash=? AND status='consumed' AND session_hash=?`
        )
        .bind(now + SESSION_TTL, now, pollHash, sessionHash),
      db
        .prepare(
          `DELETE FROM tg_sessions WHERE token_hash IN
         (SELECT token_hash FROM tg_sessions WHERE telegram_id=
           (SELECT candidate_id FROM tg_login WHERE poll_hash=?)
          ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET 10)`
        )
        .bind(pollHash)
    ])
    if (results[0].meta.changes > 0) return reply({ authenticated: true, token: access })
    const login = await db
      .prepare('SELECT status,expires_at FROM tg_login WHERE poll_hash=?')
      .bind(pollHash)
      .first()
    if (!login || login.status === 'consumed')
      return reply({ error: 'Login token used or missing' }, 404)
    if (login.expires_at <= now) return reply({ error: 'Login token expired' }, 410)
    return reply({ authenticated: false })
  } catch {
    console.error(JSON.stringify({ event: 'auth_service_failed', path }))
    return reply({ error: 'Authentication service unavailable' }, 503)
  }
}

export async function cleanupAuth(env) {
  if (!env.HISTORY_DB) return
  const db = primaryDb(env)
  const now = Math.floor(Date.now() / 1000)
  await db.batch([
    db
      .prepare(
        'DELETE FROM tg_login WHERE poll_hash IN (SELECT poll_hash FROM tg_login WHERE expires_at < ? LIMIT 1000)'
      )
      .bind(now),
    db
      .prepare(
        'DELETE FROM tg_sessions WHERE token_hash IN (SELECT token_hash FROM tg_sessions WHERE expires_at < ? LIMIT 1000)'
      )
      .bind(now)
  ])
}
