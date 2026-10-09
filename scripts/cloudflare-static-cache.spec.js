// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cacheRules } from './cloudflare-static-cache.mjs'

describe('Cloudflare static rules scope', () => {
  it('matches only front-host immutable assets, not the API or all assets', () => {
    for (const { rule } of cacheRules) {
      expect(rule.expression).toContain('http.host in {"reyhoho.fun" "www.reyhoho.fun"}')
      expect(rule.expression).toContain('"/assets/immutable/"')
      expect(rule.expression).not.toContain('api.reyhoho.fun')
    }
  })
  it('does not give errors a long edge or browser TTL', () => {
    expect(cacheRules[0].rule.action_parameters.edge_ttl.status_code_ttl).toContainEqual({
      status_code_range: { from: 300, to: 599 },
      value: -1
    })
    expect(cacheRules[1].rule.expression).toContain('http.response.code in {200 206 304}')
  })
})
