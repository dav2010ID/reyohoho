// GET /api/health: what this Worker serves, so a site release can check that
// the D1 migration and the Worker went out first (see release.json).
import release from '../../release.json'

const SCHEMA_TTL_MS = 60_000
let schema = null

async function appliedMigration(env, now) {
  if (schema && now - schema.at < SCHEMA_TTL_MS) return schema.name
  let name = null
  try {
    // Wrangler records applied migrations in d1_migrations.
    const row = await env.HISTORY_DB?.prepare(
      'SELECT name FROM d1_migrations ORDER BY name DESC LIMIT 1'
    )
      .bind()
      .first()
    name = row?.name || null
  } catch {
    name = null
  }
  schema = { at: now, name }
  return name
}

export const resetHealthCache = () => {
  schema = null
}

export async function serveHealth(env, headers, version, now = Date.now()) {
  const d1Migration = await appliedMigration(env, now)
  return new Response(
    JSON.stringify({
      worker: version,
      apiContract: release.apiContract,
      d1Migration,
      // The Worker was deployed before its migration: account routes may fail.
      schemaReady: Boolean(d1Migration) && d1Migration >= release.d1Migration
    }),
    { status: 200, headers }
  )
}
