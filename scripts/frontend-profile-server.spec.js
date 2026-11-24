// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createProfileServer } from './frontend-profile-server.js'

let server
let root
afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (root) {
    const resolvedRoot = path.resolve(root)
    if (path.dirname(resolvedRoot) !== path.resolve(os.tmpdir()) ||
        !path.basename(resolvedRoot).startsWith('reyohoho-profile-')) {
      throw new Error('Refusing to remove a directory outside the profile fixture')
    }
    await fs.rm(resolvedRoot, { recursive: true, force: true })
  }
  server = null
  root = null
})

async function setup(options = {}) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'reyohoho-profile-'))
  await fs.writeFile(path.join(root, 'index.html'),
    '<head><link rel="preconnect" href="https://fonts.googleapis.com"></head><img src="https://poster.test/a.jpg">')
  await fs.writeFile(path.join(root, 'app.js'), 'const api="https://api.reyhoho.fun"')
  server = await createProfileServer({ root, port: 0, ...options })
  return `http://127.0.0.1:${server.address().port}`
}

describe('isolated frontend profiling fixture', () => {
  it('blocks external connections and replaces API URLs and posters locally', async () => {
    const origin = await setup()
    const html = await fetch(origin)
    expect(html.headers.get('content-security-policy')).toContain("connect-src 'self'")
    expect(html.headers.get('content-security-policy')).toContain("worker-src 'none'")
    const body = await html.text()
    expect(body).not.toContain('preconnect')
    expect(body).not.toContain('https://poster.test')
    expect(body).toContain(`${origin}/__profile/poster.svg`)
    expect(await (await fetch(`${origin}/app.js`)).text()).toContain(`${origin}/__profile/api`)
  })

  it('serves deterministic data without forwarding missing routes', async () => {
    const origin = await setup()
    const movie = await (await fetch(`${origin}/__profile/api/api/movies/5494049`)).json()
    expect(movie.data.movie.id).toBe(5494049)
    expect(movie.data.movie.gallery.posterUrl).toBe(`${origin}/__profile/poster.svg`)
    expect((await fetch(`${origin}/__profile/api/unknown`)).status).toBe(404)
    expect((await fetch(`${origin}/movie/not-prerendered`)).status).toBe(404)
    expect((await fetch(`${origin}/`, { method: 'POST' })).status).toBe(405)
  })

  it('answers the retired player list route like the Worker', async () => {
    const origin = await setup()
    const response = await fetch(`${origin}/__profile/api/api/players?kinopoisk=5494049`)
    expect(response.status).toBe(410)
  })

  it('delays selected chunks while keeping unrelated assets available', async () => {
    const origin = await setup({ delays: { player: 100 } })
    await fs.writeFile(path.join(root, 'PlayerComponent-test.js'), 'export default {}')
    const startedAt = Date.now()
    expect((await fetch(`${origin}/PlayerComponent-test.js`)).status).toBe(200)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(90)
    expect((await fetch(`${origin}/app.js`)).status).toBe(200)
  })

  it('rejects unbounded profiling delays', async () => {
    await expect(setup({ delays: { movie: 5001 } })).rejects.toThrow('between 0 and 5000')
  })

  it('rejects encoded traversal outside the selected build directory', async () => {
    const origin = await setup()
    expect((await fetch(`${origin}/..%2foutside`)).status).toBe(403)
  })

  it('selects a baseline build on the same origin without falling back to another build', async () => {
    const origin = await setup({ baselineRoot: path.resolve('scripts') })
    const response = await fetch(`${origin}/app.js`, { headers: { 'x-profile-build': 'before' } })
    expect(response.status).toBe(404)
    expect((await fetch(`${origin}/app.js`)).status).toBe(200)
    const setupResponse = await fetch(`${origin}/__profile/setup?build=before`)
    const cookie = setupResponse.headers.get('set-cookie').split(';')[0]
    expect((await fetch(`${origin}/app.js`, { headers: { cookie } })).status).toBe(404)
  })
})
