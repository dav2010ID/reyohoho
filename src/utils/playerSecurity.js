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

// Opt-in: many embedded players detect a sandbox and refuse to play. Enable with
// VITE_PLAYER_IFRAME_SANDBOX=true only after playback is verified for every provider.
// null removes the attribute; an empty string would apply the strictest sandbox.
export const getPlayerIframeSandbox = (env = import.meta.env) =>
  env.VITE_PLAYER_IFRAME_SANDBOX === 'true' ? PLAYER_IFRAME_SANDBOX : null

export const getReviewedPlayerOrigins = (env = import.meta.env) =>
  new Set([
    ...DEFAULT_REVIEWED_ORIGINS,
    ...(env.VITE_REVIEWED_PLAYER_ORIGINS || '').split(',')
  ].map((value) => toOrigin(value.trim())).filter(Boolean))

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
