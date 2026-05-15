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

async function scrollUntilCardCountIncreases(page, previousCount) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForFunction(
    (count) => document.querySelectorAll('.movie-card').length > count,
    previousCount,
    { timeout: 15000 }
  )

  return await page.locator('.movie-card').count()
}

async function main() {
  await ensureReportsDir()

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false
  })

  const { context, page } = await createCleanContext(browser, {
    viewport: { width: 1366, height: 768 }
  })
  const events = createCollector(page)
  const checks = []

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 })
    await assertNoNotFound(page, 'home infinite scroll')
    const homeBefore = await page.locator('.movie-card').count()
    const homeAfter = await scrollUntilCardCountIncreases(page, homeBefore)
    checks.push({
      name: 'home infinite scroll',
      ok: homeBefore === 24 && homeAfter >= 48,
      before: homeBefore,
      after: homeAfter
    })

    await page.goto(new URL('/top', baseUrl).toString(), {
      waitUntil: 'networkidle',
      timeout: 60000
    })
    await assertNoNotFound(page, 'top infinite scroll')
    const topBefore = await page.locator('.movie-card').count()
    const topAfter = await scrollUntilCardCountIncreases(page, topBefore)
    checks.push({
      name: 'top infinite scroll',
      ok: topBefore === 36 && topAfter >= 72,
      before: topBefore,
      after: topAfter
    })
  } finally {
    await context.close()
    await browser.close()
  }

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    ok:
      checks.every((check) => check.ok) &&
      events.consoleErrors.length === 0 &&
      events.pageErrors.length === 0 &&
      events.failedRequests.length === 0 &&
      events.badResponses.length === 0,
    checks,
    events
  }

  await fs.writeFile(
    path.join(reportsDir, 'browser-infinite-scroll.json'),
    JSON.stringify(report, null, 2)
  )
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
    path.join(reportsDir, 'browser-infinite-scroll.json'),
    JSON.stringify(failedReport, null, 2)
  )
  console.error(error)
  process.exit(1)
})
