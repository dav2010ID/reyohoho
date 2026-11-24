import fs from 'node:fs/promises'
import path from 'node:path'
import { loadEnv } from 'vite'
import { parseWorkerApiUrl } from '../src/api/workerOrigin.js'
import {
  collectSiteSecurity,
  headersBlock,
  prerenderedMoviePaths,
  securityHeaders
} from './site-security.js'

const DIST_PATH = path.resolve(process.cwd(), 'dist')
const TEMPLATE_404_PATH = path.resolve(process.cwd(), 'public', '404.html')
const FALLBACK_404_PATH = path.join(DIST_PATH, '404.html')
const MANIFEST_PATH = path.join(DIST_PATH, 'manifest.webmanifest')
const HEADERS_PATH = path.join(DIST_PATH, '_headers')
// Read by workers/site at deploy time; generated, not committed.
const SITE_META_PATH = path.resolve(process.cwd(), 'workers', 'site', 'generated', 'site-meta.json')
const origin = (value) => (value ? new URL(value).origin : null)

const normalizeBasePath = (value) =>
  value === '/'
    ? '/'
    : `/${String(value || '/')
        .trim()
        .replace(/^\/+|\/+$/g, '')}`

async function resolveBasePath() {
  const envBasePath = process.env.VITE_BASE_URL
  if (envBasePath) {
    return normalizeBasePath(envBasePath)
  }

  try {
    const manifestContent = await fs.readFile(MANIFEST_PATH, 'utf8')
    const manifest = JSON.parse(manifestContent)
    return normalizeBasePath(manifest.scope || manifest.start_url || '/')
  } catch {
    return '/'
  }
}

async function main() {
  const fallbackTemplate = await fs.readFile(TEMPLATE_404_PATH, 'utf8')
  const normalizedBasePath = await resolveBasePath()
  const fallbackHtml = fallbackTemplate.replaceAll('__BASE_URL__', normalizedBasePath)

  await fs.writeFile(FALLBACK_404_PATH, fallbackHtml, 'utf8')
  console.log(`Generated ${FALLBACK_404_PATH} with base path ${normalizedBasePath}`)

  // Same env the Vite build saw (mode via BUILD_MODE, default production).
  const env = { ...loadEnv(process.env.BUILD_MODE || 'production', process.cwd()), ...process.env }
  const headers = securityHeaders({
    scriptHashes: await collectSiteSecurity(DIST_PATH),
    apiOrigin: parseWorkerApiUrl(env.VITE_WORKER_API_URL),
    connectOrigins: [
      origin(env.VITE_KINOBOX_API_URL),
      origin(env.VITE_KINOBOX_SEARCH_API_URL),
      origin(env.VITE_DDBB_API_URL || 'https://p2.ddbb.lol'),
      origin(env.VITE_DDBB_LIVE_API_URL || 'https://a.ddbb.live')
    ]
  })
  const cacheRules = await fs.readFile(HEADERS_PATH, 'utf8').catch(() => '')
  await fs.writeFile(HEADERS_PATH, `${headersBlock('/*', headers)}\n${cacheRules}`, 'utf8')
  const movies = await prerenderedMoviePaths(DIST_PATH)
  await fs.mkdir(path.dirname(SITE_META_PATH), { recursive: true })
  await fs.writeFile(SITE_META_PATH, `${JSON.stringify({ headers, movies })}\n`, 'utf8')
  console.log(`Wrote security headers and ${Object.keys(movies).length} movie paths`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
