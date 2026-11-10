import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { JSDOM } from 'jsdom'

// Check what crawlers receive without running the app or contacting a provider.
const dist = path.resolve(process.argv[2] || 'dist')
const movies = JSON.parse(await fs.readFile('src/data/movies.json', 'utf8'))
const sitemap = new JSDOM(await fs.readFile(path.join(dist, 'sitemap.xml'), 'utf8'), {
  contentType: 'text/xml'
}).window.document
const urls = new Set([...sitemap.querySelectorAll('loc')].map(el => el.textContent))
assert(movies.length > 0, 'Empty SEO catalog')
for (const movie of movies) {
  const route = `movie/${movie.kp_id}/${movie.slug}/`
  const html = await fs.readFile(path.join(dist, route, 'index.html'), 'utf8')
  const head = JSDOM.fragment(html.split('</head>', 1)[0])
  const canonical = head.querySelector('link[rel="canonical"]')?.getAttribute('href')
  assert(canonical?.endsWith('/' + route) && urls.has(canonical), `Broken canonical or sitemap: ${route}`)
  const image = head.querySelector('meta[property="og:image"]')?.getAttribute('content')
  const metadata = JSON.parse(head.querySelector('script[type="application/ld+json"]')?.textContent || '{}')
  assert.equal(metadata.url, canonical, route)
  assert.equal(metadata.name, movie.title, route)
  assert.equal(image, movie.poster || undefined, route)
  assert.equal(metadata.image, image, route)
}
console.log(`Verified sitemap, canonical URLs and image metadata on ${movies.length} prerendered pages`)
