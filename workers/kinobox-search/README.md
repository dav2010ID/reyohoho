# Kinobox content HTTP/2 proxy

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

The upstream JSON envelopes are forwarded unchanged. Allowlisted routes:

| Route | Parameters | Per-location success cache |
| --- | --- | --- |
| `/` or `/api/movies/search/` | `query`, 1–150 characters | 10 minutes |
| `/api/movies/{id}` | Positive numeric movie ID | 1 hour |
| `/api/players` | Positive numeric `kinopoisk`, optional `title` up to 300 characters | 1 minute |

Other paths are rejected; arbitrary upstream URLs and headers cannot be supplied.
Invalid responses and upstream errors are not cached. Cache keys include the
resource path and validated parameters, not the caller's timestamp.
Requests have a 15-second deadline and 1 MiB response limit. Browser origins are restricted to
GitHub Pages and local development; CORS is **not** authentication and
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
`64feb37d16db51d6f12d60c318456d8e92e10ef13c81cdbd1fdc058bec4190b1`

Deployed version (100%):
`c6804158-4430-49f8-a9a3-b62f2a792840`

Rollback version before this deployment:
`9fdb8d3e-f802-41a5-b074-a994f1078494`

## Dependencies

Pinned `@reclaimprotocol/tls@0.1.4` and `hpack.js@2.1.6` bundles.
The Reclaim license is included in `LICENSE-reclaim.txt`; dependency license
notices are retained in the generated bundles.
