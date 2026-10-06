# Kinobox search HTTP/2 proxy

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

The JSON schema is forwarded unchanged (`data.items`). Requests have a
15-second deadline, 150-character query limit, 1 MiB response limit and a
10-minute per-location success cache. Browser origins are restricted to
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
HTTP 200, 30 Matrix results, successful CORS and cache hits.
Validation, method, path and Origin checks also passed. Local frontend search
uses the Worker only for movie search; details and player endpoints stay direct.

Deployment bundle SHA256:
`28ceb0688d87f619eb1d5aad0a1f4875a3a9c5f7a0f1afe61f6b734967fcb59b`

Rollback version before this deployment:
`66fc11d3-7c82-4002-b4fc-d9e2da9d7a20`

## Dependencies

Pinned `@reclaimprotocol/tls@0.1.4` and `hpack.js@2.1.6` bundles.
The Reclaim license is included in `LICENSE-reclaim.txt`; dependency license
notices are retained in the generated bundles.
