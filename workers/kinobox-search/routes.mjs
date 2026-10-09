const VALID_ID = /^[1-9]\d{0,11}$/

export function resolveKinoboxResource(url) {
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
  if (path === '/api/players' || path === '/api/players/') {
    const kinopoisk = url.searchParams.get('kinopoisk') || ''
    if (!VALID_ID.test(kinopoisk)) return { error: 'Invalid Kinopoisk ID', status: 400 }
    const title = (url.searchParams.get('title') || '').trim()
    if (title.length > 300) return { error: 'Invalid title', status: 400 }
    return {
      kind: 'players',
      path: '/api/players',
      params: { kinopoisk, ...(title ? { title } : {}) },
      cacheTtl: 60
    }
  }
  const movie = /^\/api\/movies\/([^/]+)\/?$/.exec(path)
  if (movie) {
    if (!VALID_ID.test(movie[1])) return { error: 'Invalid Kinopoisk ID', status: 400 }
    return { kind: 'movie', path: '/api/movies/' + movie[1], params: {}, cacheTtl: 21600 }
  }
  return { error: 'Not found', status: 404 }
}

export function getKinoboxCacheUrl(origin, resource, version) {
  const url = new URL('/__kinobox-cache', origin)
  url.searchParams.set('path', resource.path)
  url.searchParams.set('version', version)
  for (const [name, value] of Object.entries(resource.params)) {
    // Keep exact validated input so distinct provider queries cannot share a cache entry.
    url.searchParams.set(name, value)
  }
  return url.toString()
}

export function isKinoboxResponseValid(kind, data) {
  if (kind === 'search') return Array.isArray(data?.data?.items)
  if (kind === 'players') return Array.isArray(data?.data)
  if (kind === 'movie') {
    const movie = data?.data?.movie
    return Boolean(movie && typeof movie === 'object' && !Array.isArray(movie))
  }
  return false
}
