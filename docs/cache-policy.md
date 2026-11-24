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
- PWA installation precaches the entry shell and static dependencies of search,
  top movies, movie details, player, ratings and the not-found screen. The client
  build graph is retained for the final service worker generated after SSG, so
  the cached HTML revision matches the prerendered output. Fonts and essential
  icons are included; optional routes, comments and player dialogs are excluded.
- Optional hashed assets are cached on first use in `immutable-assets-v1`:
  same-origin successful responses only, at most 160 entries for 30 days. Those
  screens and controls become available offline after an online visit. Comments
  load near the viewport or on request; the player chooser loads when opened.
  Service worker caching does not include API responses or account data.
- Worker: movie cards 6h, search 10m, top 1h. Only validated JSON is
  stored. Last successful movie cards can be served for up to 48h after fetch
  when upstream returns 429/5xx or a connection/timeout error. Stale storage
  is best-effort/local to a Cloudflare data center and can be evicted earlier.
- Temporary failures set a 30s retry marker, not a cached successful response.
  Same-isolate requests wait for the first request/cache write, using primitive
  leases with an expiry, not shared request-scoped I/O promises. This is not
  a global/distributed lock.
- Browser public-data memory cache: search 1m, cards/top 5m;
  capped at 120 entries and approximately 4 MiB serialized UTF-16 payloads.
  Shared pending requests also bounded. AbortSignal-owned transports remain
  separate to preserve independent cancellation. SSR/custom requests bypass it.
- Auth, history and lists always use `private, no-store`, and never enter these
  caches. CORS preflight permission lasts 600s, not the private response body.
- Logs: `event=public_cache`, `kind=search|movie|top`,
  `cache=HIT|MISS|STALE|BACKOFF`, `status`, `durationMs`. No queries, tokens,
  movie IDs or personal data. Measure ratios by kind after a full traffic day;
  zone-level CDN HIT does not measure Workers Cache API hit rate.
