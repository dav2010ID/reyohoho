import fs from 'node:fs/promises'
import path from 'node:path'

export const reportsDir = path.resolve('reports-browser')

export const resolveAppUrl = (baseUrl, route = '') => {
  const url = new URL(baseUrl)
  const basePath = url.pathname.replace(/\/+$/, '')
  const routePath = String(route).replace(/^\/+/, '')
  url.pathname = routePath ? `${basePath}/${routePath}` : `${basePath}/`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export const ignoredFailedUrlPatterns = [
  /googleapis\.com/,
  /gstatic\.com/,
  /goatcounter/,
  /favicon\.ico/,
  /stravers\.live/,
  /api4\.rhserv\.vu\//,
  /avatars\.mds\.yandex\.net/,
  /st\.kp\.yandex\.net/
]

export const isIgnoredFailure = (url) =>
  ignoredFailedUrlPatterns.some((pattern) => pattern.test(url))

const ignoredConsoleMessagePatterns = [
  /api4\.rhserv\.vu\//,
  /^Error loading rating: AxiosError: Network Error/
]

export const isIgnoredConsoleError = (message, locationUrl = '') =>
  isIgnoredFailure(locationUrl) ||
  ignoredConsoleMessagePatterns.some((pattern) => pattern.test(message))

export const isCancelledByNavigation = (request) =>
  request.failure()?.errorText === 'net::ERR_ABORTED'

export async function ensureReportsDir() {
  await fs.mkdir(reportsDir, { recursive: true })
}

export async function createCleanContext(browser, options = {}) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    ...options
  })

  await context.clearCookies()

  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.clearBrowserCookies')

  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
    indexedDB.databases?.().then((databases) => {
      for (const database of databases) {
        if (database.name) indexedDB.deleteDatabase(database.name)
      }
    })
    caches.keys?.().then((keys) => {
      for (const key of keys) caches.delete(key)
    })
  })

  return { context, page }
}

export function createCollector(page) {
  const events = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    navigations: []
  }

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location()
      if (isIgnoredConsoleError(message.text(), location.url)) return

      events.consoleErrors.push({
        text: message.text(),
        location
      })
    }
  })

  page.on('pageerror', (error) => {
    events.pageErrors.push({
      message: error.message,
      stack: error.stack
    })
  })

  page.on('requestfailed', (request) => {
    const url = request.url()
    if (isCancelledByNavigation(request)) return
    if (isIgnoredFailure(url)) return

    events.failedRequests.push({
      url,
      method: request.method(),
      failure: request.failure()?.errorText || ''
    })
  })

  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()

    if (status >= 400 && !isIgnoredFailure(url)) {
      events.badResponses.push({
        url,
        status,
        statusText: response.statusText()
      })
    }
  })

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      events.navigations.push(frame.url())
    }
  })

  return events
}

export async function assertNoNotFound(page, stepName) {
  const url = page.url()
  const title = await page.title().catch(() => '')
  const bodyText = await page
    .locator('body')
    .innerText({ timeout: 5000 })
    .catch(() => '')
  const hasNotFoundRoute = /\/404(?:\.html)?$/.test(new URL(url).pathname)
  const hasNotFoundText = /404|not found|страница не найдена/i.test(`${title}\n${bodyText}`)

  if (hasNotFoundRoute || hasNotFoundText) {
    throw new Error(`${stepName}: reached not found page (${url})`)
  }
}

export async function collectPerformance(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const resources = performance.getEntriesByType('resource')
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime])
    )

    return {
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd || 0),
      loadEventEnd: Math.round(nav?.loadEventEnd || 0),
      firstPaint: Math.round(paint['first-paint'] || 0),
      firstContentfulPaint: Math.round(paint['first-contentful-paint'] || 0),
      transferSize: resources.reduce((total, entry) => total + (entry.transferSize || 0), 0),
      encodedBodySize: resources.reduce((total, entry) => total + (entry.encodedBodySize || 0), 0),
      resourceCount: resources.length
    }
  })
}
