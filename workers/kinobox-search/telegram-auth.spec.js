// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveTelegramAuth, cleanupAuth } from './telegram-auth.mjs'
import { sha256, verifyWorkerSession } from './private-api.mjs'
import { serveAccount } from './account.mjs'
import { serveHistory } from './history.mjs'
import { testDatabase } from './test-db.mjs'

const origin = 'https://reyhoho.fun'
const allow = { limit: async () => ({ success: true }) }
const envFor = (db) => ({
  HISTORY_DB: db,
  TELEGRAM_AUTH_ENABLED: 'true',
  TELEGRAM_BOT_USERNAME: 'test_only_bot',
  TELEGRAM_BOT_TOKEN: 'test-only-placeholder',
  TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
  AUTH_RATE_LIMITER: allow,
  LOGIN_RATE_LIMITER: allow,
  ACCOUNT_RATE_LIMITER: allow
})
const request = (path, body = {}, method = 'POST', headers = {}) =>
  new Request(`https://api.reyhoho.fun/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  })
const authCall = (env, path, body = {}, headers = {}) =>
  serveTelegramAuth(request(`/auth/${path}`, body, 'POST', headers), env, origin)
const webhook = (env, body, secret = env.TELEGRAM_WEBHOOK_SECRET) =>
  authCall(env, 'telegram-webhook', body, { 'X-Telegram-Bot-Api-Secret-Token': secret })
const sender = (id = 123) => ({ id, first_name: 'Test', is_bot: false })
const startUpdate = (token, id = 123) => ({
  message: { text: `/start ${token}`, from: sender(id), chat: { id, type: 'private' } }
})
const callbackUpdate = (token, id = 123) => ({
  callback_query: {
    id: 'callback-id',
    data: `ok:${token}`,
    from: sender(id),
    message: { chat: { id, type: 'private' } }
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Telegram Worker auth', () => {
  it('drains an expired backlog beyond one batch while preserving valid challenges and sessions', async () => {
    const db = testDatabase()
    const future = Math.floor(Date.now() / 1000) + 86400
    db.sqlite.prepare('INSERT INTO tg_users VALUES (?,?)').run('123', 'Test')
    const login = db.sqlite.prepare(
      'INSERT INTO tg_login(poll_hash,start_hash,code,expires_at) VALUES (?,?,?,?)'
    )
    const session = db.sqlite.prepare('INSERT INTO tg_sessions VALUES (?,?,?,?)')
    db.sqlite.exec('BEGIN')
    for (let i = 0; i < 2501; i++) {
      login.run(`poll${i}`, `start${i}`, '123456', 0)
      session.run(`session${i}`, '123', 0, 0)
    }
    login.run('valid-poll', 'valid-start', '123456', future)
    session.run('valid-session', '123', future, 0)
    db.sqlite.exec('COMMIT')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanupAuth(envFor(db))
    expect(db.sqlite.prepare('SELECT poll_hash FROM tg_login').all()).toEqual([
      { poll_hash: 'valid-poll' }
    ])
    expect(db.sqlite.prepare('SELECT token_hash FROM tg_sessions').all()).toEqual([
      { token_hash: 'valid-session' }
    ])
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      batches: 3,
      removed: 5002,
      capped: false
    })
    db.sqlite.close()
  })
  it('requires configuration, JSON, rate limits, method and webhook secret', async () => {
    const db = testDatabase()
    const env = envFor(db)
    expect((await authCall({}, 'telegram-login-token')).status).toBe(503)
    expect(
      (await serveTelegramAuth(request('/auth/telegram-login-token', {}, 'GET'), env, origin))
        .status
    ).toBe(405)
    expect((await webhook(env, {}, 'wrong-secret')).status).toBe(403)
    expect(
      (
        await authCall(
          { ...env, LOGIN_RATE_LIMITER: { limit: async () => ({ success: false }) } },
          'telegram-login-token'
        )
      ).status
    ).toBe(429)
    expect(
      (await authCall({ ...env, AUTH_RATE_LIMITER: undefined }, 'telegram-login-token')).status
    ).toBe(503)
    db.sqlite.close()
  })
  it('uses separate poll/start secrets, requires explicit bound-user confirmation and consumes once', async () => {
    const db = testDatabase()
    const env = envFor(db)
    const fetchMock = vi.fn(async () => Response.json({ ok: true, result: {} }))
    vi.stubGlobal('fetch', fetchMock)
    const created = await (await authCall(env, 'telegram-login-token')).json()
    const start = new URL(created.telegram_link).searchParams.get('start')
    expect(start).not.toBe(created.token)
    const stored = JSON.stringify(db.sqlite.prepare('SELECT * FROM tg_login').all())
    expect(stored).not.toContain(created.token)
    expect(stored).not.toContain(start)
    expect((await authCall(env, 'check-telegram-auth', { token: start })).status).toBe(404)
    await webhook(env, startUpdate(start))
    expect(
      (await (await authCall(env, 'check-telegram-auth', { token: created.token })).json())
        .authenticated
    ).toBe(false)
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).reply_markup.inline_keyboard[0][0].callback_data
    ).toBe(`ok:${start}`)
    await webhook(env, callbackUpdate(start, 999))
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tg_users').get().n).toBe(0)
    await webhook(env, callbackUpdate(start))
    const response = await (
      await authCall(env, 'check-telegram-auth', { token: created.token })
    ).json()
    expect(response.authenticated).toBe(true)
    expect(response.token).toMatch(/^rh1_[A-Za-z0-9_-]{43}$/)
    const bearer = { Authorization: `Bearer ${response.token}` }
    expect((await verifyWorkerSession(request('/user', {}, 'GET', bearer), env)).id).toBe('123')
    expect((await authCall(env, 'check-telegram-auth', { token: created.token })).status).toBe(404)
    expect(JSON.stringify(db.sqlite.prepare('SELECT * FROM tg_sessions').all())).not.toContain(
      response.token
    )
    await authCall(env, 'logout', {}, bearer)
    expect(await verifyWorkerSession(request('/user', {}, 'GET', bearer), env)).toBeNull()
    db.sqlite.close()
  })
  it('shows where a request came from and lets the owner end the session it produced', async () => {
    const db = testDatabase()
    const env = envFor(db)
    const sent = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        sent.push(JSON.parse(options.body))
        return Response.json({ ok: true, result: {} })
      })
    )
    const browser = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      'CF-IPCountry': 'DE'
    }
    const login = async (headers) => {
      const created = await (await authCall(env, 'telegram-login-token', {}, headers)).json()
      const start = new URL(created.telegram_link).searchParams.get('start')
      await webhook(env, startUpdate(start))
      await webhook(env, callbackUpdate(start))
      const polled = await (
        await authCall(env, 'check-telegram-auth', { token: created.token }, headers)
      ).json()
      return polled.token
    }
    const first = await login(browser)
    expect(sent[0].text).toContain('Запрос создан меньше минуты назад: Chrome, Windows, DE.')
    const notice = sent.find((message) => message.text?.startsWith('Выполнен вход'))
    expect(notice).toMatchObject({ chat_id: '123' })
    expect(notice.text).toContain('Chrome, Windows, DE')
    const [[revokeOne], [revokeAll]] = notice.reply_markup.inline_keyboard
    expect(revokeOne.callback_data).toMatch(/^rv:[0-9a-f]{40}$/)
    expect(revokeAll.callback_data).toBe('rva')
    expect(JSON.stringify(sent)).not.toContain(first)
    const second = await login({})
    const session = (token) =>
      verifyWorkerSession(request('/user', {}, 'GET', { Authorization: `Bearer ${token}` }), env)
    const press = (data, id = 123) => {
      const update = callbackUpdate('x'.repeat(43), id)
      update.callback_query.data = data
      return webhook(env, update)
    }
    // Another Telegram user cannot end someone else's session.
    await press(revokeOne.callback_data, 999)
    expect((await session(first)).id).toBe('123')
    await press(revokeOne.callback_data)
    expect(await session(first)).toBeNull()
    expect((await session(second)).id).toBe('123')
    expect(sent.at(-1).text).toBe('Вход завершён: это устройство вышло из аккаунта.')
    await press(revokeOne.callback_data)
    expect(sent.at(-1).text).toBe('Этот вход уже завершён.')
    await press('rva')
    expect(await session(second)).toBeNull()
    expect(sent.at(-1).text).toBe('Завершено входов: 1. Войдите заново на своих устройствах.')
    db.sqlite.close()
  })
  it('keeps the login when the sign-in notice cannot be sent', async () => {
    const db = testDatabase()
    const env = envFor(db)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) =>
        JSON.parse(options.body).text?.startsWith('Выполнен вход')
          ? Response.json({ ok: false }, { status: 500 })
          : Response.json({ ok: true, result: {} })
      )
    )
    const created = await (await authCall(env, 'telegram-login-token')).json()
    const start = new URL(created.telegram_link).searchParams.get('start')
    await webhook(env, startUpdate(start))
    await webhook(env, callbackUpdate(start))
    const waits = []
    const polled = await serveTelegramAuth(
      request('/auth/check-telegram-auth', { token: created.token }),
      env,
      origin,
      { waitUntil: (promise) => waits.push(promise) }
    )
    expect((await polled.json()).authenticated).toBe(true)
    expect(waits).toHaveLength(1)
    await expect(waits[0]).resolves.toBeUndefined()
    db.sqlite.close()
  })
  it('blocks new logins when switched off but keeps sessions and logout working', async () => {
    const db = testDatabase()
    const env = { ...envFor(db), TELEGRAM_AUTH_ENABLED: 'false' }
    const access = 'rh1_' + 'b'.repeat(43)
    db.sqlite.prepare('INSERT INTO tg_users VALUES (?,?)').run('123', 'Test')
    db.sqlite
      .prepare('INSERT INTO tg_sessions VALUES (?,?,?,?)')
      .run(await sha256(access), '123', Math.floor(Date.now() / 1000) + 3600, 0)
    const bearer = { Authorization: `Bearer ${access}` }
    expect((await authCall(env, 'telegram-login-token')).status).toBe(503)
    expect((await verifyWorkerSession(request('/user', {}, 'GET', bearer), env)).id).toBe('123')
    expect((await authCall(env, 'logout', {}, bearer)).status).toBe(200)
    expect(await verifyWorkerSession(request('/user', {}, 'GET', bearer), env)).toBeNull()
    db.sqlite.close()
  })
  it('uses a workerd-compatible redirect mode when sending Telegram messages', async () => {
    const db = testDatabase()
    const env = envFor(db)
    const fetchMock = vi.fn(async (url, options) => {
      expect(options.redirect).toBe('manual')
      // Node's Request accepts 'error'; workerd throws before the request is sent.
      if (options.redirect !== 'manual') throw new TypeError('Invalid redirect value')
      return Response.json({ ok: true, result: {} })
    })
    vi.stubGlobal('fetch', fetchMock)
    const created = await (await authCall(env, 'telegram-login-token')).json()
    const start = new URL(created.telegram_link).searchParams.get('start')
    expect((await webhook(env, startUpdate(start))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await webhook(env, callbackUpdate(start))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    db.sqlite.close()
  })
  it.each(['redirect', 'api-error', 'network-error'])(
    'fails closed on Telegram %s without logging credentials or user data',
    async (kind) => {
      const db = testDatabase()
      const env = envFor(db)
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchMock = vi.fn(async () => {
        if (kind === 'redirect')
          return new Response(null, { status: 302, headers: { Location: 'https://other.invalid' } })
        if (kind === 'api-error')
          return Response.json(
            { ok: false, error_code: 403, description: env.TELEGRAM_BOT_TOKEN },
            { status: 403 }
          )
        throw new Error(`Network failure https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`)
      })
      vi.stubGlobal('fetch', fetchMock)
      const created = await (await authCall(env, 'telegram-login-token')).json()
      const start = new URL(created.telegram_link).searchParams.get('start')
      expect((await webhook(env, startUpdate(start))).status).toBe(503)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const logs = JSON.stringify(logged.mock.calls)
      expect(logs).toContain('telegram_call_failed')
      expect(logs).not.toContain(env.TELEGRAM_BOT_TOKEN)
      expect(logs).not.toContain(env.TELEGRAM_WEBHOOK_SECRET)
      expect(logs).not.toContain(start)
      expect(logs).not.toContain('chat_id')
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tg_sessions').get().n).toBe(0)
      db.sqlite.close()
    }
  )
  it('expires challenges and sessions, rejects group updates and forgery', async () => {
    const db = testDatabase()
    const env = envFor(db)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true }))
    )
    const created = await (await authCall(env, 'telegram-login-token')).json()
    const start = new URL(created.telegram_link).searchParams.get('start')
    const group = startUpdate(start)
    group.message.chat.type = 'group'
    await webhook(env, group)
    expect(db.sqlite.prepare('SELECT candidate_id FROM tg_login').get().candidate_id).toBeNull()
    db.sqlite.exec('UPDATE tg_login SET expires_at=0')
    expect((await authCall(env, 'check-telegram-auth', { token: created.token })).status).toBe(410)
    await cleanupAuth(env)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tg_login').get().n).toBe(0)
    expect(
      await verifyWorkerSession(
        request('/user', {}, 'GET', { Authorization: `Bearer rh1_${'a'.repeat(43)}` }),
        env
      )
    ).toBeNull()
    db.sqlite.close()
  })
  it('keeps lists and history private; own auth does not call external /user', async () => {
    const db = testDatabase()
    const env = envFor(db)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true }))
    )
    const created = await (await authCall(env, 'telegram-login-token')).json()
    const start = new URL(created.telegram_link).searchParams.get('start')
    await webhook(env, startUpdate(start))
    await webhook(env, callbackUpdate(start))
    const { token } = await (
      await authCall(env, 'check-telegram-auth', { token: created.token })
    ).json()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('External auth MUST NOT be used')
      })
    )
    const headers = { Authorization: `Bearer ${token}` }
    const own = await serveAccount(request('/user', {}, 'GET', headers), env, origin)
    expect((await own.json()).id).toBe('123')
    expect(
      (
        await serveAccount(
          request('/list/favorite/301', { metadata: { title: 'Матрица' } }, 'PUT', headers),
          env,
          origin
        )
      ).status
    ).toBe(200)
    const list = await serveAccount(request('/list/favorite', {}, 'GET', headers), env, origin)
    expect((await list.json())[0].title).toBe('Матрица')
    expect(
      (await serveAccount(request('/user-list/999/favorite', {}, 'GET', headers), env, origin))
        .status
    ).toBe(404)
    expect(
      (
        await serveHistory(
          request('/history/301', { title: 'Матрица' }, 'PUT', headers),
          env,
          origin
        )
      ).status
    ).toBe(200)
    expect(
      (await (await serveHistory(request('/history', {}, 'GET', headers), env, origin)).json())
        .history
    ).toHaveLength(1)
    expect((await serveAccount(request('/list/favorite', {}, 'GET'), env, origin)).status).toBe(401)
    await serveAccount(request('/list/favorite/301', {}, 'DELETE', headers), env, origin)
    expect(
      await (await serveAccount(request('/list/favorite', {}, 'GET', headers), env, origin)).json()
    ).toEqual([])
    db.sqlite.close()
  })
})
