# Movie and player loading — 2026-10-16

`MovieInfo.vue` and `PlayerComponent.vue` now keep optional scene and
Electron overlay implementations outside the initial movie dependency graph.
The change also removes unused code and repeated handlers; splitting files alone
would not reduce the total build.

## Loading boundaries

- `MovieSceneTools.vue`, including its CSS, loads on the first Parents Guide or
  timing-panel click. Guide and vote requests start when their panel opens. The
  component stays mounted after closing, preserving timing selections. Its form,
  report, submitter, and moderation dialogs remain separate dynamic imports.
- `usePlayerVideoOverlay.js` loads `playerVideoOverlayRuntime.js` only in Electron,
  after the iframe loads, when the overlay is enabled or selected timings require
  it. Changing playback or unmounting disposes the runtime and invalidates pending
  imports. The legacy timing-global check runs only in Electron.
- These optional chunks are absent from the generated PWA shell precache list,
  so service-worker installation does not undo the deferred loading. Used chunks
  can still enter the runtime cache.
- The small Workbox registration client is included in the precache: its idle
  import must remain available on a cold offline app startup. Its dependencies
  are selected explicitly without including optional movie features.

Movie scene actions share authorization, clipboard, save, and moderation paths.
Scene requests ignore stale responses after navigation, panel changes, or
unmounting, with token guards on account-specific actions. Staff are grouped once
by profession instead of repeatedly filtering the full array in the template.

The OBS integration, including its WebSocket client, window APIs, settings,
external filters, and overlay status, has been removed. Electron local blur,
scene timings, and overlay settings remain. Previously saved player preferences
are preserved while retired settings are excluded from hydration and persistence.
Unused MovieInfo controls, duplicate styles, and redundant listeners were also
removed. Cleanup covers timeout handles, overlay observers, listeners, and retry timers.
Refreshing movie data after a timing edit keeps the existing player iframe
mounted instead of replacing it with the loading skeleton.

## Measured result

The baseline is the saved production artifact **after the Font Awesome CSS
optimization and before these component changes**. Earlier icon savings are not
included again. Both artifacts use `yarn build:github` with
`VITE_PRERENDER_MOVIE_PAGES=true`. All values are bytes.

| Measurement                          |  Before |   After |      Reduction |
| ------------------------------------ | ------: | ------: | -------------: |
| Initial movie JS/CSS, gzip, 390 px   | 223,087 | 204,475 | 18,612 (8.34%) |
| Initial movie JS/CSS, gzip, 1,280 px | 221,578 | 202,966 | 18,612 (8.40%) |
| All emitted JS/CSS, raw              | 994,626 | 963,953 | 30,673 (3.08%) |
| All emitted JS/CSS, gzip             | 323,482 | 320,840 |  2,642 (0.82%) |

Initial resources were measured with Resource Timing `encodedBodySize`, Edge
155.0.4283.45, fresh browser contexts, service workers blocked, deterministic local
API/player fixtures, and a gzip server. The viewport height was 640 px to keep
comments outside the existing 300 px intersection margin. Images, fonts, HTTP
headers, and third-party player transfers are excluded. This measures bytes,
not a production LCP or playback-start improvement.

Totals include every `.js` and `.css` file in `assets/immutable`, including
optional chunks, each compressed separately using Node's default `gzipSync`.
The file count changes from 96 to 98. Most of the initial saving is deferred
code; the smaller overall build reflects removed code and styles.

| Deferred implementation     |    Raw |  Gzip |
| --------------------------- | -----: | ----: |
| MovieSceneTools JS          | 16,739 | 5,958 |
| MovieSceneTools CSS         |  9,649 | 2,022 |
| Electron overlay runtime JS | 29,707 | 7,826 |

## Reproduce and verify

Preserve a baseline build in a separate directory before building the changed
source. The local ignored baseline for these results is
`reports-browser/component-split-before`. In PowerShell:

```powershell
$env:VITE_PRERENDER_MOVIE_PAGES = 'true'
yarn build:github
node scripts/browser-deferred-movie-check.js dist reports-browser/component-split-before
node scripts/browser-artifact-check.js dist
yarn test:unit run
yarn lint
yarn check:encoding
```

To recalculate the complete asset totals, run `node --input-type=module` and
evaluate the following JavaScript for each artifact directory:

```js
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

for (const root of ['reports-browser/component-split-before', 'dist']) {
  const directory = path.join(root, 'assets/immutable')
  const files = fs.readdirSync(directory).filter((file) => /\.(js|css)$/.test(file))
  const totals = files.reduce(
    (sum, file) => {
      const data = fs.readFileSync(path.join(directory, file))
      sum.raw += data.length
      sum.gzip += gzipSync(data).length
      return sum
    },
    { count: files.length, raw: 0, gzip: 0 }
  )
  console.log(root, totals)
}
```

Validation passed: 516 unit tests in 91 files, lint, encoding, production SSG/PWA
build, and browser checks at 390 and 1,280 px. The browser checks cover first-use
JS/CSS downloads, comments and player chooser deferral, panel reopen with stale
responses, votes and their styles, parser output, timing submission without
replacing the iframe, and offline navigation/update behavior. No page errors or
horizontal overflow were recorded.

Unit tests exercise deferred Electron overlay lifecycle, local scene blur, and
preservation of player preferences with controlled fakes. Native Electron
fullscreen overlays still require an integration run in the desktop app.
Local raw reports and screenshots are under the ignored `reports-browser/`
directory (`component-sizes.json`, `deferred-movie.json`).
