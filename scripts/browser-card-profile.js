import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  assertNoNotFound,
  collectPerformance,
  createCleanContext,
  createCollector,
  ensureReportsDir,
  reportsDir
} from './browser-test-utils.js'

const baseUrl = process.argv[2] || 'http://127.0.0.1:4179/'
const sampleCount = Number(process.argv[3] || 5)

const listRoutes = [
  { name: 'home', url: new URL('/', baseUrl).toString(), minCards: 1 },
  { name: 'top', url: new URL('/top', baseUrl).toString(), minCards: 1 }
]

async function getCardSamples(page, route, count) {
  await page.goto(route.url, { waitUntil: 'networkidle', timeout: 60000 })
  await assertNoNotFound(page, route.name)

  const cards = page.locator('.movie-card')
  const cardCount = await cards.count()
  if (cardCount < route.minCards) {
    throw new Error(`${route.name}: expected at least ${route.minCards} cards, got ${cardCount}`)
  }

  const samples = []
  const limit = Math.min(cardCount, count)
  for (let index = 0; index < limit; index += 1) {
    const card = cards.nth(index)
    samples.push({
      index,
      href: await card.getAttribute('href'),
      text: (await card.innerText().catch(() => '')).slice(0, 160)
    })
  }

  return { cardCount, samples }
}

async function profileCard(browser, route, sample) {
  const { context, page } = await createCleanContext(browser, {
    viewport: { width: 1366, height: 768 }
  })
  const events = createCollector(page)
  const responses = []

  page.on('response', (response) => {
    const headers = response.headers()
    responses.push({
      url: response.url(),
      status: response.status(),
      type: response.request().resourceType(),
      transferSize: Number(headers['content-length'] || 0) || 0
    })
  })

  const startedAt = Date.now()
  let result

  try {
    await page.goto(route.url, { waitUntil: 'networkidle', timeout: 60000 })
    const card = page.locator('.movie-card').nth(sample.index)
    const href = await card.getAttribute('href')

    await Promise.all([
      page.waitForURL(/\/movie\//, { timeout: 30000 }),
      card.click()
    ])
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
    await assertNoNotFound(page, `${route.name} card ${sample.index}`)

    const movieUrl = page.url()
    const metrics = await collectPerformance(page)
    const movieTitle = await page.title().catch(() => '')
    const playerFrames = await page.locator('iframe').count().catch(() => 0)

    await page.screenshot({
      path: path.join(reportsDir, `card-${route.name}-${sample.index}.png`),
      fullPage: false
    })

    const badResponses = events.badResponses.filter((response) => response.status !== 404)

    const groups = groupResponses(responses)

    result = {
      ok:
        events.consoleErrors.length === 0 &&
        events.pageErrors.length === 0 &&
        events.failedRequests.length === 0 &&
        badResponses.length === 0,
      route: route.name,
      sourceUrl: route.url,
      index: sample.index,
      sourceHref: href,
      movieUrl,
      movieTitle,
      wallTimeMs: Date.now() - startedAt,
      metrics,
      responseSummary: {
        total: responses.length,
        document: responses.filter((response) => response.type === 'document').length,
        script: responses.filter((response) => response.type === 'script').length,
        image: responses.filter((response) => response.type === 'image').length,
        xhr: responses.filter((response) => response.type === 'xhr').length,
        fetch: responses.filter((response) => response.type === 'fetch').length
      },
      topResponseGroups: groups.slice(0, 12),
      playerFrames,
      events: {
        consoleErrors: events.consoleErrors,
        pageErrors: events.pageErrors,
        failedRequests: events.failedRequests,
        badResponses
      }
    }
  } catch (error) {
    result = {
      ok: false,
      route: route.name,
      index: sample.index,
      sourceHref: sample.href,
      wallTimeMs: Date.now() - startedAt,
      error: error.message,
      stack: error.stack,
      events
    }
  } finally {
    await context.close()
  }

  return result
}

function groupResponses(responses) {
  const groups = new Map()

  for (const response of responses) {
    let key = response.url
    try {
      const url = new URL(response.url)
      key = `${response.type} ${url.hostname}${url.pathname.replace(/\/\d+([/?#]|$)/g, '/:id$1')}`
    } catch {
      key = `${response.type} ${response.url}`
    }

    const current = groups.get(key) || {
      key,
      count: 0,
      transferSize: 0,
      statuses: {}
    }

    current.count += 1
    current.transferSize += response.transferSize
    current.statuses[response.status] = (current.statuses[response.status] || 0) + 1
    groups.set(key, current)
  }

  return [...groups.values()].sort((a, b) => b.count - a.count || b.transferSize - a.transferSize)
}

async function main() {
  await ensureReportsDir()

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false
  })

  const discoveryContextData = await createCleanContext(browser, {
    viewport: { width: 1366, height: 768 }
  })
  const discoveryPage = discoveryContextData.page

  const discovered = []
  for (const route of listRoutes) {
    discovered.push({
      route,
      ...(await getCardSamples(discoveryPage, route, sampleCount))
    })
  }
  await discoveryContextData.context.close()

  const profiles = []
  for (const entry of discovered) {
    for (const sample of entry.samples) {
      profiles.push(await profileCard(browser, entry.route, sample))
    }
  }

  await browser.close()

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    cleanBrowserContext: true,
    serviceWorkers: 'blocked',
    sampleCount,
    ok: profiles.every((profile) => profile.ok),
    discovered: discovered.map(({ route, cardCount, samples }) => ({
      route: route.name,
      cardCount,
      samples
    })),
    profiles
  }

  await fs.writeFile(path.join(reportsDir, 'card-profile.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  await ensureReportsDir()
  await fs.writeFile(
    path.join(reportsDir, 'card-profile.json'),
    JSON.stringify(
      {
        baseUrl,
        generatedAt: new Date().toISOString(),
        ok: false,
        fatalError: {
          message: error.message,
          stack: error.stack
        }
      },
      null,
      2
    )
  )
  console.error(error)
  process.exit(1)
})
