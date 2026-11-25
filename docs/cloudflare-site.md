# Workers Static Assets for reyhoho.fun

Production still serves GitHub Pages. `workers/site` is the planned replacement;
switching DNS is a separate, explicit step.

## Build

Build with `VITE_PRERENDER_MOVIE_PAGES=true yarn build:github`. Postbuild writes:

- `dist/_headers`: security headers for every static response, followed by the
  cache rules from `public/_headers`;
- `workers/site/generated/site-meta.json` (not committed): the same headers and
  the canonical path of every prerendered movie, `{ "301": "/movie/301/<slug>/" }`;
- `dist/.assetsignore`: keeps the GitHub Pages files `404.html` and `CNAME` out of
  the Worker's assets.

`_headers` also marks the Worker's `workers.dev` address `noindex`.

The site Worker bundles that file, so deploy it from the same build as `dist`.

## Routing

Assets are served first (`html_handling: auto-trailing-slash`, so
`/movie/301/<slug>/` is canonical and the form without a slash gets a 307). Links
in the app use the canonical form (`getMovieSeoPath`), so they never redirect.
Only a miss reaches the Worker (`not_found_handling: none`):

| Path | Answer |
| --- | --- |
| `/movie/<catalogued id>` with no slug or an old slug | 301 to the canonical page, query kept |
| `/movie/<other valid id>[/<slug>]` | 200 app shell, `X-Robots-Tag: noindex` |
| `/lists`, `/lists/<id>` | 200 app shell, noindex (client-only pages) |
| a missing file (`.js`, `.png`, …) | 404 plain text, never HTML |
| anything else, including `/shiki/*` | 404 with the app shell, so the app shows its NotFound page |

`_headers` does not apply to responses the Worker builds, so the Worker adds the
same headers from `site-meta.json`.

## Security headers

`scripts/site-security.js` defines them: HSTS (one year, no subdomains),
`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and
`Content-Security-Policy-Report-Only`.

The CSP allows only hashed inline scripts. Postbuild hashes every executable
inline script in `dist` and fails above 8 distinct ones. Prerendered state ships
as `<script type="application/json" id="ssg-state">` (`src/utils/ssgState.js`),
so pages do not need their own hashes. Reports go to
`https://<api>/api/csp-report`; the Worker logs a `csp_report` line with the
directive, the blocked origin and the page path, never the query.

Enforce only after reviewing the reports: rename the header to
`Content-Security-Policy` in `securityHeaders()`. Every page view that violates
the policy sends a report, so it counts against the API Worker's requests.

Until the move, the same headers can be added as Cloudflare Transform Rules on
the proxied `reyhoho.fun` zone. Copy them from a fresh `dist/_headers`. The CSP
hashes change whenever an inline script in `index.html` changes.

## Contract check

`scripts/check-site.mjs` checks a live origin: the home page and a prerendered
movie with security headers, the 301 from an old or missing slug (query kept),
the slash redirect, 200 noindex for an uncatalogued movie, a real 404 (also for a
browser navigation), a non-HTML 404 for a missing chunk, `sw.js` no-cache,
immutable assets, and that `_headers` is not served. `--www` also checks the
`www` redirect.

```powershell
yarn build:github                        # with VITE_PRERENDER_MOVIE_PAGES=true
npx wrangler dev --config workers/site/wrangler.jsonc --port 8787
node scripts/check-site.mjs http://127.0.0.1:8787
```

## Deploy-GH targets

The repository variable `SITE_TARGET` selects where Deploy-GH publishes the
verified artifact. GitHub Pages is always deployed, so it stays a warm rollback.

| `SITE_TARGET` | GitHub Pages | site Worker | Checked with `check-site.mjs` |
| --- | --- | --- | --- |
| unset | production | not deployed | — |
| `preview` | production | `reyohoho-site.<subdomain>.workers.dev` | the workers.dev URL |
| `cloudflare` | rollback copy | `reyhoho.fun` (`--domain reyhoho.fun`) | `https://reyhoho.fun --www` |

The Worker job needs the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Create the token from the **Edit Cloudflare Workers**
template, limited to this account and the `reyhoho.fun` zone.

## Switch plan

### 1. Preview

1. Add the two secrets and set `SITE_TARGET=preview`. Run Deploy-GH
   (workflow_dispatch). The `deploy-worker` job deploys and checks the workers.dev
   URL.
2. On the workers.dev URL, check prerendered movies, `/top`, a service-worker
   update and offline navigation. The API allows only the reyhoho.fun origins, so
   search, cards and players fail there by design: they are checked after the
   switch.

### 2. Switch

Production change: do it with the owner present. It takes a few minutes.

1. Export the zone's DNS records (DNS → Records → Export), for the rollback.
2. Add a redirect rule: Rules → Redirect Rules → template **Redirect from WWW to
   root**, 301, keep the query string. It works with either origin, so do it
   first. Check: `curl -I https://www.reyhoho.fun/top` gives a 301 to
   `https://reyhoho.fun/top`.
3. Attach the domain from the last verified artifact, in a checkout of the same
   commit (`dist/build-sha.txt`):

   ```powershell
   gh run download <Deploy-GH run id> -n production-files
   npx wrangler deploy --config workers/site/wrangler.jsonc --domain reyhoho.fun
   ```

   The A and AAAA records of `reyhoho.fun` still point to GitHub Pages. If
   Wrangler does not offer to replace them, delete those two records and run the
   command again; the site is down between the two steps.
4. `node scripts/check-site.mjs https://reyhoho.fun --www`, then in a browser:
   search, a movie with players, Telegram login (the domain is unchanged, so the
   bot needs no change), the service-worker update.
5. Set `SITE_TARGET=cloudflare`. From now on every Deploy-GH run deploys the
   Worker to reyhoho.fun and checks it.

After the switch HSTS (one year, no subdomains) and the other headers are sent
for real. CSP stays Report-Only until the reports are reviewed (see above).

### Rollback

- A bad site version: `npx wrangler rollback --config workers/site/wrangler.jsonc`
  (instant; the artifact stays on GitHub Pages too).
- Back to GitHub Pages: remove the `reyhoho.fun` custom domain from the
  `reyohoho-site` Worker, restore the exported A/AAAA records (proxied), set
  `SITE_TARGET=preview`. GitHub Pages kept receiving every release.

### After a week without rollback

In a separate change: drop the GitHub Pages job, `public/404.html`, `CNAME` and
`.assetsignore`, the immutable-asset cache rule (`scripts/cloudflare-static-cache.mjs`
targets the old proxied origin), and `https://dav2010id.github.io` from the API
Worker's allowed origins; disable Pages in the repository settings.

Static assets are free and unmetered. Only misses invoke the Worker (uncatalogued
movies, `/lists`, 404s), so the free plan's daily request limit stays far away.

Release order for the API stays: D1 migration → API Worker → site.
