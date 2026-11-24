// Charge only actual upstream attempts, after cache hits and request collapse.
export function publicUpstreamBudget(request, env, headers) {
  return async () => {
    try {
      if (!env.PUBLIC_RATE_LIMITER) throw new Error('Missing public limiter')
      const { success } = await env.PUBLIC_RATE_LIMITER.limit({
        key: request.headers.get('CF-Connecting-IP') || 'unknown'
      })
      if (success) return null
      return new Response(JSON.stringify({ error: 'Too many upstream requests' }), {
        status: 429,
        headers: { ...headers, 'Retry-After': '60' }
      })
    } catch {
      console.error(JSON.stringify({ event: 'public_budget_unavailable' }))
      return new Response(JSON.stringify({ error: 'Upstream budget unavailable' }), {
        status: 503,
        headers: { ...headers, 'Retry-After': '60' }
      })
    }
  }
}
