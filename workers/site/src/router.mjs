// The site Worker runs only after a static-asset miss (not_found_handling: none):
// prerendered pages, assets and their redirects never reach it.
const MOVIE = /^\/movie\/([1-9]\d{0,11})(?:\/[^/]*)?\/?$/
// Client-only pages that are not prerendered: always 200, never indexed.
const CLIENT_PAGES = /^\/lists(?:\/[^/]+)?\/?$/
const FILE = /\/[^/]+\.[a-z0-9]+$/i

function withHeaders(response, meta, extra = {}) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries({ ...meta.headers, ...extra })) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}

async function shell(request, env, meta, status) {
  // The home document is the app shell; the client router renders the real page.
  const home = await env.ASSETS.fetch(
    new Request(new URL('/', request.url), { method: request.method })
  )
  if (!home.ok) return home
  return withHeaders(new Response(home.body, { status, headers: home.headers }), meta, {
    'Cache-Control': 'no-cache',
    'X-Robots-Tag': 'noindex'
  })
}

const plain = (meta, status, text, extra = {}) =>
  withHeaders(
    new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
    meta,
    { 'Cache-Control': 'no-cache', ...extra }
  )

export async function routeSite(request, env, meta) {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return plain(meta, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
  const url = new URL(request.url)
  const movie = MOVIE.exec(url.pathname)
  if (movie) {
    const canonical = meta.movies[movie[1]]
    // A catalogued title without (or with an old) slug: one permanent redirect.
    if (canonical && canonical !== url.pathname)
      return withHeaders(
        new Response(null, {
          status: 301,
          headers: { Location: new URL(canonical + url.search, url).href }
        }),
        meta
      )
    // Any other valid ID still opens; the client loads it from the API.
    return shell(request, env, meta, 200)
  }
  if (CLIENT_PAGES.test(url.pathname)) return shell(request, env, meta, 200)
  // A missing script or image must not receive HTML.
  if (FILE.test(url.pathname) && !url.pathname.endsWith('.html'))
    return plain(meta, 404, 'Not Found')
  return shell(request, env, meta, 404)
}
