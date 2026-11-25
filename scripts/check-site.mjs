// HTTP contract of the site Worker (workers/site), checked against a live origin:
//   node scripts/check-site.mjs https://reyhoho.fun            production
//   node scripts/check-site.mjs https://reyohoho-site.<sub>.workers.dev
//   node scripts/check-site.mjs http://127.0.0.1:8787          wrangler dev
// Add --www to also check that www.<host> redirects to the apex.
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const META = path.resolve(process.cwd(), 'workers', 'site', 'generated', 'site-meta.json')
const UNCATALOGUED = '/movie/123456789'
const SECURITY = ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options']

export async function checkSite(base, { fetch = globalThis.fetch, meta, www = false } = {}) {
  const origin = new URL(base).origin
  // Production workers.dev URLs get noindex from _headers; only the real host is indexed.
  const indexable = !new URL(base).hostname.endsWith('.workers.dev')
  const errors = []
  const get = (pathname, headers = {}) =>
    fetch(new URL(pathname, origin), { redirect: 'manual', headers })
  const expect = (ok, message) => ok || errors.push(message)
  const header = (response, name) => response.headers.get(name) || ''
  const isHtml = (response) => header(response, 'Content-Type').includes('text/html')
  const secured = (response, pathname) => {
    for (const name of SECURITY) expect(header(response, name), `${pathname}: no ${name}`)
    expect(
      header(response, 'Content-Security-Policy') ||
        header(response, 'Content-Security-Policy-Report-Only'),
      `${pathname}: no Content-Security-Policy`
    )
  }

  const home = await get('/')
  expect(home.status === 200 && isHtml(home), `/: expected 200 HTML, got ${home.status}`)
  secured(home, '/')
  const html = await home.text()
  const asset = /\/assets\/immutable\/[^"'?#]+\.js/.exec(html)?.[0]
  if (asset) {
    const script = await get(asset)
    expect(script.status === 200, `${asset}: expected 200, got ${script.status}`)
    expect(header(script, 'Cache-Control').includes('immutable'), `${asset}: not immutable`)
  } else errors.push('/: no /assets/immutable/ script in the home page')

  const [id, canonical] = Object.entries(meta?.movies || {})[0] || []
  if (canonical) {
    const page = await get(canonical)
    expect(page.status === 200 && isHtml(page), `${canonical}: expected 200, got ${page.status}`)
    secured(page, canonical)
    if (indexable)
      expect(!/noindex/i.test(header(page, 'X-Robots-Tag')), `${canonical}: must be indexable`)
    for (const old of [`/movie/${id}`, `/movie/${id}/old-slug/`]) {
      const moved = await get(`${old}?from=check`)
      const location = header(moved, 'Location')
      expect(
        moved.status === 301 && new URL(location, origin).pathname === canonical,
        `${old}: expected 301 to ${canonical}, got ${moved.status} ${location}`
      )
      expect(location.endsWith('?from=check'), `${old}: the redirect dropped the query`)
    }
    const bare = canonical.replace(/\/$/, '')
    const slash = await get(bare)
    expect(
      [301, 307, 308].includes(slash.status) &&
        new URL(header(slash, 'Location'), origin).pathname === canonical,
      `${bare}: expected a redirect to ${canonical}, got ${slash.status}`
    )
  } else errors.push('site-meta.json has no prerendered movies to check')

  // Browsers mark navigations; asset routing must still hand misses to the Worker.
  for (const headers of [{}, { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' }]) {
    const shell = await get(UNCATALOGUED, headers)
    const label = `${UNCATALOGUED}${headers['Sec-Fetch-Mode'] ? ' (navigate)' : ''}`
    expect(
      shell.status === 200 && isHtml(shell),
      `${label}: expected 200 HTML, got ${shell.status}`
    )
    expect(/noindex/i.test(header(shell, 'X-Robots-Tag')), `${label}: expected noindex`)
    secured(shell, label)
    const missing = await get('/no-such-page-check', headers)
    expect(
      missing.status === 404 && isHtml(missing),
      `/no-such-page-check${headers['Sec-Fetch-Mode'] ? ' (navigate)' : ''}: expected 404 HTML, got ${missing.status}`
    )
  }

  const chunk = await get('/assets/immutable/no-such-chunk.js')
  expect(
    chunk.status === 404 && !isHtml(chunk),
    `/assets/immutable/no-such-chunk.js: expected a 404 that is not HTML, got ${chunk.status}`
  )
  const sw = await get('/sw.js')
  expect(sw.status === 200, `/sw.js: expected 200, got ${sw.status}`)
  expect(header(sw, 'Cache-Control').includes('no-cache'), '/sw.js: must be no-cache')
  for (const file of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest']) {
    const response = await get(file)
    expect(response.status === 200, `${file}: expected 200, got ${response.status}`)
  }
  const rules = await get('/_headers')
  expect(rules.status === 404, `/_headers must not be served, got ${rules.status}`)

  if (www) {
    const url = new URL(origin)
    url.hostname = `www.${url.hostname}`
    url.pathname = '/top'
    const response = await fetch(url, { redirect: 'manual' })
    expect(
      [301, 308].includes(response.status) && header(response, 'Location') === `${origin}/top`,
      `${url.host}: expected a permanent redirect to ${origin}/top, got ${response.status}`
    )
  }
  return errors
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!base) {
    console.error('Usage: node scripts/check-site.mjs <origin> [--www]')
    process.exit(2)
  }
  const meta = JSON.parse(await fs.readFile(META, 'utf8').catch(() => 'null'))
  const errors = await checkSite(base, { meta, www: process.argv.includes('--www') })
  for (const error of errors) console.error(`✗ ${error}`)
  if (errors.length) process.exit(1)
  console.log(`✓ ${base} serves the site Worker contract`)
}
