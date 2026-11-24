// Local fixtures only. Compare the reserved frame with its settled state:
// an empty player list and a loaded player (plus theater mode round trip).
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { createProfileServer } from './frontend-profile-server.js'

async function main() {
  const server = await createProfileServer({ port: 0, root: process.argv[2] || 'dist' })
  const origin = `http://127.0.0.1:${server.address().port}`
  const rows = []
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_CHANNEL
        ? { channel: process.env.BROWSER_CHANNEL }
        : process.platform === 'win32'
          ? { channel: 'msedge' }
          : {})
    })
    for (const width of [320, 390, 1280]) {
      for (const scenario of ['empty', 'player']) {
        console.log(`Checking ${width}/${scenario}`)
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          serviceWorkers: 'block'
        })
        let releasePlayers
        try {
          const page = await context.newPage()
          page.setDefaultTimeout(15000)
          const errors = []
          page.on('pageerror', (error) => errors.push(error.message))
          const gate = new Promise((resolve) => {
            releasePlayers = resolve
          })
          await page.route('**/*', async (route) => {
            const url = new URL(route.request().url())
            if (url.origin !== origin) return route.abort()
            if (url.pathname === '/__profile/frame')
              return route.fulfill({
                contentType: 'text/html',
                body: '<!doctype html><title>Local player</title><p>Local frame</p>'
              })
            if (url.pathname.includes('/players')) {
              await gate
              if (scenario === 'player')
                return route.fulfill({
                  contentType: 'application/json',
                  body: JSON.stringify({
                    data: [{ type: 'Fixture', iframeUrl: origin + '/__profile/frame' }]
                  })
                })
            }
            return route.continue()
          })
          await page.goto(origin + '/movie/5494049/spider-man-brand-new-day/', {
            waitUntil: 'domcontentloaded'
          })
          await page.locator('.iframe-wrapper').waitFor()
          await page.locator('#movie-details').waitFor()
          await page.waitForTimeout(500)
          const before = await page.locator('.iframe-wrapper').boundingBox()
          releasePlayers()
          await page
            .locator(scenario === 'player' ? '.responsive-iframe[src]' : '.player-empty-state')
            .waitFor()
          await page.waitForTimeout(500)
          const after = await page.locator('.iframe-wrapper').boundingBox()
          if (width === 320 && scenario === 'empty') {
            await fs.mkdir('reports-browser', { recursive: true })
            await page.screenshot({ path: 'reports-browser/player-empty-320.png' })
          }
          const overflow = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth
          }))
          assert.ok(overflow.scrollWidth <= overflow.width + 1, JSON.stringify(overflow))
          if (scenario === 'player') {
            await page.locator('.theater-mode-btn:visible').click()
            await page.locator('.player-container.theater-mode').waitFor()
            await page.locator('.close-theater-btn').click()
            await page.locator('.player-container.theater-mode').waitFor({ state: 'hidden' })
            await page.locator('.responsive-iframe').waitFor({ state: 'visible' })
          }
          rows.push({
            width,
            scenario,
            before,
            after,
            shifts: await page.evaluate(() => window.__f5.shifts),
            errors
          })
        } finally {
          releasePlayers?.()
          await context.close()
        }
      }
    }
    await fs.mkdir('reports-browser', { recursive: true })
    const output = process.argv[3] || 'reports-browser/player-layout.json'
    await fs.writeFile(output, JSON.stringify({ browser: browser.version(), rows }, null, 2) + '\n')
    for (const row of rows) {
      assert.deepEqual(row.errors, [])
      assert.ok(
        Math.abs(row.after.height - row.before.height) < 1,
        `${row.width}/${row.scenario}: frame grew ${row.after.height - row.before.height}px`
      )
    }
    console.log(`Passed ${rows.length} local player layout checks; ${output}`)
  } finally {
    await browser?.close()
    await new Promise((resolve) => server.close(resolve))
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
