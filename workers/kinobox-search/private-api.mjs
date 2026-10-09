export async function boundedJson(stream, limit) {
  if (!stream) throw new Error('Empty body')
  const reader = stream.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error('Body too large')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function privateReply(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || 'https://reyhoho.fun',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin'
  }
  return (data, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), { status, headers })
}

export function secureOrigin(origin) {
  return (
    !origin ||
    origin.startsWith('https://') ||
    /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
  )
}

export function primaryDb(env) {
  return env.HISTORY_DB.withSession ? env.HISTORY_DB.withSession('first-primary') : env.HISTORY_DB
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export async function verifyWorkerSession(request, env) {
  if (env.TELEGRAM_AUTH_ENABLED !== 'true' || !env.HISTORY_DB) return null
  const header = request.headers.get('Authorization') || ''
  if (!/^Bearer rh1_[A-Za-z0-9_-]{43}$/.test(header)) return null
  return primaryDb(env)
    .prepare(
      `SELECT u.telegram_id AS id, u.name FROM tg_sessions s
     JOIN tg_users u ON u.telegram_id = s.telegram_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(await sha256(header.slice(7)), Math.floor(Date.now() / 1000))
    .first()
}

export async function checkLimit(binding, key) {
  // Missing limiter fails closed; do not silently expose unlimited auth writes.
  if (!binding) throw new Error('Rate limiter missing')
  return (await binding.limit({ key })).success
}
