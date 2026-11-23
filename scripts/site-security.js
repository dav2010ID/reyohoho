// Security headers for reyhoho.fun, derived from the built HTML.
// postbuild writes them into dist/_headers (static assets) and into the site
// Worker's metadata (responses the Worker generates itself: _headers does not
// apply to those).
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export const CSP_REPORT_PATH = '/api/csp-report'
// A new inline script must be a deliberate change: hash budget for the whole site.
export const MAX_INLINE_SCRIPTS = 8

const EXECUTABLE_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module'])
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

const scriptType = (attributes) =>
  (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1] || '').toLowerCase()

export function inlineScriptHashes(html, file = 'page') {
  const hashes = []
  for (const [, attributes, body] of html.matchAll(SCRIPT)) {
    if (/\bsrc\s*=/i.test(attributes) || !EXECUTABLE_TYPES.has(scriptType(attributes))) continue
    if (body.includes('window.__INITIAL_STATE__'))
      throw new Error(`${file}: prerendered state must ship as JSON (see src/utils/ssgState.js)`)
    hashes.push(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`)
  }
  return hashes
}

const unique = (values) => [...new Set(values.filter(Boolean))]

export function buildCsp({ scriptHashes, apiOrigin, connectOrigins = [] }) {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", ...scriptHashes, 'https://www.googletagmanager.com'],
    // Vue renders style attributes; Google Fonts serves the stylesheets.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    // Posters and stills come from several CDNs chosen by the catalogue.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:', 'https:'],
    'connect-src': unique([
      "'self'",
      apiOrigin,
      ...connectOrigins,
      'https://img.youtube.com',
      'https://reyohoho.goatcounter.com',
      'https://www.googletagmanager.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com'
    ]),
    // Player providers are any HTTPS origin today (narrowed separately, F-20).
    'frame-src': ['https:'],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': [`${apiOrigin}${CSP_REPORT_PATH}`],
    'report-to': ['csp']
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function securityHeaders({ scriptHashes, apiOrigin, connectOrigins }) {
  return {
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    // Report-only until the collected reports are reviewed; then enforce.
    'Content-Security-Policy-Report-Only': buildCsp({ scriptHashes, apiOrigin, connectOrigins }),
    'Reporting-Endpoints': `csp="${apiOrigin}${CSP_REPORT_PATH}"`
  }
}

export const headersBlock = (pattern, headers) =>
  [pattern, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n')

async function* htmlFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* htmlFiles(full)
    else if (entry.name.endsWith('.html')) yield full
  }
}

// Canonical movie paths that exist as prerendered documents: /movie/<id>/<slug>/.
export async function prerenderedMoviePaths(distPath) {
  const movies = {}
  const root = path.join(distPath, 'movie')
  const ids = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  for (const id of ids) {
    if (!id.isDirectory() || !/^[1-9]\d{0,11}$/.test(id.name)) continue
    const slugs = await fs.readdir(path.join(root, id.name), { withFileTypes: true })
    const slug = slugs.find((entry) => entry.isDirectory())
    if (slug) movies[id.name] = `/movie/${id.name}/${slug.name}/`
  }
  return movies
}

export async function collectSiteSecurity(distPath) {
  const hashes = new Set()
  for await (const file of htmlFiles(distPath)) {
    const html = await fs.readFile(file, 'utf8')
    for (const hash of inlineScriptHashes(html, path.relative(distPath, file))) hashes.add(hash)
  }
  if (hashes.size > MAX_INLINE_SCRIPTS)
    throw new Error(
      `${hashes.size} distinct inline scripts (limit ${MAX_INLINE_SCRIPTS}); move new ones to files`
    )
  return [...hashes].sort()
}
