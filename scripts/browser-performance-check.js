import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCleanContext, reportsDir } from './browser-test-utils.js'

const baseUrl = process.argv[2] || 'http://127.0.0.1:4176/'

const toKb = (bytes) => Math.round((bytes / 1024) * 10) / 10

async function ensureReportsDir() {
  await fs.mkdir(reportsDir, { recursive: true })
}

async function measurePage(page, name, url) {
  const responses = []
  const consoleErrors = []

  page.on('response', async (response) => {
    const headers = response.headers()
    const length = Number(headers['content-length'] || 0)
    responses.push({
      url: response.url(),
      status: response.status(),
      contentType: headers['content-type'] || '',
      bytes: Number.isFinite(length) ? length : 0
    })
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  const startedAt = Date.now()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  const loadedAt = Date.now()

  await page.screenshot({
    path: path.join(reportsDir, `${name}.png`),
    fullPage: false
  })

  const metrics = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paint = performance.getEntriesByType('paint')
    const paintByName = Object.fromEntries(paint.map((entry) => [entry.name, entry.startTime]))

    const rafStart = performance.now()
    await new Promise((resolve) => {
      let frames = 0
      const tick = () => {
        frames += 1
        if (frames >= 120) {
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const rafDuration = performance.now() - rafStart

    return {
      domContentLoaded: nav.domContentLoadedEventEnd,
      loadEventEnd: nav.loadEventEnd,
      firstPaint: paintByName['first-paint'] || null,
      firstContentfulPaint: paintByName['first-contentful-paint'] || null,
      transferSize: performance
        .getEntriesByType('resource')
        .reduce((total, entry) => total + (entry.transferSize || 0), 0),
      resourceCount: performance.getEntriesByType('resource').length,
      fpsEstimate: Math.round((120 / rafDuration) * 1000),
      cardCount: document.querySelectorAll('.movie-card').length
    }
  })

  return {
    name,
    url,
    wallTimeMs: loadedAt - startedAt,
    metrics,
    network: {
      requestCount: responses.length,
      knownTransferKb: toKb(responses.reduce((total, response) => total + response.bytes, 0)),
      failed: responses.filter((response) => response.status >= 400).slice(0, 20)
    },
    consoleErrors: consoleErrors.slice(0, 20)
  }
}

async function measureInteraction(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 })
  const input = page.locator('.search-input')
  await input.waitFor({ timeout: 10000 })

  const startedAt = Date.now()
  await input.fill('matrix')
  await page.locator('.search-button').click()
  await page.waitForLoadState('networkidle', { timeout: 60000 })
  const endedAt = Date.now()

  return {
    searchInteractionMs: endedAt - startedAt,
    resultCards: await page.locator('.movie-card').count(),
    url: page.url()
  }
}

async function main() {
  await ensureReportsDir()

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false
  })

  const { context, page } = await createCleanContext(browser, {
    viewport: { width: 1366, height: 768 },
    recordHar: {
      path: path.join(reportsDir, 'network.har'),
      content: 'omit'
    }
  })
  const home = await measurePage(page, 'home-desktop', baseUrl)
  const top = await measurePage(page, 'top-desktop', new URL('/top', baseUrl).toString())
  const interaction = await measureInteraction(page)

  const { context: mobileContext, page: mobilePage } = await createCleanContext(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  })
  const mobileHome = await measurePage(mobilePage, 'home-mobile', baseUrl)
  await mobileContext.close()

  await context.close()
  await browser.close()

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    pages: [home, top, mobileHome],
    interaction
  }

  await fs.writeFile(
    path.join(reportsDir, 'browser-performance.json'),
    JSON.stringify(report, null, 2)
  )

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
