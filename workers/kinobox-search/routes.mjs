const VALID_ID = /^[1-9]\d{0,11}$/

export function resolveContentResource(url) {
  const path = url.pathname
  if (path === '/' || path === '/api/movies/search/' || path === '/api/movies/search') {
    const query = (url.searchParams.get('query') || '').trim()
    if (!query || query.length > 150) return { error: 'Invalid query', status: 400 }
    return {
      kind: 'search',
      path: '/api/movies/search/',
      params: { query },
      cacheTtl: 600
    }
  }
  // Player lists are no longer served. Sites released before this change call it
  // as their last fallback; answer at once instead of letting them wait.
  if (path === '/api/players' || path === '/api/players/')
    return { error: 'Players are not served by this API', status: 410 }
  const movie = /^\/api\/movies\/([^/]+)\/?$/.exec(path)
  if (movie) {
    if (!VALID_ID.test(movie[1])) return { error: 'Invalid Kinopoisk ID', status: 400 }
    return { kind: 'movie', path: '/api/movies/' + movie[1], params: {}, cacheTtl: 21600 }
  }
  return { error: 'Not found', status: 404 }
}

export function getContentCacheUrl(origin, resource, version) {
  const url = new URL('/__content-cache', origin)
  url.searchParams.set('path', resource.path)
  url.searchParams.set('version', version)
  for (const [name, value] of Object.entries(resource.params)) {
    // Keep exact validated input so distinct queries cannot share a cache entry.
    url.searchParams.set(name, value)
  }
  return url.toString()
}

export function isContentResponseValid(kind, data) {
  if (kind === 'search') return Array.isArray(data?.data?.items)
  if (kind === 'movie') {
    const movie = data?.data?.movie
    return Boolean(movie && typeof movie === 'object' && !Array.isArray(movie))
  }
  return false
}
