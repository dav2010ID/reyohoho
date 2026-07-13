const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const trustedOrigin = (value) => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export const getTrustedApiOrigins = (env = import.meta.env) => {
  const configuredOrigins = (env.VITE_TRUSTED_API_ORIGINS || '').split(',')
  const candidates = [
    env.VITE_APP_API_URL,
    env.VITE_LOCAL_API_URL || 'http://localhost:8000',
    ...configuredOrigins
  ]

  return new Set(candidates.map(trustedOrigin).filter(Boolean))
}

export const isTrustedApiRequest = ({ baseURL, url = '', env = import.meta.env }) => {
  try {
    const requestOrigin = new URL(url, baseURL).origin
    return getTrustedApiOrigins(env).has(requestOrigin)
  } catch {
    return false
  }
}

export const getApiAuthorizationState = ({ baseURL, hasToken, env = import.meta.env }) => {
  if (!hasToken) return 'anonymous'
  return isTrustedApiRequest({ baseURL, env }) ? 'allowed' : 'blocked'
}
