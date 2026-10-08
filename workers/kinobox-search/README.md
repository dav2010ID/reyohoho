# Kinobox content HTTP/2 and Kinopoisk top proxy

This Worker uses `cloudflare:sockets` for raw TCP, a TLS 1.3 client with
certificate verification and ALPN `h2`, and a bounded HTTP/2/HPACK client.
TLS is performed in JavaScript; `secureTransport: "off"` does not mean that
HTTP is sent unencrypted. The upstream host is fixed to `api.kinobox.tv`.

Kinobox testing showed that HTTP/1.1 connections are closed, while HTTP/2
with a browser User-Agent, `Accept-Encoding: br` and a `kinobox.in` Referer
returns JSON. Workers' `http2.connect()` and TLS `ALPNProtocols` were not
implemented in the tested runtime. Native `fetch()` returned upstream 520.

## Build and deploy

Copy `wrangler.jsonc` to ignored `wrangler.local.jsonc`, then set your account ID
and D1 database ID there. Configure Telegram using
[`worker-telegram.md`](../../docs/worker-telegram.md). Never store credentials in
either configuration file; use Cloudflare Secrets.

```powershell
node prepare-vendor.mjs
npx --yes wrangler@4.147.0 deploy --dry-run --config wrangler.local.jsonc
npx --yes wrangler@4.147.0 login --scopes account:read user:read workers:write workers_scripts:write workers_tail:read
npx --yes wrangler@4.147.0 deploy --config wrangler.local.jsonc
```

Generated vendor modules are ignored by Git. Downloads are pinned by version
and SHA256, and are included at deployment time, not fetched at runtime.
The trust store is scoped to ISRG Root X1/X2. TLS library supplemental roots
are cleared before the first handshake.

Public endpoint after deployment:
`https://api.reyhoho.fun/?query=Матрица`

The custom domain is attached to the configured Worker. DNS and
its TLS certificate are managed by Cloudflare. The frontend uses this custom
domain by default. The previous `workers.dev` endpoint and preview/version URLs
are disabled (`workers_dev: false`, `preview_urls: false`). Old open tabs using
the previous endpoint need to reload to receive the updated frontend.

The frontend uses this Worker by default for search, movie cards/details and
player lists. `VITE_KINOBOX_API_URL` overrides the shared base URL;
`VITE_KINOBOX_SEARCH_API_URL` optionally overrides search only.

Kinobox JSON envelopes are forwarded unchanged. Kinopoisk top responses are
reduced to public movie cards. Allowlisted routes:

| Route | Parameters | Per-location success cache |
| --- | --- | --- |
| `/` or `/api/movies/search/` | `query`, 1–150 characters | 10 minutes |
| `/api/movies/{id}` | Positive numeric movie ID | 1 hour |
| `/api/players` | Positive numeric `kinopoisk`, optional `title` up to 300 characters | 1 minute |
| `/api/kinopoisk/top` | `type=movie` or `series`, positive `page`, `limit=1..50` (default 36), offset below 250 | 1 hour |

## Kinopoisk top

The top route uses native Worker `fetch()` to a fixed Kinopoisk GraphQL endpoint,
with the public website's fixed `MovieDesktopListPage` query. It does not use the
custom Kinobox HTTP/2 client and does not claim a forced upstream ALPN protocol.
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
does not prevent requests made outside browsers. Public catalogue routes have no rate-limit binding. Private auth/account routes
use their configured rate-limit bindings. Monitor CPU usage/error rates before broader rollout.

## Dependencies

Prepared, opt-in D1 user history and legacy-origin transfer:
see `../../docs/cloud-history.md` and `../../docs/worker-telegram.md`.
The tracked configuration is a template: configure D1 and authentication in the
ignored local configuration before deploying. Private routes fail closed without them.
Existing Kinobox transport and public cache routes are unchanged.

Pinned `@reclaimprotocol/tls@0.1.4` and `hpack.js@2.1.6` bundles.
The Reclaim license is included in `LICENSE-reclaim.txt`; dependency license
notices are retained in the generated bundles.
