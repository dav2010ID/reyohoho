// Public-host behavior using local artifacts and inert analytics stubs only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createProfileServer } from './frontend-profile-server.js'

const server = await createProfileServer({ root: path.resolve(process.argv[2] || 'dist'), port: 0 })
const localOrigin = `http://127.0.0.1:${server.address().port}`
const publicOrigin = 'http://analytics.reyohoho.test'
const homeTitle = 'ReYohoho - поиск фильмов и сериалов онлайн бесплатно'
let browser
const results = []

async function fixturePage({ local = false, auth = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  const requests = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'www.googletagmanager.com') {
      requests.push({ kind: 'gtm', time: Date.now() })
      return route.fulfill({
        contentType: 'text/javascript',
        body: `
        window.__analyticsLoadTime = performance.now();
        window.ym(109132833, 'init', {defer: false});
        window.__queuedMetrika = window.ym.a.map(args => Array.from(args));
        window.__queuedEvents = window.dataLayer.slice();
        // Inert model: defer suppresses the automatic pageview, and queued hits
        // wait for init. Observe the same ym.a queue for later SPA navigations.
        window.__metrikaPages = [];
        const waiting = [];
        let initialized = false;
        const replay = args => {
          const [id, method, value, options] = args;
          if (Number(id) !== 109132833) return;
          if (method === 'init' && !initialized) {
            initialized = true;
            if (!value.defer) {
              window.__metrikaPages.push({
                url: value.url || location.href,
                title: document.title,
                automatic: true
              });
            }
            waiting.splice(0).forEach(replay);
          } else if (method === 'hit') {
            if (initialized) {
              window.__metrikaPages.push({url: value, ...options, automatic: false});
            } else waiting.push(args);
          }
        };
        window.ym.a.forEach(replay);
        const queue = window.ym.a;
        queue.push = (...calls) => {
          const length = Array.prototype.push.apply(queue, calls);
          calls.forEach(replay);
          return length;
        };
      `
      })
    }
    if (url.pathname.endsWith('/goatcounter/count.v5.js')) {
      requests.push({ kind: 'goatcounter', time: Date.now() })
      return route.fulfill({
        contentType: 'text/javascript',
        body: `
        window.__goatPages = [];
        window.goatcounter.count = page => window.__goatPages.push(page);
      `
      })
    }
    if (![publicOrigin, localOrigin].includes(url.origin)) return route.abort()
    const response = await page.request.get(localOrigin + url.pathname + url.search)
    const headers = { ...response.headers() }
    delete headers['content-encoding']
    delete headers['content-length']
    headers['content-security-policy'] =
      "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; worker-src 'none'"
    let body = await response.body()
    if (/text\/(?:html|javascript)/.test(headers['content-type'])) {
      body = Buffer.from(
        body.toString().replaceAll(localOrigin, local ? localOrigin : publicOrigin)
      )
      if (auth && headers['content-type'].includes('text/html')) {
        // Hold the callback route before app navigation can consume its token.
        body = Buffer.from(body.toString().replace(/<script type="module"[^>]*><\/script>/g, ''))
      }
    }
    return route.fulfill({ status: response.status(), headers, body })
  })
  return { context, page, requests, errors }
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  })

  const interaction = await fixturePage()
  try {
    const { page, requests, errors } = interaction
    await page.goto(publicOrigin + '/', { waitUntil: 'networkidle' })
    const initialTitle = await page.title()
    assert.equal(initialTitle, homeTitle)
    assert.equal(requests.length, 0, 'Analytics must stay out of initial page load')
    await page.evaluate(() => {
      window.dataLayer.push({ event: 'fixture_before_analytics' })
      document.querySelector('a[href="/settings"]').click()
    })
    await page.waitForURL('**/settings')
    await page.waitForFunction(() => document.title === 'ReYohoho - Настройки')
    const settingsTitle = await page.title()
    assert.equal(requests.length, 0, 'Untrusted scripted clicks must not start analytics')
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => window.__goatPages?.length === 2)
    await page.waitForFunction(() => window.__queuedMetrika)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(250)
    const state = await page.evaluate(() => ({
      metrika: window.__queuedMetrika,
      metrikaPages: window.__metrikaPages,
      events: window.__queuedEvents,
      goatPages: window.__goatPages
    }))
    assert.equal(requests.filter((r) => r.kind === 'gtm').length, 1)
    assert.equal(requests.filter((r) => r.kind === 'goatcounter').length, 1)
    assert(state.events.some((event) => event.event === 'fixture_before_analytics'))
    const initializations = state.metrika.filter((args) => args[1] === 'init')
    assert.equal(initializations.length, 1, 'GTM must remain the only counter initializer')
    assert.equal(initializations[0][0], 109132833)
    assert.equal(initializations[0][2].url, publicOrigin + '/')
    assert.equal(initializations[0][2].defer, true, 'Suppress the duplicate automatic hit')
    const expectedPages = [
      { url: publicOrigin + '/', title: initialTitle, referer: '', automatic: false },
      {
        url: publicOrigin + '/settings',
        title: settingsTitle,
        referer: publicOrigin + '/',
        automatic: false
      }
    ]
    assert.deepEqual(state.metrikaPages, expectedPages)
    assert.deepEqual(
      state.goatPages.map((p) => p.path),
      ['/', '/settings']
    )
    await page.evaluate(() => document.querySelector('a[href="/"]').click())
    await page.waitForURL(publicOrigin + '/')
    await page.waitForFunction(() => window.__metrikaPages?.length === 3)
    expectedPages.push({
      url: publicOrigin + '/',
      title: initialTitle,
      referer: publicOrigin + '/settings',
      automatic: false
    })
    const afterNavigation = await page.evaluate(() => ({
      metrikaPages: window.__metrikaPages,
      initializations: window.ym.a.filter((args) => args[1] === 'init').length
    }))
    assert.deepEqual(afterNavigation.metrikaPages, expectedPages)
    assert.equal(afterNavigation.initializations, 1)
    assert.equal(requests.filter((r) => r.kind === 'gtm').length, 1)
    assert.equal(requests.filter((r) => r.kind === 'goatcounter').length, 1)
    assert.deepEqual(errors, [])
    results.push({
      scenario: 'trusted interaction, queued SPA pages, single startup',
      requests,
      state,
      afterNavigation
    })
  } finally {
    await interaction.context.close()
  }

  const automatic = await fixturePage()
  try {
    const { page, requests, errors } = automatic
    await page.goto(publicOrigin + '/', { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    assert.equal(requests.length, 0)
    await page.waitForFunction(() => window.__analyticsLoadTime, undefined, { timeout: 10000 })
    const timing = await page.evaluate(() => ({
      load: performance.getEntriesByType('navigation')[0].loadEventEnd,
      analytics: window.__analyticsLoadTime
    }))
    assert(timing.analytics - timing.load >= 4900, JSON.stringify(timing))
    const initialPages = await page.evaluate(() => window.__metrikaPages)
    assert.deepEqual(initialPages, [
      {
        url: publicOrigin + '/',
        title: homeTitle,
        referer: '',
        automatic: false
      }
    ])
    assert.deepEqual(errors, [])
    results.push({ scenario: 'load plus five second grace', timing, requests, initialPages })
  } finally {
    await automatic.context.close()
  }

  for (const excluded of [{ local: true }, { auth: true }]) {
    const fixture = await fixturePage(excluded)
    try {
      const { page, requests } = fixture
      const origin = excluded.local ? localOrigin : publicOrigin
      await page.goto(origin + '/', { waitUntil: 'networkidle' })
      if (excluded.auth) {
        await page.evaluate(() =>
          window.history.replaceState(null, '', '/auth-success?token=fixture-secret')
        )
        await page.evaluate(() => {
          window.loadReyohohoAnalytics()
          window.loadReyohohoGoatCounter()
        })
      }
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(400)
      assert.equal(requests.length, 0, 'Local and token callback pages must not load analytics')
      results.push({
        scenario: excluded.local ? 'local host excluded' : 'auth callback excluded',
        requests
      })
    } finally {
      await fixture.context.close()
    }
  }
  await fs.mkdir('reports-browser', { recursive: true })
  await fs.writeFile(
    'reports-browser/analytics-startup.json',
    JSON.stringify(
      {
        browser: browser.version(),
        fixture: 'local-only',
        results
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Passed ${results.length} deferred analytics scenarios.`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
