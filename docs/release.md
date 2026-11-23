# Release order

The site, the API Worker (`workers/kinobox-search`) and its D1 schema are
released separately, always in this order:

1. **D1 migration**: `npx wrangler d1 migrations apply reyohoho-history --remote --config workers/kinobox-search/wrangler.local.jsonc`
2. **API Worker**: `npx wrangler deploy --config workers/kinobox-search/wrangler.local.jsonc`
3. **Site**: push to `main` (GitHub Pages) or deploy `workers/site`.

`release.json` records what the current code needs:

| Field | Meaning |
| --- | --- |
| `d1Migration` | newest file in `workers/kinobox-search/migrations` |
| `apiContract` | API version the site relies on |

Bump `apiContract` whenever the site starts depending on new Worker behaviour,
and update `d1Migration` with every new migration (`yarn check:release` fails
otherwise). Contract 2 is this branch: the typed capacity errors, exclusive
viewing statuses, history import with `rejected`, the history alias returning an
array, the login context and the CSP report endpoint. Contract 1 is everything
before `/api/health` existed.

`GET /api/health` on the Worker returns `{ worker, apiContract, d1Migration,
schemaReady }`. `d1Migration` comes from Wrangler's `d1_migrations` table and is
cached for a minute. The site deploy runs
`node scripts/check-release.mjs --live <api origin>` before it uploads the
artifact. The deploy stops if the live Worker serves an older contract or D1 is
behind. That makes the order above mandatory: the first site deploy after this
change waits for the Worker.

## Staging

`wrangler.jsonc` has `env.staging`, with its own D1, bot and rate-limit counters
and `ALLOW_DEV_ORIGINS=true`. Run the same three steps with `--env staging`
first. Build the site with `VITE_WORKER_API_URL=<staging origin>` to point it there.

## Emergency site release

If the weekly SEO refresh has failed for more than 14 days, run the Deploy-GH
workflow manually with `allow_stale_seo`. It ships the last verified SEO
snapshot; the release check above still applies.
