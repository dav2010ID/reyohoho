import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  assertNoNotFound,
  createCleanContext,
  createCollector,
  ensureReportsDir,
  reportsDir
} from './browser-test-utils.js'

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function recordStep(steps, name, run) {
  const startedAt = Date.now()
  try {
    const data = await run()
    steps.push({
      name,
      ok: true,
      durationMs: Date.now() - startedAt,
      ...(data || {})
    })
  } catch (error) {
    steps.push({
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error.message,
      stack: error.stack
    })
    throw error
  }
}

async function clickFirstMovieCard(page, sourceName) {
  const cards = page.locator('.movie-card')
  const count = await cards.count()
  if (count === 0) {
    throw new Error(`${sourceName}: no movie cards found`)
  }

  const firstHref = await cards.first().getAttribute('href')
  await Promise.all([
    page.waitForURL(/\/movie\//, { timeout: 30000 }),
    cards.first().click()
  ])
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
  await assertNoNotFound(page, `${sourceName} first card`)

  return {
    cardCount: count,
    clickedHref: firstHref,
    currentUrl: page.url()
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
      path: path.join(reportsDir, 'smoke-network.har'),
      content: 'omit'
    }
  })
  const events = createCollector(page)
  const steps = []

  try {
    await recordStep(steps, 'open home', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 })
      await assertNoNotFound(page, 'home')
      await page.screenshot({ path: path.join(reportsDir, 'smoke-home.png') })
      return {
        url: page.url(),
        title: await page.title(),
        cards: await page.locator('.movie-card').count()
      }
    })

    await recordStep(steps, 'click home first movie card', async () => {
      const result = await clickFirstMovieCard(page, 'home')
      await page.screenshot({ path: path.join(reportsDir, 'smoke-movie-from-home.png') })
      return result
    })

    await recordStep(steps, 'back to home', async () => {
      await page.goBack({ waitUntil: 'networkidle', timeout: 60000 })
      await assertNoNotFound(page, 'back home')
      return {
        url: page.url(),
        cards: await page.locator('.movie-card').count()
      }
    })

    await recordStep(steps, 'open top page', async () => {
      await page.goto(new URL('/top', baseUrl).toString(), { waitUntil: 'networkidle', timeout: 60000 })
      await assertNoNotFound(page, 'top')
      await page.screenshot({ path: path.join(reportsDir, 'smoke-top.png') })
      return {
        url: page.url(),
        cards: await page.locator('.movie-card').count(),
        loadMoreVisible: await page.locator('.load-more-btn').isVisible().catch(() => false)
      }
    })

    await recordStep(steps, 'top show more', async () => {
      const button = page.locator('.load-more-btn')
      const before = await page.locator('.movie-card').count()
      const visible = await button.isVisible().catch(() => false)
      if (!visible) {
        return { before, after: before, skipped: true, reason: 'load more button hidden' }
      }

      await button.click()
      await page
        .waitForFunction(
          (previousCount) => {
            const count = document.querySelectorAll('.movie-card').length
            const loadMoreButton = document.querySelector('.load-more-btn')
            return count > previousCount || !loadMoreButton
          },
          before,
          { timeout: 10000 }
        )
        .catch(() => {})
      const after = await page.locator('.movie-card').count()
      if (after <= before) {
        const visibleAfterClick = await button.isVisible().catch(() => false)
        if (!visibleAfterClick) {
          return {
            before,
            after,
            exhausted: true,
            reason: 'load more did not add cards and button became hidden'
          }
        }

        throw new Error(`show more did not increase cards: before=${before}, after=${after}`)
      }
      return { before, after }
    })

    await recordStep(steps, 'top change filter', async () => {
      const filter = page.locator('.time-btn', { hasText: '7' }).first()
      await filter.click()
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
      await assertNoNotFound(page, 'top filter')
      return {
        url: page.url(),
        cards: await page.locator('.movie-card').count()
      }
    })

    await recordStep(steps, 'click top first movie card', async () => {
      const result = await clickFirstMovieCard(page, 'top')
      await page.screenshot({ path: path.join(reportsDir, 'smoke-movie-from-top.png') })
      return result
    })

    await recordStep(steps, 'open settings', async () => {
      await page.goto(new URL('/settings', baseUrl).toString(), {
        waitUntil: 'networkidle',
        timeout: 60000
      })
      await assertNoNotFound(page, 'settings')
      return {
        url: page.url(),
        title: await page.title()
      }
    })

    await recordStep(steps, 'open expected 404 route', async () => {
      await page.goto(new URL('/definitely-not-existing-route', baseUrl).toString(), {
        waitUntil: 'networkidle',
        timeout: 60000
      })
      const bodyText = await page.locator('body').innerText({ timeout: 10000 })
      const has404 = /404|not found|страница не найдена/i.test(bodyText)
      if (!has404) {
        throw new Error('unknown route did not render 404 content')
      }
      return {
        url: page.url(),
        has404
      }
    })
  } finally {
    await context.close()
    await browser.close()
  }

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    ok:
      steps.every((step) => step.ok) &&
      events.pageErrors.length === 0 &&
      events.failedRequests.length === 0 &&
      events.badResponses.length === 0,
    steps,
    events
  }

  await fs.writeFile(path.join(reportsDir, 'browser-smoke.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  if (!report.ok) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  await ensureReportsDir()
  const failedReport = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    ok: false,
    fatalError: {
      message: error.message,
      stack: error.stack
    }
  }
  await fs.writeFile(
    path.join(reportsDir, 'browser-smoke.json'),
    JSON.stringify(failedReport, null, 2)
  )
  console.error(error)
  process.exit(1)
})
