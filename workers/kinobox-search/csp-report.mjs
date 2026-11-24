// CSP violation reports from reyhoho.fun (report-uri and the Reporting API).
// Only origins and paths are logged: page queries can hold tokens or searches.
import { boundedJson } from './private-api.mjs'

const MAX_BYTES = 32 * 1024
const MAX_REPORTS = 10

const originOf = (value) => {
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    // Keywords such as "inline", "eval" or "data".
    return String(value).slice(0, 40)
  }
}
const pathOf = (value) => {
  try {
    return new URL(value).pathname.slice(0, 200)
  } catch {
    return ''
  }
}

export function summarizeCspReports(payload) {
  // report-uri: {"csp-report": {...}}; Reporting API: [{type, body}, ...].
  const reports = Array.isArray(payload)
    ? payload.filter((item) => item?.type === 'csp-violation').map((item) => item.body)
    : [payload?.['csp-report']]
  return reports
    .filter((report) => report && typeof report === 'object')
    .slice(0, MAX_REPORTS)
    .map((report) => ({
      directive: String(
        report.effectiveDirective || report['effective-directive'] || report['violated-directive'] || ''
      ).slice(0, 40),
      blocked: originOf(report.blockedURL || report['blocked-uri']),
      page: pathOf(report.documentURL || report['document-uri']),
      source: originOf(report.sourceFile || report['source-file']),
      line: Number(report.lineNumber || report['line-number']) || 0
    }))
}

export async function serveCspReport(request, allowedOrigin, env = {}) {
  const origin = request.headers.get('Origin')
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin ? origin : 'https://reyhoho.fun',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  }
  const done = (status = 204) => new Response(null, { status, headers })
  if (request.method === 'OPTIONS') return done()
  if (request.method !== 'POST') return done(405)
  if (origin && !allowedOrigin) return done(403)
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return done(413)
  // Reports are unauthenticated: a per-IP budget keeps them from flooding logs.
  if (env.PUBLIC_RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'local'
    let allowed = false
    try {
      allowed = (await env.PUBLIC_RATE_LIMITER.limit({ key: `csp:${ip}` })).success
    } catch {
      // Without a working limiter, drop the report rather than log without bound.
    }
    if (!allowed) return done(429)
  }
  let payload
  try {
    // Stops reading at the byte limit, also without Content-Length.
    payload = await boundedJson(request.body, MAX_BYTES)
  } catch (error) {
    return done(error.message === 'Body too large' ? 413 : 400)
  }
  for (const report of summarizeCspReports(payload))
    console.log(JSON.stringify({ event: 'csp_report', ...report }))
  return done()
}
