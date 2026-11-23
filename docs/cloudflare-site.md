# Workers Static Assets for reyhoho.fun

Production still serves GitHub Pages. `workers/site` is the planned replacement;
switching DNS is a separate, explicit step.

## Build

Build with `VITE_PRERENDER_MOVIE_PAGES=true yarn build:github`. Postbuild writes:

- `dist/_headers`: security headers for every static response, followed by the
  cache rules from `public/_headers`;
- `workers/site/generated/site-meta.json` (not committed): the same headers and
  the canonical path of every prerendered movie, `{ "301": "/movie/301/<slug>/" }`.

The site Worker bundles that file, so deploy it from the same build as `dist`.

## Routing

Assets are served first (`html_handling: auto-trailing-slash`, so
`/movie/301/<slug>/` is canonical and the form without a slash redirects).
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

## Preview and switch

```powershell
npx wrangler dev --config workers/site/wrangler.jsonc
npx wrangler deploy --config workers/site/wrangler.jsonc
```

Before switching reyhoho.fun:

- run `browser-artifact-check.js`;
- check that `/movie/301` gets a 301, an uncatalogued `/movie/123456789` a 200
  with noindex, and `/no-such-page` a 404;
- check a catalogued movie with and without the trailing slash, `/top`, login,
  service-worker update and offline navigation, and a crawler without JS.

Configure the custom domain only after preview verification. Then disable the
GitHub Pages deploy workflow, so there are not two production targets. Keep
GitHub Pages as the rollback until the switch is verified.

Release order for the API stays: D1 migration → API Worker → site.
