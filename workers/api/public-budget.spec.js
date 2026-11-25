// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { publicUpstreamBudget } from './public-budget.mjs'
describe('public upstream budget', () => {
  it('uses the Cloudflare client address and fails closed on missing/error bindings', async () => {
    const request = new Request('https://api.example/api/movies/301', { headers: { 'CF-Connecting-IP': '192.0.2.1' } })
    const limit = vi.fn(async () => ({ success: true }))
    expect(await publicUpstreamBudget(request, { PUBLIC_RATE_LIMITER: { limit } }, {})()).toBeNull()
    expect(limit).toHaveBeenCalledWith({ key: '192.0.2.1' })
    limit.mockResolvedValue({ success: false })
    const denied = await publicUpstreamBudget(request, { PUBLIC_RATE_LIMITER: { limit } }, {})()
    expect(denied.status).toBe(429)
    expect(denied.headers.get('Retry-After')).toBe('60')
    expect((await publicUpstreamBudget(request, {}, {})()).status).toBe(503)
    limit.mockRejectedValue(new Error('unavailable'))
    expect((await publicUpstreamBudget(request, { PUBLIC_RATE_LIMITER: { limit } }, {})()).status).toBe(503)
  })
})
