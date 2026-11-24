# ReYohoho API Worker

One Worker serves the public catalogue, Telegram login, the account, lists and
cloud history (D1 `HISTORY_DB`) at `https://api.reyhoho.fun`.

## Data sources

Search (`/api/movies/search/`, also `/?query=`) and movie cards
(`/api/movies/{id}`) are loaded from Kinopoisk GraphQL with native `fetch()`
(`kinopoisk-content.mjs`), reduced to public card data in the
`{ data: { items } }` / `{ data: { movie } }` shape the site reads, and cached by
`content.mjs`. Kinopoisk accepts only its known documents, so
`kinopoisk-content-queries.mjs` holds exact copies of `backend/graphql/*.graphql`;
a test fails if they diverge. Ratings and crew are optional sub-requests. The
`X-Data-Source` response header names the source used.

The Worker serves no player lists: the site gets them from DDBB Live and DDBB.
`/api/players` answers `410 Gone` at once, so sites released before Kinobox was
removed stop waiting for it.

## Build and deploy

Copy `wrangler.jsonc` to ignored `wrangler.local.jsonc`, then set your account ID
and D1 database ID there. Configure Telegram using
[`worker-telegram.md`](../../docs/worker-telegram.md). Never store credentials in
either configuration file; use Cloudflare Secrets.

```powershell
npx --yes wrangler@4.147.0 deploy --dry-run --config wrangler.local.jsonc
npx --yes wrangler@4.147.0 login --scopes account:read user:read workers:write workers_scripts:write workers_tail:read
npx --yes wrangler@4.147.0 deploy --config wrangler.local.jsonc
```

Public endpoint after deployment:
`https://api.reyhoho.fun/?query=Матрица`

The custom domain is attached to the configured Worker. DNS and
its TLS certificate are managed by Cloudflare. The frontend uses this custom
domain by default. The previous `workers.dev` endpoint and preview/version URLs
are disabled (`workers_dev: false`, `preview_urls: false`). Old open tabs using
the previous endpoint need to reload to receive the updated frontend.

The frontend uses this Worker for search, movie cards, top lists, account and
history; `VITE_WORKER_API_URL` points a build at another Worker (staging).

Kinopoisk responses are reduced to public movie cards. Allowlisted routes:

| Route                        | Parameters                                                                              | Per-location success cache |
| ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `/` or `/api/movies/search/` | `query`, 1–150 characters                                                               | 10 minutes                 |
| `/api/movies/{id}`           | Positive numeric movie ID                                                               | 6 hours                    |
| `/api/players`               | Retired: always `410 Gone`                                                              | —                          |
| `/api/kinopoisk/top`         | `type=movie` or `series`, positive `page`, `limit=1..50` (default 36), offset below 250 | 1 hour                     |
| `/api/movies/{id}/extras`    | Positive numeric movie ID                                                               | 24 hours                   |
| `/api/kinoapi/latest`        | `limit=1..50` (default 24)                                                              | 1 hour                     |

## Movie extras (Kino API)

`/api/movies/{id}/extras` adds optional card data from `kinoapi.lampac.dev`
(`kinoapi.mjs`): IMDb/TMDB IDs, tagline, logo, TMDB/Rotten Tomatoes/Metacritic
ratings, YouTube trailer IDs and similar titles. The catalogue has no player
links. The response is the Worker's own reduced shape; only validated fields are
forwarded, logos only from the Yandex image host.

The API key is the Worker secret `KinoapiLampac` and never reaches the browser:

```powershell
npx --yes wrangler@4.147.0 secret put KinoapiLampac --config wrangler.local.jsonc
```

Without the secret the route answers 503 (`X-Extras-Cache: DISABLED`) and makes
no upstream call. The key is one shared budget for the whole site, so complete
answers are cached for 24 hours with a 7-day stale copy, a title missing from the
catalogue for 1 hour, and an answer without similar titles for 10 minutes. HTTP
429 pauses all upstream calls for 60 seconds, a rejected key (401/403) for 5
minutes. The frontend loads extras after the card and hides them on any failure.

`/api/kinoapi/latest` serves the home shelf "Последние релизы" from the catalogue's
`/titles` (this and last year, by popularity, 100 titles; only titles already out and with a
Kinopoisk ID, newest release first; the catalogue's `/titles/latest` leads with far-future
placeholders without Kinopoisk IDs) with the same key, cache and backoff rules (fresh copy 1 hour,
stale copy 7 days). Only titles with a Kinopoisk ID are forwarded, with a 342px
TMDB poster; the shelf is hidden when the route fails.

## Kinopoisk top

The top route uses native Worker `fetch()` to a fixed Kinopoisk GraphQL endpoint,
with the public website's fixed `MovieDesktopListPage` query.
Callers cannot supply a query, upstream host, headers or cookies. User data is
disabled (`withUserData: false`); redirects are rejected.

Films use `top250`; series use `series-top250`. These are rating-ranked lists,
not daily/weekly popularity or discussion rankings. The frontend labels them
“Топ-250 Кинопоиска” and offers separate film/series tabs. Local backend mode
retains its existing popularity filters and does not silently substitute this top.

The GraphQL interface is the website's internal API, not an officially supported
public API or availability guarantee. Its schema or allowed query may change.
Failures return 502 (504 for timeout), are not cached, and are not replaced with
fabricated rankings. Poster image URLs remain direct Yandex URLs, not proxy routes.

Other paths are rejected; arbitrary upstream URLs and headers cannot be supplied.
Invalid responses and upstream errors are not cached. Cache keys include the
resource path and validated parameters, not the caller's timestamp.
Requests have a 15-second deadline and 1 MiB response limit. Browser origins are restricted to
`reyhoho.fun` and `www.reyhoho.fun` (HTTPS and transitional HTTP), the old
GitHub Pages origin, and local development; CORS is **not** authentication and
does not prevent requests made outside browsers. Public catalogue routes use
`PUBLIC_RATE_LIMITER` (120 actual upstream attempts per IP per 60 seconds in the
template); cache hits and collapsed followers do not consume this budget. The
limiter is required and fails closed when unavailable. Private auth/account
routes use their configured rate-limit bindings. Monitor CPU usage/error rates
before broader rollout.

## Dependencies

Prepared, opt-in D1 user history and legacy-origin transfer:
see `../../docs/cloud-history.md` and `../../docs/worker-telegram.md`.
The tracked configuration is a template: configure D1 and authentication in the
ignored local configuration before deploying. Private routes fail closed without them.

## Upstream protection

`upstream-guard.mjs` wraps the Kinopoisk requests:

- **Circuit breaker:** after 5 failures (timeouts, 5xx, 429) an upstream is
  skipped for 30 s in that isolate. Missing titles do not count.
- **Shared budget:** the optional `UPSTREAM_RATE_LIMITER` binding (key
  `upstream:<name>`) caps calls per upstream across all IPs, on top of the
  per-IP `PUBLIC_RATE_LIMITER`. If the binding fails, requests are allowed.

`GET /api/health` reports the API contract and the applied D1 migration (see
`docs/release.md`).
