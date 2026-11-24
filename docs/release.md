# Release order

The site, the API Worker (`workers/kinobox-search`) and its D1 schema are
released separately, always in this order: **D1 migration → API Worker → site**.
The new Worker runs for a while with the site that is still live, so every
Worker change must keep the previous site working (see "Compatibility" below).

## Before the release

1. Integrate the current `origin/main` (the weekly SEO bot commits there) and
   run the full gate:

   ```sh
   yarn install --frozen-lockfile
   yarn lint && yarn check:encoding && yarn check:release
   yarn test:unit --run
   VITE_PRERENDER_MOVIE_PAGES=true VITE_WORKER_AUTH_ENABLED=true yarn build:github
   node scripts/check-seo-pages.js dist
   node scripts/browser-artifact-check.js dist
   ```

2. Reconcile `workers/kinobox-search/wrangler.local.jsonc` (ignored by Git: it
   holds the real account and D1 IDs) with the tracked `wrangler.jsonc`. Every
   binding in the template must exist locally, with the production values:
   - `account_id`, `HISTORY_DB` `database_id`;
   - `vars`: `TELEGRAM_AUTH_ENABLED: "true"`, `TELEGRAM_BOT_USERNAME`
     (the template ships them disabled);
   - `ratelimits`: `PUBLIC_RATE_LIMITER`, `UPSTREAM_RATE_LIMITER`,
     `LOGIN_RATE_LIMITER`, `AUTH_RATE_LIMITER`, `ACCOUNT_RATE_LIMITER`;
   - no `ALLOW_DEV_ORIGINS` in production.

   Check with `npx wrangler deploy --dry-run --config workers/kinobox-search/wrangler.local.jsonc`:
   the binding list must include all five rate limiters.
3. Secrets must already be set on the production Worker (`npx wrangler secret list
   --config workers/kinobox-search/wrangler.local.jsonc`): `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, `KinoapiLampac`.
4. Verify the vendored TLS modules: `node workers/kinobox-search/prepare-vendor.mjs`.
5. Optional but recommended: rehearse on staging (below).

## Release

1. **Backup point.** Note the current D1 bookmark so the database can be
   restored with Time Travel:
   `npx wrangler d1 time-travel info HISTORY_DB --config workers/kinobox-search/wrangler.local.jsonc`.
2. **D1 migration.**
   `npx wrangler d1 migrations list HISTORY_DB --remote --config workers/kinobox-search/wrangler.local.jsonc`
   shows what is pending, then
   `npx wrangler d1 migrations apply HISTORY_DB --remote --config workers/kinobox-search/wrangler.local.jsonc`.
   `0004_active_history_quota.sql` rebuilds the quota triggers and recounts
   active history rows (writes wait during the recount); `0005_login_context.sql`
   adds two nullable columns. Both rely on Wrangler's migration ledger: never
   run them by hand a second time.
3. **API Worker.** `npx wrangler deploy --config workers/kinobox-search/wrangler.local.jsonc`, then
   `node scripts/check-release.mjs --live https://api.reyhoho.fun`. It must
   pass with `schemaReady: true`. Check a Telegram login and the history page on
   the site that is still live.
4. **Site.** Merge to `main`; the Deploy-GH workflow builds, re-runs the checks
   and publishes to GitHub Pages. If `main` is already merged, run Deploy-GH
   manually. Check `https://reyhoho.fun/build-sha.txt` equals the released
   `main` commit.

Rollback: redeploy the previous Worker version (`npx wrangler rollback`) — the
migrations are additive and the old Worker works with them. Restore D1 with Time
Travel only for data damage, not for a code problem.

## release.json

`release.json` records what the current code needs:

| Field | Meaning |
| --- | --- |
| `d1Migration` | newest file in `workers/kinobox-search/migrations` |
| `apiContract` | API version the site relies on |

Bump `apiContract` whenever the site starts depending on new Worker behaviour,
and update `d1Migration` with every new migration (`yarn check:release` fails
otherwise). Contract 2: typed capacity errors, exclusive viewing statuses,
partial imports with `partial: true` / `rejected`, the history alias returning
an array, the login context and the CSP report endpoint. Contract 1 is
everything before `/api/health` existed.

`GET /api/health` on the Worker returns `{ worker, apiContract, d1Migration,
schemaReady }`. `d1Migration` comes from Wrangler's `d1_migrations` table; a
successful read is cached for a minute. The site deploy runs
`node scripts/check-release.mjs --live <api origin>` with the same Worker URL the
build uses, before it uploads the artifact, and stops if the live Worker serves
an older contract, D1 is behind or `schemaReady` is false.

## Compatibility with the site that is still live

- Imports without `partial: true` keep the old all-or-nothing behaviour: an
  over-capacity batch writes nothing and returns 409. Only the new site asks
  for partial imports and reads `rejected`.
- A deleted history row keeps its deletion time; replays older than the
  deletion are ignored. Tombstones from before this change have no time and
  behave as before.
- The production Worker no longer accepts `http://localhost:5173`. Local
  development uses the staging Worker (`ALLOW_DEV_ORIGINS=true`) through
  `VITE_WORKER_API_URL`.

## Staging

`wrangler.jsonc` has `env.staging` (Worker `reyohoho-api-staging`) with its own
D1, bot and rate-limit counters and `ALLOW_DEV_ORIGINS=true`. Before first use:
create the D1 database (`npx wrangler d1 create reyohoho-history-staging`), put
its ID in place of `<YOUR_STAGING_D1_DATABASE_ID>` in your local config, set the
staging bot and its secrets with `--env staging`. Then run the steps above with
`--env staging` (the migration command keeps the binding name `HISTORY_DB`) and
build the site with `VITE_WORKER_API_URL=<staging origin>`; check it with
`yarn preview` or a `workers/site` preview, not on GitHub Pages.

## Emergency site release

If the weekly SEO refresh has failed for more than 14 days, run the Deploy-GH
workflow manually with `allow_stale_seo`. It ships the last verified SEO
snapshot; the release check above still applies. The weekly job commits the
refreshed SEO files before the live check, so `main` can be one SEO commit ahead
of the published site when the Worker is not ready.
