import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  assertNoNotFound,
  collectPerformance,
  createCleanContext,
  reportsDir,
  resolveAppUrl
} from './browser-test-utils.js'

const baseUrl = process.argv[2] || 'http://127.0.0.1:4176/'

const toKb = (bytes) => Math.round((bytes / 1024) * 10) / 10

async function ensureReportsDir() {
  await fs.mkdir(reportsDir, { recursive: true })
}

async function measurePage(page, name, url, readySelector) {
  const responses = []
  const consoleErrors = []

  const onResponse = async (response) => {
    const headers = response.headers()
    const length = Number(headers['content-length'] || 0)
    responses.push({
      url: response.url(),
      status: response.status(),
      contentType: headers['content-type'] || '',
      bytes: Number.isFinite(length) ? length : 0
    })
  }

  const onConsole = (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  }

  page.on('response', onResponse)
  page.on('console', onConsole)

  const startedAt = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await assertNoNotFound(page, name)
  await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(250)
  const loadedAt = Date.now()

  await page.screenshot({
    path: path.join(reportsDir, `${name}.png`),
    fullPage: false
  })

  const metrics = {
    ...(await collectPerformance(page)),
    cardCount: await page.locator('.movie-card').count()
  }

  page.off('response', onResponse)
  page.off('console', onConsole)

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
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const input = page.locator('.search-input')
  await input.waitFor({ timeout: 10000 })

  const startedAt = Date.now()
  await input.fill('Матрица')
  await page.locator('.search-button').click()
  await page
    .locator('.content-container .movie-card, .content-container .no-results')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
  const endedAt = Date.now()
  const resultCards = await page.locator('.content-container .movie-card').count()
  if (resultCards === 0) throw new Error('search interaction returned no movie cards')

  return {
    searchInteractionMs: endedAt - startedAt,
    resultCards,
    url: page.url()
  }
}

async function main() {
  await ensureReportsDir()

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const { context, page } = await createCleanContext(browser, {
    viewport: { width: 1366, height: 768 },
    recordHar: {
      path: path.join(reportsDir, 'network.har'),
      content: 'omit'
    }
  })
  const home = await measurePage(page, 'home-desktop', baseUrl, '.search-input')
  const top = await measurePage(page, 'top-desktop', resolveAppUrl(baseUrl, 'top'), '.movie-card')
  const interaction = await measureInteraction(page)

  const { context: mobileContext, page: mobilePage } = await createCleanContext(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  })
  const mobileHome = await measurePage(mobilePage, 'home-mobile', baseUrl, '.search-input')
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
