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

```powershell
node prepare-vendor.mjs
npx --yes wrangler@4.147.0 deploy --dry-run --config wrangler.jsonc
npx --yes wrangler@4.147.0 login --scopes account:read user:read workers:write workers_scripts:write workers_tail:read
npx --yes wrangler@4.147.0 deploy --config wrangler.jsonc
```

Generated vendor modules are ignored by Git. Downloads are pinned by version
and SHA256, and are included at deployment time, not fetched at runtime.
The trust store is scoped to ISRG Root X1/X2. TLS library supplemental roots
are cleared before the first handshake.

Public endpoint after deployment:
`https://lively-cloud-4e31.reyohoho-search.workers.dev/?query=Матрица`

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
does not prevent requests made outside browsers. No rate-limit binding is
configured. Monitor CPU usage/error rates before broader rollout.

## Verification status

The permanent Worker was deployed through the Cloudflare API on October 6,
2026. The exact Wrangler bundle was uploaded into a temporary, SHA256-checked
KV staging namespace, read through the authorized API and deployed as one
module. The temporary uploader and namespace are removed after verification;
the production Worker has no KV binding or staging dependency.

Node.js and a clean Edge browser on the production GitHub Pages origin returned
HTTP 200 for search, movie details and player lists on the production GitHub
Pages origin: 30 Matrix results and 7 player sources. A clean local Edge browser
opened the Matrix card and displayed its title, description and ratings 8.5/8.7
without direct Kinobox API requests. Embedded player playback is not covered by
this API verification.

Deployment bundle SHA256:
`b074cd4505ecd91d65f46bcbab6097b17d4770c2886cf4b09074c303a781d39a`

Deployed version (100%):
`c3b69a24-6c6b-4ced-ae56-8d4dec879ce6`

Rollback version before this deployment:
`ffb2d1bd-3515-4da1-8280-618a101a7625`

On October 8, 2026, the custom-domain CORS update was deployed through the API.
The prior bundle hash was checked before replacement, and the updated module
was verified byte-for-byte against the local Wrangler dry-run bundle. All
existing bindings/settings were retained; no temporary resources were needed.
Preflight requests from both custom-domain hostnames, old GitHub Pages and
localhost passed. Search, movie 301, players and top returned HTTP 200 with
`Access-Control-Allow-Origin: https://reyhoho.fun`; unrelated origins stayed 403.

The top deployment was verified on October 6, 2026: all seven pages returned
250 unique film IDs and 250 unique series IDs, repeated requests reported cache
HIT, and invalid parameters/origins/methods were rejected. A clean local Edge
browser using the actual production Worker displayed 36 cards, loaded page two
(72 cards), and switched to series without JavaScript errors. Search, details
and player endpoints remained HTTP 200 with the Kinobox HTTP/2 transport.
This verifies the new frontend locally; publishing it to GitHub Pages is separate.

## Dependencies

Pinned `@reclaimprotocol/tls@0.1.4` and `hpack.js@2.1.6` bundles.
The Reclaim license is included in `LICENSE-reclaim.txt`; dependency license
notices are retained in the generated bundles.
