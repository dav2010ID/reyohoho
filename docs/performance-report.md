# ReYohoho performance report

Date: 2026-05-08
Environment: Windows, Node.js v24.15.0, Yarn 1.22.22 via Corepack, local Vite preview, Lighthouse through Microsoft Edge headless.

## Verification

| Check | Result |
| --- | --- |
| Install | `corepack yarn install --frozen-lockfile` passed |
| Unit tests | `corepack yarn test:unit` passed: 12 files, 63 tests |
| Lint | `corepack yarn lint` passed |
| Dev server | `corepack yarn dev --host 127.0.0.1 --port 5173` started, Vite ready in 471 ms, `/` returned 200 |
| Production build | `corepack yarn build` passed |
| Production preview | `corepack yarn preview --host 127.0.0.1 --port 4184`, `/` returned 200 |

Build warning that remains: `vite-plugin-pwa@1.2.0` declares peer support up to Vite 7 while the project uses Vite 8. The build works, but this should be tracked during dependency updates.

## Lighthouse comparison

Mobile Lighthouse, local production preview.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Performance score | 55 | 71 | +16 |
| FCP | 3330 ms | 2267 ms | -1063 ms |
| LCP | 16461 ms | 6967 ms | -9494 ms |
| TBT | 383 ms | 188 ms | -195 ms |
| CLS | 0.0070 | 0.0070 | 0 |
| INP | not available in lab run | not available in lab run | n/a |
| Speed Index | 5677 ms | 3148 ms | -2529 ms |
| TTI | 16559 ms | 6967 ms | -9592 ms |
| Requests | 446 | 151 | -295 |
| Total transfer | 12.46 MB | 1.73 MB | -10.73 MB |

The final score improved after limiting the home page SSG grid to 24 cards, reducing `/top` initial DOM to 36 cards, shrinking PWA precache, lazy-loading the static SEO catalog out of the initial client bundle, disabling client-side per-card SEO enrichment XHR, and forcing list thumbnails to use smaller Kinopoisk poster URLs.

## Real browser check

The project includes `corepack yarn perf:browser http://127.0.0.1:4184/`, which opens Microsoft Edge through Playwright and writes artifacts to `reports-browser/`.

Latest run:

| Page | Wall time | Browser FCP | Resource count | Cards | FPS estimate | Console errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home desktop | 2317 ms | 488 ms | 75 | 24 | 100 | 0 |
| Top desktop | 1575 ms | 188 ms | 70 | 36 | 100 | 0 |
| Home mobile | 2188 ms | 308 ms | 71 | 24 | 100 | 0 |

The script also saved `reports-browser/home-desktop.png`, `reports-browser/top-desktop.png`, `reports-browser/home-mobile.png`, and `reports-browser/network.har`.

## Browser Smoke Test

Added `corepack yarn test:browser-smoke http://127.0.0.1:4184/`.

The smoke test opens Microsoft Edge and verifies:

- home page loads and renders movie cards;
- first home card opens a real `/movie/:id/:slug` route;
- browser back navigation returns to home;
- `/top` loads;
- "show more" increases rendered cards from 36 to 72 when the API returns more items, or records an exhausted state when the backend caps the response;
- top filter navigation updates the URL and keeps cards rendered;
- first top card opens a real movie route;
- `/settings` loads;
- an unknown route renders expected 404 content;
- console errors, page errors, failed requests, and HTTP 4xx/5xx responses are collected.

Latest result: passed. The test initially found unsafe browser header errors from `Referer`/`Origin` on Kinobox/KinoBD requests. Those headers were removed for browser execution. It also found that fixed sleeps were too brittle for "show more"; the test now waits for the card count or exhausted state.

All browser tests now create clean contexts: service workers are blocked, cookies and browser cache are cleared through CDP, and localStorage/sessionStorage/indexedDB/cache storage are cleared before app code runs.

## Card Click Profiling

Added `corepack yarn profile:cards http://127.0.0.1:4184/ 5`.

The profile opens a clean Edge context for each sampled card, discovers cards on `/` and `/top`, clicks 5 cards from each source route, waits for the `/movie/:id/:slug` route, and records navigation timing, resource count, response type counts, iframes, console errors, page errors, failed requests, and bad HTTP responses.

Latest result: passed for 10/10 card transitions.

| Source | Samples | Avg wall time | FCP range | Resource count | XHR count | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home cards | 5 | ~3172 ms | 264-544 ms | 90 | 10 | 0 |
| Top cards | 5 | ~2548 ms | 252-404 ms | 80-82 | 2 | 0 |

Finding: the previous `/top` transition bottleneck was client-side per-card SEO enrichment. Disabling that in browser runtime reduced `/top` click profiles from about 106 XHR to about 2 XHR per sampled transition. There were no app 404/500 responses, console errors, or page errors.

