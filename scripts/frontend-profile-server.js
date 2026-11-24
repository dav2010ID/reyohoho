// Local-only profiling fixture. Never forwards a request to an upstream service.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json'
}

export async function createProfileServer({
  root = path.resolve('dist'),
  baselineRoot = null,
  port = 4188,
  delays = {},
  posterBase = null
} = {}) {
  for (const ms of Object.values(delays)) {
    if (!Number.isFinite(ms) || ms < 0 || ms > 5000) {
      throw new RangeError('Profile delays must be between 0 and 5000 ms')
    }
  }
  root = path.resolve(root)
  baselineRoot = baselineRoot ? path.resolve(baselineRoot) : null
  const env = loadEnv('production', process.cwd(), 'VITE_')
  const origins = [
    ...new Set(
      [
        'https://api.reyhoho.fun',
        'https://p2.ddbb.lol',
        'https://a.ddbb.live',
        'http://localhost:8000',
        env.VITE_APP_API_URL,
        env.VITE_WORKER_API_URL
      ].filter(Boolean)
    )
  ]
  const movies = JSON.parse(await fs.readFile('src/data/movies.json', 'utf8'))
  let origin = `http://127.0.0.1:${port}`
  const toMovie = (movie) => ({
    id: Number(movie.kp_id),
    title: { russian: movie.title, original: movie.name_original },
    year: Number(movie.year),
    type: 'movie',
    description: movie.description,
    gallery: { posterUrl: posterBase ? `${posterBase}orig` : `${origin}/__profile/poster.svg` },
    rating: {},
    countries: [],
    genres: [],
    crew: []
  })
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end()
      return
    }
    // Defense in depth: the fixture's pages cannot access any external service.
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob: ${posterBase ? new URL(posterBase).origin : ''}; font-src 'self'; frame-src 'self'; worker-src 'none'`
    )
    res.setHeader('Cache-Control', 'no-store')
    let body
    let type
    try {
      if (url.pathname === '/__profile/setup') {
        if (['before', 'after'].includes(url.searchParams.get('build'))) {
          res.setHeader(
            'Set-Cookie',
            `__profile_build=${url.searchParams.get('build')}; Path=/; SameSite=Strict`
          )
        }
        type = 'text/html'
        body = '<!doctype html><title>Local profile setup</title><p>Local profile setup</p>'
      } else if (url.pathname === '/__profile/poster.svg') {
        type = 'image/svg+xml'
        body =
          '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#262238"/></svg>'
      } else if (url.pathname.startsWith('/__profile/api/')) {
        type = 'application/json'
        const endpoint = url.pathname.slice('/__profile/api'.length)
        if (endpoint === '/api/kinopoisk/top') {
          const start = (Number(url.searchParams.get('page') || 1) - 1) * 36
          const rows = movies.slice(start, start + Number(url.searchParams.get('limit') || 36))
          body = JSON.stringify({
            data: {
              items: rows.map((movie, i) => ({
                movie: toMovie(movie),
                position: start + i + 1
              }))
            }
          })
        } else if (endpoint.startsWith('/api/movies/') && !endpoint.includes('/players')) {
          if (delays.movie) await delay(delays.movie)
          const id = endpoint.split('/').filter(Boolean).at(-1)
          const movie = movies.find((movie) => movie.kp_id === id)
          body = JSON.stringify({ data: { movie: toMovie(movie || movies[1]) } })
        } else if (endpoint.includes('/players')) {
          // Like the real Worker: player lists come from DDBB, not from this API.
          res.statusCode = 410
          body = '{"error":"Players are not served by this API"}'
        } else if (endpoint.includes('/rating/')) {
          body = JSON.stringify({ user_rating: null, average_rating: null, vote_count: 0 })
        } else if (endpoint.includes('/comments/')) {
          body = '[]'
        } else if (endpoint === '/health') {
          body = '{"status":"ok"}'
        } else {
          res.statusCode = 404
          body = '{"error":"No fixture for this endpoint"}'
        }
      } else {
        const useBaseline =
          req.headers['x-profile-build'] === 'before' ||
          /(?:^|;\s*)__profile_build=before(?:;|$)/.test(req.headers.cookie || '')
        const selectedRoot = baselineRoot && useBaseline ? baselineRoot : root
        let filename = path.resolve(selectedRoot, `.${decodeURIComponent(url.pathname)}`)
        if (filename !== selectedRoot && !filename.startsWith(selectedRoot + path.sep)) {
          res.writeHead(403).end()
          return
        }
        try {
          if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html')
        } catch (error) {
          // The production build uses the SPA shell for client-side routes.
          // Keep browser fixtures aligned with that hosting behavior for the
          // movie routes exercised by the profiling checks without turning
          // every unknown extensionless path into a successful shell response.
          if (
            !error ||
            error.code !== 'ENOENT' ||
            path.extname(url.pathname) ||
            !/^\/movie\/\d+(?:\/|$)/.test(url.pathname)
          )
            throw error
          filename = path.join(selectedRoot, 'index.html')
        }
        type = contentTypes[path.extname(filename)] || 'application/octet-stream'
        body = await fs.readFile(filename)
        if (/\/PlayerComponent-[^/]+\.js$/.test(url.pathname) && delays.player) {
          await delay(delays.player)
        }
        if (type === 'text/html' || type === 'text/javascript') {
          body = body.toString()
          for (const upstream of origins)
            body = body.replaceAll(upstream, `${origin}/__profile/api`)
          if (type === 'text/html') {
            body = body.replace(
              '<head>',
              `<head><script>
