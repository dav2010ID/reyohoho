import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { chromium } from 'playwright'
const dist = path.resolve(process.argv[2] || 'dist')
const index = await fs.readFile(path.join(dist, 'index.html'))
const sw = await fs.readFile(path.join(dist, 'sw.js'), 'utf8')
const revision = crypto.createHash('md5').update(index).digest('hex')
assert(sw.includes(revision), 'SW must precache the final SSG HTML revision')
const updatedIndex = Buffer.from(index.toString() + '<!-- artifact-update-B -->')
const updatedRevision = crypto.createHash('md5').update(updatedIndex).digest('hex')
// /api/ bypasses the SW navigation fallback, so this document never boots the app.
const updateHelperPath = '/api/artifact-sw-update-helper.html'
let serveUpdate = false
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (pathname === updateHelperPath) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
      res.end('<!doctype html><meta charset="utf-8"><title>SW update helper</title>')
      return
    }
    let target = path.resolve(dist, '.' + pathname)
    if (target !== dist && !target.startsWith(dist + path.sep)) {
      res.writeHead(403).end()
      return
    }
    try {
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html')
    } catch {
      target = path.join(dist, 'index.html')
    }
    let body = await fs.readFile(target)
    if (serveUpdate && target === path.join(dist, 'index.html')) body = updatedIndex
    if (serveUpdate && target === path.join(dist, 'sw.js'))
      body = Buffer.from(sw.replaceAll(revision, updatedRevision))
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
let browser
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  })
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const requests = []
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    requests.push(url.pathname + url.search)
    return route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin + '/top/', { waitUntil: 'networkidle' })
  const cards = page.locator('.movie-card')
  await cards.first().waitFor()
  const cardCount = await cards.count()
  assert(cardCount > 0, 'SSG cards must remain visible with the API offline')
  assert(
    !requests.some(
      (url) =>
        url.includes('/kinopoisk/top') && new URL(url, origin).searchParams.get('limit') === '36'
    ),
    'client must reuse the SSG list: ' + JSON.stringify(requests)
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
      )
  })
  const precacheUrls = await page.evaluate(async () => {
    const keys = await caches.keys()
    const precache = await caches.open(keys.find((key) => key.includes('precache')))
    return (await precache.keys()).map(({ url }) => new URL(url).pathname)
  })
  assert(
    !precacheUrls.some((url) =>
      ['PlayerModal', 'Settings', 'RandomMovieModal', 'playerVideoOverlayRuntime'].some(
        (name) => url.includes('/' + name + '-')
      )
    ),
    'optional dialogs, routes and movie tools must not enter the initial precache'
  )
  assert(
    precacheUrls.some((url) => url.includes('/workbox-window') && url.endsWith('.js')),
    'Workbox registration client must be precached for offline app startup'
  )
  await page.goto(origin + '/settings/', { waitUntil: 'domcontentloaded' })
  await page.locator('.settings-page').waitFor()
  await page.waitForFunction(async () => {
    const cache = await caches.open('immutable-assets-v1')
    const urls = (await cache.keys()).map(({ url }) => new URL(url).pathname)
    return (
      urls.some((url) => url.includes('/Settings-') && url.endsWith('.js')) &&
      urls.some((url) => url.includes('/Settings-') && url.endsWith('.css'))
    )
  })
  const runtimeUrls = await page.evaluate(async () =>
    (await (await caches.open('immutable-assets-v1')).keys()).map(
      ({ url }) => new URL(url).pathname
    )
  )
  assert(
    runtimeUrls.every((url) => url.startsWith('/assets/immutable/')),
    'runtime cache must contain only immutable local assets'
  )
  await context.setOffline(true)
  await page.goto(origin + '/settings/', { waitUntil: 'domcontentloaded' })
  await page.locator('.settings-page').waitFor()
  await page.goto(origin + '/top/', { waitUntil: 'domcontentloaded' })
  await page.locator('.top-100-page').waitFor()
  await page.locator('#app').waitFor()
  assert(
    (await page.locator('#app').textContent()).trim().length > 0,
    'offline top route must render the shell'
  )
  await page.goto(origin + '/movie/301/matrix/', { waitUntil: 'domcontentloaded' })
  await page.locator('.movie-info').waitFor()
  await page.locator('#app').waitFor()
  assert(
    (await page.locator('#app').textContent()).trim().length > 0,
    'offline deep route must render the shell'
  )
  await context.setOffline(false)
  const updateHelper = await context.newPage()
  updateHelper.on('pageerror', (error) => errors.push(error.message))
  try {
    const helperNavigation = await updateHelper.goto(origin + updateHelperPath, {
      waitUntil: 'domcontentloaded'
    })
    assert(
      helperNavigation && !helperNavigation.fromServiceWorker(),
      'SW update helper must bypass the app shell navigation fallback'
    )
    serveUpdate = true
    await updateHelper.evaluate(async () => {
      const serviceWorker = navigator.serviceWorker
      const previousController = serviceWorker.controller
      if (!previousController) throw new Error('SW update helper must already be controlled')
      let onControllerChange
      let timer
      const controllerChanged = new Promise((resolve) => {
        onControllerChange = () => {
          if (serviceWorker.controller && serviceWorker.controller !== previousController) resolve()
        }
        serviceWorker.addEventListener('controllerchange', onControllerChange)
      })
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('SW update did not activate within 15000 ms')),
          15000
        )
      })
      try {
        // Listen before update(), and bound readiness, the update request and activation.
        await Promise.race([
          Promise.all([
            serviceWorker.ready.then((registration) => registration.update()),
            controllerChanged
          ]),
          timeout
        ])
      } finally {
        clearTimeout(timer)
        serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
    })
  } finally {
    await updateHelper.close()
  }
  await context.setOffline(true)
  // The app reloads existing tabs on controllerchange; probe with a fresh tab.
  const updatePage = await context.newPage()
  updatePage.on('pageerror', (error) => errors.push(error.message))
  const updatedNavigation = await updatePage.goto(origin + '/artifact-update-probe/', {
    waitUntil: 'domcontentloaded'
  })
  await updatePage.locator('#app').waitFor()
  assert(
    updatedNavigation.fromServiceWorker(),
    'offline update must be served by the service worker'
  )
  assert(
    (await updatedNavigation.text()).includes('artifact-update-B'),
    'offline navigation must use the updated precached shell'
  )
  assert.equal(errors.length, 0, JSON.stringify(errors))
  console.log(
    JSON.stringify(
      {
        artifact: dist,
        finalShellRevision: revision,
        ssgCards: cardCount,
        shellPrecacheEntries: precacheUrls.length,
        optionalRoutesCachedOnUse: true,
        offlineVisitedSettings: true,
        offlineTop: true,
        offlineDeepRoute: true,
        offlineShellUpdate: true,
        pageErrors: errors
      },
      null,
      2
    )
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