## Bundle comparison

Important client build changes:

| Asset | Before | After |
| --- | ---: | ---: |
| `app` JS | 120.5 KB / 43.8 KB gzip | 59.0 KB / 22.0 KB gzip |
| `_plugin-vue_export-helper` JS | 64.8 KB / 25.6 KB gzip | 0.08 KB / 0.09 KB gzip |
| Firebase/auth path | `auth` 412.2 KB / 131.4 KB gzip | `vendor-firebase` 56.8 KB / 17.2 KB gzip, lazy-loaded |
| `movieSeo` JS | 298.9 KB / 93.7 KB gzip | 3.5 KB / 1.5 KB gzip |
| Stars background | PNG 269.6 KB | WebP 128.0 KB |

PWA precache moved from hundreds of generated HTML pages to asset-only shell caching: 96 entries, about 1.66 MB.

New intentional vendor chunks:

- `vendor-vue`: Vue/Pinia/head runtime.
- `vendor-http`: Axios.
- `vendor-firebase`: Firebase Remote Config, no longer part of the initial app chunk.
- `vendor-sanitize`: DOMPurify.

## Bottlenecks found

- SSR rendered many poster images as eager `img src`, causing a very large waterfall on first load.
- Home page image transfer dominated the baseline: about 11.59 MB of the 12.46 MB total transfer.
- Firebase Remote Config was pulled into the early graph through static auth/API imports.
- API provider modules were imported statically, preventing effective code splitting.
- The default PNG star background was a large always-loaded local asset.
- The SSG home/top pages are still large HTML documents, around 750 KB, because they contain pre-rendered movie cards.
- The baseline `movieSeo` chunk shipped the static SEO catalog to the client even when it was only needed for SSG route generation.
- FontAwesome and Google Material Icons still add large font downloads; FontAwesome is loaded as the full webfont set, so it is not tree-shaken.
- TBT remains sensitive to hydration of the pre-rendered movie grid and large route/component setup.

## Optimizations applied

- Deferred auth API import in `src/store/auth/auth.js`.
- Deferred user/API imports in `src/components/MenuNavigation.vue`.
- Converted API provider loading in `src/api/movies.js` to explicit dynamic imports.
- Added Rollup `manualChunks` in `vite.config.js` for Vue, Axios, Firebase, and DOMPurify.
- Added SSR-compatible lazy/eager image attributes for movie cards with high priority only for the first three cards.
- Added poster URL normalization from Kinopoisk `x1000` to `x300` where the app resolves poster URLs.
- Converted `src/assets/image-back-stars.png` to `src/assets/image-back-stars.webp` and switched the background store/tests to it.
- Limited the home page popular list to 24 cards; the full list remains on `/top`.
- Limited `/top` initial render to 36 cards and added a "show more" control to reduce hydration work.
- Changed `/top` "show more" to request a cumulative limit because the backend does not provide reliable page-based pagination for this endpoint.
- Deferred service worker registration until browser idle/load.
- Added a repeatable Edge/Playwright profiling script.
- Moved the static SEO catalog behind an async import used by SSG/prerender, shrinking the normal client `movieSeo` chunk.
- Restricted Workbox precache to app shell/assets rather than generated HTML pages.
- Disabled the Vite ESLint plugin in production builds; lint remains available through `corepack yarn lint`.
- Added complex browser smoke coverage and fixed unsafe browser request headers found by the run.
- Disabled client-side SEO enrichment XHR for top/home list cards while preserving SSR/SSG enrichment.
- Normalized Kinopoisk list poster URLs from `/kp/` to `/kp_small/` and from Yandex `x1000` to smaller variants where the app controls the URL.

## Remaining recommendations

- Replace full FontAwesome webfont loading with local SVG icon components or a generated icon subset. This is the next best JS/CSS/font optimization.
- Replace full FontAwesome and Material Icons fonts with a generated SVG icon subset.
- Add API/image-proxy support for consistently serving poster thumbnails without third-party redirects.
- Split `MovieInfo.vue` further: comments, player settings, OBS, reports, and modals can become async components.
- Add responsive image proxying or API-level poster thumbnail fields. Some runtime waterfall entries still come from third-party poster redirects, though the app now requests `kp_small` for list thumbnails.
- Gate PWA service worker registration behind production if dev SW behavior becomes noisy.

## Artifacts

- Baseline Lighthouse JSON: `reports-lighthouse-baseline.json`
- Final Lighthouse JSON: `reports-lighthouse-final-4184.json`
- Browser performance JSON: `reports-browser/browser-performance.json` (local ignored artifact)
- Browser smoke JSON: `reports-browser/browser-smoke.json` (local ignored artifact)
- Card click profile JSON: `reports-browser/card-profile.json` (local ignored artifact)
