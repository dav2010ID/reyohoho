// Reproducible, narrowly scoped cache rules. Requires a zone-scoped Rulesets
// edit token in the environment; never writes credentials to disk or logs.
const zone = process.env.CLOUDFLARE_ZONE_ID
const token = process.env.CLOUDFLARE_API_TOKEN
const front =
  '(http.host in {"reyhoho.fun" "www.reyhoho.fun"} and http.request.method in {"GET" "HEAD"} and starts_with(http.request.uri.path, "/assets/immutable/"))'
export const cacheRules = [
  {
    phase: 'http_request_cache_settings',
    rule: {
      ref: 'reyohoho_immutable_edge',
      description: 'Hashed build assets only: edge 30 days, never cache errors',
      expression: front,
      action: 'set_cache_settings',
      enabled: true,
      action_parameters: {
        cache: true,
        browser_ttl: { mode: 'respect_origin' },
        edge_ttl: {
          mode: 'override_origin',
          default: 2592000,
          status_code_ttl: [
            { status_code: 200, value: 2592000 },
            { status_code: 206, value: 2592000 },
            { status_code_range: { from: 300, to: 599 }, value: -1 }
          ]
        }
      }
    }
  },
  {
    phase: 'http_response_headers_transform',
    rule: {
      ref: 'reyohoho_immutable_browser',
      description: 'Successful hashed assets: browser one year immutable',
      expression: front + ' and http.response.code in {200 206 304}',
      action: 'rewrite',
      enabled: true,
      action_parameters: {
        headers: {
          'cache-control': { operation: 'set', value: 'public, max-age=31536000, immutable' }
        }
      }
    }
  }
]

async function request(path, method = 'GET', body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const result = await response.json()
  if (!response.ok || !result.success)
    throw new Error(
      `Cloudflare ${response.status}: ${result.errors?.map((e) => e.message).join(', ') || 'request failed'}`
    )
  return result.result
}

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(cacheRules, null, 2))
    return
  }
  if (!/^[a-f0-9]{32}$/.test(zone || '') || !token)
    throw new Error('Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in the environment')
  const rulesets = await request('rulesets')
  for (const { phase, rule } of cacheRules) {
    const entry = rulesets.find((r) => r.phase === phase && r.kind === 'zone')
    if (!entry) {
      await request('rulesets', 'POST', {
        name: 'ReYohoho static cache',
        kind: 'zone',
        phase,
        rules: [rule]
      })
    } else {
      const current = await request(`rulesets/${entry.id}`)
      const existing = current.rules.find((r) => r.ref === rule.ref)
      // Patch only our rule or append; never replace unrelated zone settings.
      await request(
        `rulesets/${entry.id}/rules${existing ? '/' + existing.id : ''}`,
        existing ? 'PATCH' : 'POST',
        rule
      )
    }
    console.log(`Applied ${rule.ref}`)
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/cloudflare-static-cache.mjs'))
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
