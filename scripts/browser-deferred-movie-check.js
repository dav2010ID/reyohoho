// Local fixtures only. Compare cold movie resources and verify deferred controls.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createProfileServer } from './frontend-profile-server.js'

const root = path.resolve(process.argv[2] || 'dist')
const baselineRoot = process.argv[3] ? path.resolve(process.argv[3]) : null
const server = await createProfileServer({ root, baselineRoot, port: 0 })
const origin = `http://127.0.0.1:${server.address().port}`
const moviePath = '/movie/5494049/spider-man-brand-new-day/'
const resources = (page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter(
        (entry) =>
          entry.name.startsWith('http') && /\.(?:js|css)$/.test(new URL(entry.name).pathname)
      )
      .map((entry) => ({ path: new URL(entry.name).pathname, bytes: entry.encodedBodySize }))
  )
let browser

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  })
  const rows = []
  for (const width of [390, 1280]) {
    for (const build of baselineRoot ? ['before', 'after'] : ['after']) {
      console.log(`Checking deferred controls: ${width}/${build}`)
      const context = await browser.newContext({
        viewport: { width, height: 640 },
        serviceWorkers: 'block'
      })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.route('**/*', (route) => {
          const url = new URL(route.request().url())
          if (url.origin !== origin) return route.abort()
          if (url.pathname === '/__profile/frame')
            return route.fulfill({
              contentType: 'text/html',
              body: '<!doctype html><p>Local player</p>'
            })
          if (url.pathname.includes('/players'))
            return route.fulfill({
              contentType: 'application/json',
              body: JSON.stringify({
                data: [
                  { type: 'Fixture 1', iframeUrl: origin + '/__profile/frame?player=1' },
                  { type: 'Fixture 2', iframeUrl: origin + '/__profile/frame?player=2' }
                ]
              })
            })
          return route.continue()
        })
        await page.goto(origin + '/__profile/setup?build=' + build)
        await page.goto(origin + moviePath, { waitUntil: 'domcontentloaded' })
        await page.locator('.responsive-iframe[src]').waitFor()
        await page.waitForTimeout(1500)
        const initialResources = await resources(page)
        if (build === 'after') {
          assert(
            !initialResources.some(({ path }) =>
              /\/(?:PlayerModal|playerVideoOverlayRuntime)-/.test(path)
            ),
            'optional movie and desktop tools must not load before use'
          )
          await page.locator('.player-btn').click()
          await page.locator('.modal .player-item').last().click()
          await page.locator('.modal').waitFor({ state: 'hidden' })
          assert.match(await page.locator('.responsive-iframe').getAttribute('src'), /player=2/)
          const usedResources = await resources(page)
          assert(usedResources.some(({ path }) => /\/PlayerModal-.*\.js$/.test(path)))
        }
        assert.deepEqual(errors, [])
        rows.push({
          width,
          build,
          initialScriptStyleBytes: initialResources.reduce((sum, entry) => sum + entry.bytes, 0),
          initialResources,
          pageErrors: errors
        })
      } finally {
        await context.close()
      }
    }
  }
  await fs.mkdir('reports-browser', { recursive: true })
  const report = { browser: browser.version(), serviceWorkers: 'blocked', rows }
  await fs.writeFile('reports-browser/deferred-movie.json', JSON.stringify(report, null, 2) + '\n')
  console.log(
    JSON.stringify(
      {
        rows: rows.map(({ width, build, initialScriptStyleBytes }) => ({
          width,
          build,
          initialScriptStyleBytes
        })),
        deferredControls: true,
        pageErrors: []
      },
      null,
      2
    )
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
