import fs from 'node:fs/promises'
import path from 'node:path'

const DIST_PATH = path.resolve(process.cwd(), 'dist')
const TEMPLATE_404_PATH = path.resolve(process.cwd(), 'public', '404.html')
const FALLBACK_404_PATH = path.join(DIST_PATH, '404.html')
const MANIFEST_PATH = path.join(DIST_PATH, 'manifest.webmanifest')

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
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
