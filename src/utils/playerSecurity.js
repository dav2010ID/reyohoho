const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const DEFAULT_REVIEWED_ORIGINS = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com'
]

const toOrigin = (value) => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

// Reject executable content before a provider URL can reach an iframe.
export const getSafePlayerUrl = (value, currentOrigin = typeof window !== 'undefined' ? window.location.origin : '') => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value, currentOrigin || undefined)
    if (url.username || url.password) return null
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) return null
    return value.trim()
  } catch {
    return null
  }
}

export const PLAYER_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups'

const originList = (value) =>
  new Set(
    String(value || '')
      .split(',')
      .map((item) => toOrigin(item.trim()))
      .filter(Boolean)
  )

// Opt-in: many embedded players detect a sandbox and refuse to play. Roll it out
// per provider with VITE_PLAYER_SANDBOX_ORIGINS (origins verified to play
// sandboxed), or for all with VITE_PLAYER_IFRAME_SANDBOX=true.
// null removes the attribute; an empty string would apply the strictest sandbox.
export const getPlayerIframeSandbox = (env = import.meta.env, iframeUrl = '') => {
  if (env.VITE_PLAYER_IFRAME_SANDBOX === 'true') return PLAYER_IFRAME_SANDBOX
  const origin = toOrigin(iframeUrl)
  return origin && originList(env.VITE_PLAYER_SANDBOX_ORIGINS).has(origin)
    ? PLAYER_IFRAME_SANDBOX
    : null
}

export const getReviewedPlayerOrigins = (env = import.meta.env) =>
  new Set([
    ...originList(DEFAULT_REVIEWED_ORIGINS.join(',')),
    ...originList(env.VITE_REVIEWED_PLAYER_ORIGINS)
  ])

export const assessPlayerIframe = ({
  iframeUrl,
  currentOrigin = typeof window !== 'undefined' ? window.location.origin : '',
  env = import.meta.env
}) => {
  try {
    const url = new URL(iframeUrl, currentOrigin || undefined)
    const origin = url.origin
    if (origin === currentOrigin) return { status: 'same-origin', origin }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) {
      return { status: 'insecure', origin }
    }
    if (getReviewedPlayerOrigins(env).has(origin)) return { status: 'reviewed', origin }
    return { status: 'unreviewed', origin }
  } catch {
    return { status: 'invalid', origin: '' }
  }
}

export const getPersistablePlayerKey = (player) => {
  const key = String(player?.key || '').trim().toUpperCase()
  if (!key || key.includes('TORRENTS')) return null
  return key
}