window.__f5={lcp:null,lcpElement:null,shifts:[],tasks:[],layout:[]};
const rect=node=>{const r=node?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null};
let pending=false;
const snapshot=()=>{pending=false;if(window.__f5.layout.length<80)window.__f5.layout.push({time:performance.now(),skeleton:!!document.querySelector('.movie-skeleton'),player:rect(document.querySelector('.player-container')),details:rect(document.querySelector('#movie-details')),ratings:rect(document.querySelector('.ratings-links'))})};
const layoutObserver=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(snapshot)}});
layoutObserver.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>layoutObserver.disconnect(),10000);
for(const type of ['largest-contentful-paint','layout-shift','longtask']){
  new PerformanceObserver(list=>{for(const e of list.getEntries()){
    if(type==='largest-contentful-paint'){window.__f5.lcp=e.startTime;window.__f5.lcpElement=e.element?.tagName+' '+(e.element?.className||'')}
    else if(type==='layout-shift'&&!e.hadRecentInput)window.__f5.shifts.push({time:e.startTime,value:e.value,sources:(e.sources||[]).map(s=>({node:s.node?.tagName+' '+(s.node?.id||s.node?.className||''),previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))});
    else if(type==='longtask')window.__f5.tasks.push({time:e.startTime,duration:e.duration});
  }}).observe({type,buffered:true});
}
localStorage.clear();sessionStorage.clear();
</script>`
            )
            // Keep layout; replace remote posters with a deterministic local image.
            body = body.replace(
              /(src|data-src)="https?:\/\/[^"]+"/g,
              `$1="${posterBase ? `${posterBase}300x450` : `${origin}/__profile/poster.svg`}"`
            )
            if (posterBase) {
              // Keep SSR and hydration data identical while simulating a known CDN.
              body = body.replace(
                /srcset="[^"]+"/g,
                `srcset="${[100, 200, 300, 600].map((width) => `${posterBase}${width}x${width * 1.5} ${width}w`).join(', ')}"`
              )
            } else {
              body = body.replace(/srcset="[^"]+"/g, `srcset="${origin}/__profile/poster.svg"`)
            }
            body = body.replace(
              // Prerendered state ships as JSON (src/utils/ssgState.js).
              /(<script type="application\/json" id="ssg-state">)(.*?)(<\/script>)/s,
              (_, start, serialized, end) => {
                const state = JSON.parse(JSON.parse(serialized))
                const replacePosters = (value) => {
                  if (!value || typeof value !== 'object') return
                  for (const key of Object.keys(value)) {
                    if (
                      /poster/i.test(key) &&
                      typeof value[key] === 'string' &&
                      /^https?:/.test(value[key])
                    ) {
                      value[key] = posterBase
                        ? `${posterBase}orig`
                        : `${origin}/__profile/poster.svg`
                    } else replacePosters(value[key])
                  }
                }
                replacePosters(state)
                return (
                  start + JSON.stringify(JSON.stringify(state)).replaceAll('<', '\\u003c') + end
                )
              }
            )
            // Avoid external DNS preconnects even though CSP blocks their resources.
            body = body.replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch)"[^>]*>/g, '')
          }
        }
      }
      const bytes = Buffer.from(body)
      res.setHeader('Content-Type', `${type}${type.startsWith('text/') ? '; charset=utf-8' : ''}`)
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        const compressed = gzipSync(bytes)
        res.setHeader('Content-Encoding', 'gzip')
        res.setHeader('Content-Length', compressed.length)
        res.end(compressed)
      } else {
        res.setHeader('Content-Length', bytes.length)
        res.end(bytes)
      }
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Local fixture unavailable')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  createProfileServer({
    root: process.argv[2] || 'dist',
    port: Number(process.argv[3] || 4188),
    baselineRoot: process.argv[4],
    delays: {
      player: Number(process.env.PROFILE_PLAYER_DELAY_MS || 0),
      movie: Number(process.env.PROFILE_MOVIE_DELAY_MS || 0)
    }
  })
    .then(() => {
      console.log('Local profile fixture: http://127.0.0.1:' + (process.argv[3] || 4188))
    })
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
