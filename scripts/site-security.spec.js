// @vitest-environment node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_INLINE_SCRIPTS,
  buildCsp,
  collectSiteSecurity,
  headersBlock,
  inlineScriptHashes,
  prerenderedMoviePaths,
  securityHeaders
} from './site-security.js'

const sha = (body) => `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`
let dir
afterEach(() => dir && fs.rm(dir, { recursive: true, force: true }))
const page = async (file, html) => {
  await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true })
  await fs.writeFile(path.join(dir, file), html)
}

describe('site security headers', () => {
  it('hashes executable inline scripts only', () => {
    const html = [
      '<script>a()</script>',
      '<script type="module">b()</script>',
      '<script src="/c.js"></script>',
      '<script type="application/ld+json">{}</script>',
      '<script type="application/json" id="ssg-state">"{}"</script>'
    ].join('')
    expect(inlineScriptHashes(html)).toEqual([sha('a()'), sha('b()')])
  })
  it('refuses prerendered state left in an inline script', () => {
    expect(() => inlineScriptHashes('<script>window.__INITIAL_STATE__="{}"</script>')).toThrow(
      /must ship as JSON/
    )
  })
  it('collects one hash set for the site and maps canonical movie pages', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-security-'))
    await page('index.html', '<script>boot()</script>')
    await page('movie/301/the-matrix/index.html', '<script>boot()</script>')
    await page('movie/bad/x/index.html', '')
    expect(await collectSiteSecurity(dir)).toEqual([sha('boot()')])
    expect(await prerenderedMoviePaths(dir)).toEqual({ 301: '/movie/301/the-matrix/' })
    for (let index = 0; index <= MAX_INLINE_SCRIPTS; index += 1)
      await page(`p${index}/index.html`, `<script>run(${index})</script>`)
    await expect(collectSiteSecurity(dir)).rejects.toThrow(/inline scripts/)
  })
  it('builds a report-only policy that reports to the API Worker', () => {
    const csp = buildCsp({
      scriptHashes: [sha('boot()')],
      apiOrigin: 'https://api.example',
      connectOrigins: ['https://api.example', null]
    })
    expect(csp).toContain(`script-src 'self' ${sha('boot()')} https://www.googletagmanager.com`)
    expect(csp).toContain("connect-src 'self' https://api.example https://img.youtube.com")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('report-uri https://api.example/api/csp-report')
    const headers = securityHeaders({ scriptHashes: [], apiOrigin: 'https://api.example' })
    expect(headers).toHaveProperty('Content-Security-Policy-Report-Only')
    expect(headers).not.toHaveProperty('Content-Security-Policy')
    expect(headersBlock('/*', { A: '1' })).toBe('/*\n  A: 1')
  })
})
