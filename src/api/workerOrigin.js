// One Worker serves the catalogue, account and history. Staging and fork builds
// point VITE_WORKER_API_URL at their own Worker; localhost needs one that opts in
// with ALLOW_DEV_ORIGINS (the production Worker does not).
const DEFAULT_WORKER_API_URL = 'https://api.reyhoho.fun'

export const parseWorkerApiUrl = (value) => {
  const url = new URL(value || DEFAULT_WORKER_API_URL)
  const local = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error(`VITE_WORKER_API_URL must use HTTPS: ${value}`)
  // A path prefix is allowed (a proxy or the local profile fixture); queries are not.
  if (url.search || url.hash || url.username || url.password)
    throw new Error(`VITE_WORKER_API_URL must be a plain base URL: ${value}`)
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

// The build validates the value (postbuild calls parseWorkerApiUrl); at runtime a
// bad value must not stop the whole app, so it is only normalized here.
// Optional chaining: postbuild imports this module under plain Node.
export const WORKER_API_URL = String(
  import.meta.env?.VITE_WORKER_API_URL || DEFAULT_WORKER_API_URL
).replace(/\/+$/, '')
