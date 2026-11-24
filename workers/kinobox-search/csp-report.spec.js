// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveCspReport, summarizeCspReports } from './csp-report.mjs'

const post = (body, headers = {}) =>
  new Request('https://api.reyhoho.fun/api/csp-report', {
    method: 'POST',
    headers: { Origin: 'https://reyhoho.fun', 'Content-Type': 'application/csp-report', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })

describe('CSP reports', () => {
  afterEach(() => vi.restoreAllMocks())
  it('logs origins and paths only, never queries', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await serveCspReport(
      post({
        'csp-report': {
          'document-uri': 'https://reyhoho.fun/auth-success?token=secret',
          'violated-directive': 'script-src-elem',
          'blocked-uri': 'https://evil.example/x.js?k=1',
          'source-file': 'https://reyhoho.fun/assets/a.js',
          'line-number': 12
        }
      }),
      true
    )
    expect(response.status).toBe(204)
    const line = log.mock.calls[0][0]
    expect(JSON.parse(line)).toEqual({
      event: 'csp_report',
      directive: 'script-src-elem',
      blocked: 'https://evil.example',
      page: '/auth-success',
      source: 'https://reyhoho.fun',
      line: 12
    })
    expect(line).not.toContain('secret')
  })
  it('reads the Reporting API format and keywords', () => {
    expect(
      summarizeCspReports([
        { type: 'csp-violation', body: { effectiveDirective: 'script-src', blockedURL: 'inline' } },
        { type: 'deprecation', body: {} }
      ])
    ).toEqual([{ directive: 'script-src', blocked: 'inline', page: '', source: '', line: 0 }])
  })
  it('answers the preflight and rejects bad input', async () => {
    const preflight = await serveCspReport(
      new Request('https://api.reyhoho.fun/api/csp-report', { method: 'OPTIONS' }),
      true
    )
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect((await serveCspReport(post('not json'), true)).status).toBe(400)
    expect((await serveCspReport(post('x'.repeat(40000)), true)).status).toBe(413)
    expect((await serveCspReport(post({}), false)).status).toBe(403)
  })
  it('stops reading at the byte limit without Content-Length and counts bytes', async () => {
    const chunk = new TextEncoder().encode('x'.repeat(16 * 1024))
    let pulled = 0
    const endless = new ReadableStream({
      pull(controller) {
        pulled += 1
        controller.enqueue(chunk)
      }
    })
    const streamed = new Request('https://api.reyhoho.fun/api/csp-report', {
      method: 'POST',
      headers: { Origin: 'https://reyhoho.fun' },
      body: endless,
      duplex: 'half'
    })
    expect((await serveCspReport(streamed, true)).status).toBe(413)
    expect(pulled).toBeLessThan(5)
    // 20,000 Cyrillic characters are about 40 KB of UTF-8.
    const wide = { 'csp-report': { 'document-uri': 'https://reyhoho.fun/' + 'я'.repeat(20000) } }
    expect((await serveCspReport(post(wide), true)).status).toBe(413)
  })
  it('limits reports per IP and drops them when the limiter fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const keys = []
    const limited = {
      PUBLIC_RATE_LIMITER: {
        limit: async ({ key }) => (keys.push(key), { success: keys.length < 2 })
      }
    }
    const report = () => post({ 'csp-report': {} }, { 'CF-Connecting-IP': '203.0.113.7' })
    expect((await serveCspReport(report(), true, limited)).status).toBe(204)
    expect((await serveCspReport(report(), true, limited)).status).toBe(429)
    expect(keys).toEqual(['csp:203.0.113.7', 'csp:203.0.113.7'])
    const broken = { PUBLIC_RATE_LIMITER: { limit: async () => Promise.reject(new Error('down')) } }
    expect((await serveCspReport(report(), true, broken)).status).toBe(429)
  })
})
