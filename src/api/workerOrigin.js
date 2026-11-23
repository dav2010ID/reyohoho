// One Worker serves the catalogue, account and history. Staging and fork builds
// point VITE_WORKER_API_URL at their own Worker; localhost needs one that opts in
// with ALLOW_DEV_ORIGINS (the production Worker does not).
const DEFAULT_WORKER_API_URL = 'https://api.reyhoho.fun'

export const parseWorkerApiUrl = (value) => {
  const url = new URL(value || DEFAULT_WORKER_API_URL)
  const local = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error(`VITE_WORKER_API_URL must use HTTPS: ${value}`)
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error(`VITE_WORKER_API_URL must be an origin: ${value}`)
  return url.origin
}

// Optional chaining: postbuild imports this module under plain Node.
export const WORKER_API_URL = parseWorkerApiUrl(import.meta.env?.VITE_WORKER_API_URL)
