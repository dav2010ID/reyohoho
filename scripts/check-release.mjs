// Release order: D1 migration → API Worker → site (release.json).
//   node scripts/check-release.mjs              static: release.json matches the repo
//   node scripts/check-release.mjs --live URL   before a site release: the live Worker is ready
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const MIGRATIONS = path.join(ROOT, 'workers', 'api', 'migrations')

export const readRelease = async (root = ROOT) =>
  JSON.parse(await fs.readFile(path.join(root, 'release.json'), 'utf8'))

export async function checkStatic(release, migrationsDir = MIGRATIONS) {
  const errors = []
  const files = (await fs.readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name))
  const newest = files.sort().at(-1)
  if (release.d1Migration !== newest)
    errors.push(`release.json d1Migration is ${release.d1Migration}, newest migration is ${newest}`)
  if (!Number.isInteger(release.apiContract) || release.apiContract < 1)
    errors.push('release.json apiContract must be a positive integer')
  return errors
}

export function checkLive(health, release) {
  const errors = []
  if (!health || typeof health !== 'object') return ['the Worker has no /api/health']
  if (!(health.apiContract >= release.apiContract))
    errors.push(
      `the Worker serves API contract ${health.apiContract ?? 'none'}, the site needs ${release.apiContract}: deploy the API Worker first`
    )
  if (!(String(health.d1Migration || '') >= release.d1Migration))
    errors.push(
      `D1 is at ${health.d1Migration ?? 'no migrations'}, the release needs ${release.d1Migration}: apply the migration first`
    )
  // A newer Worker can be ahead of its own migration even when this site's
  // minimums are met.
  if (health.schemaReady === false)
    errors.push('the Worker reports schemaReady: false: apply its D1 migrations first')
  return errors
}

async function fetchHealth(origin) {
  // Keep a path prefix (a proxy in front of the Worker), as the site does.
  const base = String(origin).replace(/\/+$/, '') + '/'
  const response = await fetch(new URL('api/health', base), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) return null
  return response.json().catch(() => null)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const release = await readRelease()
  const live = process.argv.indexOf('--live')
  const errors =
    live === -1
      ? await checkStatic(release)
      : checkLive(await fetchHealth(process.argv[live + 1]), release)
  if (errors.length) {
    for (const error of errors) console.error(`release check: ${error}`)
    console.error('Release order: D1 migration → API Worker → site.')
    process.exitCode = 1
  } else {
    console.log(`release check passed (contract ${release.apiContract}, ${release.d1Migration})`)
  }
}
