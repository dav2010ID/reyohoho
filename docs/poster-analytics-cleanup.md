# Poster, analytics, and unused integration cleanup — 2026-10-17

This pass reduces the browser work that happens on the initial page, keeps
poster downloads close to their rendered size, and removes integrations that
are no longer part of the local application.

## Final artifact size

The values below cover `.js` and `.css` files in `assets/immutable`. Each file
is compressed separately with Node's default `gzipSync` settings. They are
artifact measurements, not the full directory size or a production transfer
trace.

| Artifact       |   Files |      Raw bytes |     Gzip bytes |
| -------------- | ------: | -------------: | -------------: |
| Before cleanup |      98 |        963,953 |        320,840 |
| Final `dist`   |      96 |        939,489 |        310,731 |
| Reduction      | 2 files | 24,464 (2.54%) | 10,109 (3.15%) |

The final values include the route-level document-title fix in `App.vue` and
are recorded in `reports-browser/poster-analytics-sizes.json`.

## Poster loading

`src/utils/mediaUtils.js` generates responsive sources only for the verified
Yandex poster CDN pattern. The available variants are `100x150`, `200x300`,
`300x450`, and `600x900`; `srcset` and `sizes` select a source based on the
rendered card width and device pixel ratio. The grid size calculation includes
the 70 px desktop sidebar. Mobile detail posters that are hidden do not start a
network request.

Signed URLs, query strings, hashes, and unknown poster hosts keep their original
URL. Failed images clear responsive sources and use the local no-poster image.
The browser fixture uses a deterministic poster endpoint, so its request
assertions validate URL selection and loading behavior without downloading
production images.

## Analytics loading

GTM and GoatCounter are scheduled after the page `load` event plus a five-second
grace period, then run through `requestIdleCallback` when available. A trusted
pointer, keyboard, or touch interaction may start them earlier. Development,
local hosts, and `/auth-success` do not load analytics.

Yandex Metrica keeps the initial page URL, title, and referrer, sends one
explicit initial hit, and defers the counter's automatic hit. Router navigation
continues to send deduplicated SPA pageviews after the vendor queue becomes
available. The route-level title in `App.vue` keeps page titles synchronized
when a page-specific SEO head entry is removed.

## Removed code

The OBS integration was removed from the player, including its WebSocket client,
window APIs, settings, status UI, external filters, and persistence fields.
Electron blur, scene timing, and video overlay behavior remain. The unused
`vue-lazyload` dependency, scroll-tracking composable, simulation-only helpers,
unreachable provider adapters and dispatcher branches, and unused frontend
stream helpers were removed as part of the same cleanup.

## Reproduce the checks

From the repository root:

```powershell
yarn build:github
node scripts/browser-analytics-check.js dist
node scripts/browser-responsive-poster-check.js dist
node scripts/browser-deferred-movie-check.js dist
node scripts/browser-artifact-check.js dist
yarn test:unit run
yarn lint
yarn check:encoding
git diff --check
```

## Limits of the measurements

Analytics is still enabled for eligible production traffic, but a visitor who
leaves before the grace period and without interacting may not be recorded. The
browser analytics check uses inert vendor stubs and verifies scheduling and
queue behavior; it does not contact GTM, GoatCounter, or Yandex. The responsive
poster check verifies CDN URL selection at DPR 1, 2, and 3 with local fixtures;
actual image transfer sizes depend on the CDN responses.
