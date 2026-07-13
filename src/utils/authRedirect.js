const STORAGE_KEY = 'reyohoho-auth-redirect'
const AUTH_PATHS = new Set(['/login', '/auth-success'])

export const normalizeAuthRedirect = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  try {
    const url = new URL(value, 'https://app.invalid')
    if (url.origin !== 'https://app.invalid' || AUTH_PATHS.has(url.pathname)) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

export const saveAuthRedirect = (value, storage = window.sessionStorage) => {
  const redirect = normalizeAuthRedirect(value)
  if (redirect === '/') {
    storage.removeItem(STORAGE_KEY)
  } else {
    storage.setItem(STORAGE_KEY, redirect)
  }
  return redirect
}

export const consumeAuthRedirect = (storage = window.sessionStorage) => {
  const redirect = normalizeAuthRedirect(storage.getItem(STORAGE_KEY))
  storage.removeItem(STORAGE_KEY)
  return redirect
}
