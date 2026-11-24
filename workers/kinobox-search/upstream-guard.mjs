// Per-upstream protection, on top of the per-IP public budget:
// - a circuit breaker per isolate: after repeated failures the upstream is
//   skipped for a while instead of every request waiting for its timeout;
// - an optional shared budget per upstream (UPSTREAM_RATE_LIMITER binding), so
//   many IPs together cannot exhaust a provider quota;
// - KINOBOX_TRANSPORT=off: a kill switch for the vendored TLS/HTTP2 transport.
export const BREAKER_FAILURES = 5
export const BREAKER_OPEN_MS = 30_000

const breakers = new Map()

export class UpstreamUnavailable extends Error {
  constructor(upstream, reason) {
    super(`${upstream} unavailable: ${reason}`)
    this.name = 'UpstreamUnavailable'
    this.upstream = upstream
    this.reason = reason
  }
}

export const resetUpstreamGuards = () => breakers.clear()

// Only upstream trouble opens the breaker, not "this title does not exist".
const isFailure = (error) => {
  const status = error?.upstreamStatus
  return !status || status >= 500 || status === 429
}

function record(upstream, failed, now) {
  const state = breakers.get(upstream) || { failures: 0, openUntil: 0 }
  if (!failed) {
    breakers.delete(upstream)
    return
  }
  state.failures += 1
  if (state.failures >= BREAKER_FAILURES) {
    state.openUntil = now + BREAKER_OPEN_MS
    state.failures = 0
    console.error(JSON.stringify({ event: 'upstream_circuit_open', upstream, ms: BREAKER_OPEN_MS }))
  }
  breakers.set(upstream, state)
}

export async function guardUpstream(upstream, env, run, now = Date.now) {
  if (upstream === 'kinobox' && env?.KINOBOX_TRANSPORT === 'off')
    throw new UpstreamUnavailable(upstream, 'disabled')
  if ((breakers.get(upstream)?.openUntil || 0) > now())
    throw new UpstreamUnavailable(upstream, 'circuit_open')
  if (env?.UPSTREAM_RATE_LIMITER) {
    let allowed = true
    try {
      allowed = (await env.UPSTREAM_RATE_LIMITER.limit({ key: `upstream:${upstream}` })).success
    } catch {
      // A broken limiter must not take the catalogue down; the per-IP budget still applies.
    }
    if (!allowed) {
      console.error(JSON.stringify({ event: 'upstream_budget_exhausted', upstream }))
      throw new UpstreamUnavailable(upstream, 'upstream_budget')
    }
  }
  try {
    const response = await run()
    // Throttling counts as trouble whether it arrives as a response or an error.
    record(upstream, response?.status >= 500 || response?.status === 429, now())
    return response
  } catch (error) {
    record(upstream, isFailure(error), now())
    throw error
  }
}
