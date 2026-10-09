# Public cache policy

- Only Vite-generated content-hashed files go into `/assets/immutable/`. Do not
  copy unhashed files into this directory. HTML, `sw.js`, manifests and public
  files retain their existing short TTLs. Posters still load from their providers.
- Run `node scripts/cloudflare-static-cache.mjs` to inspect the two rules.
  To apply, set `CLOUDFLARE_ZONE_ID` and a zone-scoped `CLOUDFLARE_API_TOKEN`
  (Rulesets/Cache Rules/Transform Rules edit) in your local environment, then
  run with `--apply`. Never commit the token. Unrelated rules are preserved.
- Successful hashed assets: edge 30 days, browser 1 year (`immutable`). Errors
  do not get that TTL. Frontend must be deployed before testing these paths.
- Worker: movie cards 6h, search 10m, top 1h, players 1m. Only validated JSON is
  stored. Last successful movie cards can be served for up to 48h after fetch
  when upstream returns 429/5xx or a connection/timeout error. Stale storage
  is best-effort/local to a Cloudflare data center and can be evicted earlier.
- Temporary failures set a 30s retry marker, not a cached successful response.
  Same-isolate requests wait for the first request/cache write, using primitive
  leases with an expiry, not shared request-scoped I/O promises. This is not
  a global/distributed lock.
- Browser public-data memory cache: search 1m, cards/top 5m, players 30s;
  capped at 120 entries and approximately 4 MiB serialized UTF-16 payloads.
  Shared pending requests also bounded. AbortSignal-owned transports remain
  separate to preserve independent cancellation. SSR/custom requests bypass it.
- Auth, history and lists always use `private, no-store`, and never enter these
  caches. CORS preflight permission lasts 600s, not the private response body.
- Logs: `event=public_cache`, `kind=search|movie|players|top`,
  `cache=HIT|MISS|STALE|BACKOFF`, `status`, `durationMs`. No queries, tokens,
  movie IDs or personal data. Measure ratios by kind after a full traffic day;
  zone-level CDN HIT does not measure Workers Cache API hit rate.
