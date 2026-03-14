import fs from 'node:fs/promises'
import path from 'node:path'

const SITE_ORIGIN = process.env.VITE_SITE_ORIGIN || 'https://dav2010id.github.io'
const SITE_BASE_PATH = process.env.VITE_BASE_URL || '/reyohoho'
const MOVIES_PATH = path.resolve(process.cwd(), 'src/data/movies.json')
const ROBOTS_PATH = path.resolve(process.cwd(), 'public/robots.txt')
const SITEMAP_PATH = path.resolve(process.cwd(), 'public/sitemap.xml')

const normalizeBasePath = (value) => {
  const normalized = `/${String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')}`

  return normalized === '/' ? '' : normalized
}

const BASE_PATH = normalizeBasePath(SITE_BASE_PATH)

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

async function main() {
  const raw = await fs.readFile(MOVIES_PATH, 'utf8')
  const movies = JSON.parse(raw)

  const urls = [
    {
      loc: `${SITE_ORIGIN}${BASE_PATH}/`,
      lastmod: new Date().toISOString().slice(0, 10)
    },
    ...movies.map((movie) => ({
      loc: `${SITE_ORIGIN}${BASE_PATH}/movie/${movie.kp_id}/${movie.slug}`,
      lastmod: String(movie.updatedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
    }))
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (item) =>
        `  <url>\n    <loc>${escapeXml(item.loc)}</loc>\n    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}${BASE_PATH}/sitemap.xml\n`

  await fs.mkdir(path.dirname(SITEMAP_PATH), { recursive: true })
  await fs.writeFile(SITEMAP_PATH, sitemap, 'utf8')
  await fs.writeFile(ROBOTS_PATH, robots, 'utf8')

  console.log(`Generated ${urls.length} sitemap URLs`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
