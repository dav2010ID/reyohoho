# Kinobox outage investigation — 2026-10-20

Production was inspected read-only. No deployment or configuration changes were made.

## Confirmed observations

- The user screenshot shows search returning HTTP 503 with `Upstream temporarily unavailable`. Its request ID is unavailable, so the exact invocation cannot be identified.
- A bounded live search request at about 20:37:30 UTC returned HTTP 502, `Upstream connection failed`, cache MISS, Retry-After 30, ray `a4dad21eab04ae58`.
- Its Cloudflare invocation ID is `717ac96b69024b8631c14f5284d8c67a`: outcome `ok`, CPU 54 ms, wall time 234 ms. The application logged `kinobox_error`, reason `connection`, duration 178 ms, and `public_cache` MISS/502. This invocation was not terminated with `exceededCpu`.
- Nearby production search, players, and movie requests also logged connection failures and HTTP 502. Search and players requests at 20:36:34–35 UTC returned BACKOFF/503 with CPU 0–1 ms. The independent Kinopoisk top route continued returning HTTP 200.
- Production still serves version `2a55f6fd-3944-4635-bf84-c2513d70b2d8` at 100%, deployment `313d0a4f-77e9-4ec0-ad2b-a1327345764e`, created October 13. The local October 18 CPU audit changes are not deployed.

## Bounded local transport checks

Each check made one GET to `https://api.kinobox.tv/api/movies/301`, using the existing profiling script and request headers. Certificate verification remained enabled.

| Transport | Result |
| --- | --- |
| Vendored TLS/HTTP2 | TLS handshake and certificate verification completed; HTTP/2 failed with `RST_STREAM: 1` (PROTOCOL_ERROR) |
| Node native HTTP/2 | `ERR_HTTP2_STREAM_ERROR`, `NGHTTP2_PROTOCOL_ERROR` |
| Node fetch | Connection closed by peer, `UND_ERR_SOCKET` |

Local Node results do not prove the exact error inside production workerd. Production logs currently collapse transport exceptions into `reason: connection`; they do not record the HTTP/2 reset code. Nevertheless, failures in both native and vendored local HTTP/2 clients argue against attributing this outage solely to the local CPU patches or certificate expiry.

## Interpretation and remaining work

### Browser HAR and verified local fix (October 20, approximately 20:46–20:55 UTC)

The supplied Zen HAR records successful movie and players responses. `X-Firefox-Spdy: h2` establishes HTTP/2 despite the HAR request field saying HTTP/1.1. All HAR timing values are zero; the HAR cannot establish a network route. Zen preferences specify no explicit proxy (`network.proxy.type=0`) and Cloudflare DoH with fallback (`network.trr.mode=2`). Local DNS, Cloudflare DoH and Google DoH resolve the API to 45.133.119.36. These observations do not rule out transparent network software.

Controlled requests from the same local machine using curl_cffi returned 200 with the HAR request profile, but stream reset code 1 with the existing Worker profile. Starting from the successful profile, changing only the UA to the existing HeadlessChrome UA, changing Accept-Encoding to br, removing ts, removing Referer, or removing Sec-Fetch-Site each caused a reset. Changing only the Referer to kinobox.in, removing Origin, or removing other tested optional headers did not. ts=1 also succeeded; an unrelated foo parameter did not replace ts. This is strong evidence of upstream request filtering/compatibility rules, not proof of their internal implementation. It contradicts a global outage and does not support a Cloudflare-only IP ban as the sole explanation. Native Node fetch still failed even with the HAR headers; changing to standard fetch is not yet verified.

The actual vendored TLS/HTTP2 client, with certificate verification enabled and a HAR-compatible profile, returned valid JSON/200 on movie, players and search. The local fix updates its public request profile, sends server-generated ts for players too (search/movie already did), and decodes gzip/deflate/br with a 1 MiB output limit before schema validation and caching. The advertised profile excludes zstd, which was independently verified to still return 200. Unsupported encodings and malformed or oversized decoded bodies are rejected.

Full local transport + serveKinoboxContent + cache smoke results:

| Route | Cold result | Warm result | Decoded bytes | Upstream connections across both |
| --- | --- | --- | --- | --- |
| /api/movies/8431006 | 200 MISS, 308 ms wall | 200 HIT | 2263 | 1 |
| /api/players?kinopoisk=8431006 | 200 MISS, 220 ms wall | 200 HIT | 383 | 1 |
| /api/movies/search/?query=matrix | 200 MISS, 391 ms wall | 200 HIT | 24507 | 1 |

All 133 Worker tests in 11 files passed, including valid gzip/deflate/br cache round trips, corrupt gzip, decompression output limit, and players timestamp. Existing vendor source-map warnings remain. These are local results, not edge CPU measurements. The HAR players response has provider records with null iframeUrl for this particular movie; HTTP/schema success does not establish video playback availability. Production remains unchanged.

Telemetry narrows the sustained Worker failure transition to October 18 between the last observed fresh successful players response at 18:53:52.917 UTC and the first observed failed search response at 19:05:04.441 UTC. This is not the exact time an upstream policy changed.

Remaining validation: an isolated Cloudflare test of the final profile and decompression, all three routes, and CPU percentiles. The custom TLS CPU issue remains unresolved; restoring connectivity does not establish compliance with the Free 10 ms budget. Production deployment requires separate user confirmation.

### Isolated edge validation: local fix is insufficient

At 20:56–21:00 UTC an authenticated temporary Worker `reyohoho-har-diagnostic-20261020` tested the actual patched content and transport modules without production routes, secrets, or D1 bindings. Compatibility date and nodejs_compat matched production. All three cold requests returned 502 MISS; their subsequent requests returned 503 BACKOFF. Telemetry CPU was movie 53 ms, players 24 ms, search 17 ms (BACKOFF 0–1 ms); outcomes were ok, not exceededCpu. This is three failed MISS measurements, not a meaningful CPU percentile distribution for successful traffic.

A diagnostic-only exception log confirmed `HTTP/2 RST_STREAM: 1` from Cloudflare with the new profile (movie/301, CPU 51 ms). A native Workers fetch with the HAR-compatible headers and ts returned upstream 520, not a usable JSON response. The local profile changes therefore cannot yet be deployed as a working Cloudflare fix. No successful compressed response reached this edge handler; native decompression support remains unverified on an actual successful edge response.

Combined evidence: request-profile restrictions exist locally, while Cloudflare-origin traffic faces an additional unresolved network or connection-profile restriction. A Cloudflare IP/ASN restriction is plausible but not proven: testing one local egress and VIE does not isolate IP from other runtime differences. An upstream operator must confirm allowlisting policy, or a verified external transport service with native TLS/HTTP2 and a permitted egress must be tested. Such a service can also remove JS TLS CPU from the Worker. Moving to Workers Paid alone would not fix these current connection resets.

Diagnostic results are saved locally in `reports-browser/worker-cpu/har-fix-20261020/results.json` and `native-fetch.json`. Temporary diagnostic Worker deletion is performed after evidence capture. Production is unchanged.

### Native transport alternatives checked after the edge failure

Node's native HTTP/2 client on the local machine, using the HAR headers and ts, returned 200 on all three routes (compressed movie 1153 bytes, players 131 bytes, search 3464 bytes). This further demonstrates that custom JS TLS is not intrinsically required from this local egress. The earlier native-client failures used the old request profile.

Cloudflare's current workerd source exposes `node:http2.connect` as ERR_METHOD_NOT_IMPLEMENTED. A small authenticated temporary Worker tested native `node:tls.connect` against the fixed upstream with certificate verification enabled and ALPNProtocols=['h2']; the actual runtime returned `The options.ALPNProtocols option is not implemented`. A second test without ALPN sent an HTTP/1.1 request with the compatible headers and ts; the connection closed with zero response bytes. These are runtime checks, not assumptions based only on documentation. Neither provides a working substitute for JS TLS/HTTP2 on this Worker. Results are saved as native-tls.json and native-tls-http1.json alongside the other diagnostic artifacts. The recreated temporary Worker was deleted after testing.

References: https://developers.cloudflare.com/workers/runtime-apis/nodejs/tls/index.md and https://raw.githubusercontent.com/cloudflare/workerd/main/src/node/http2.ts . No additional production deployment was made. A native TLS transport service outside this restricted Workers path, or upstream cooperation, remains necessary to validate the next fix.

The checked-in local profiling script was updated to use the current compatible headers and upstream ts for each route, so its native/vendored comparison no longer uses obsolete request parameters. Re-running `node scripts/profile-kinobox-transport.mjs --mode=compare --requests=1 --path=/api/movies/8431006 --inspect-profile=off` returned 200/valid JSON from both vendored and native HTTP/2, with identical decoded SHA256 `ce4c48121f857249006cb5cf6608c73bc198a94f968ea87853340a78ff5c0c59`. Node fetch failed with UND_ERR_SOCKET. The command intentionally exits nonzero when any transport fails; the complete comparison is saved in local-compare.json. This is repeatable local evidence, not an edge CPU claim.

The 503 response is consistent with the existing 30-second retry cooldown after an upstream transport failure. It is not itself evidence of CPU termination. The separate CPU budget problem remains unresolved.

The controlled local comparison above establishes a working request profile and implicates upstream request filtering/compatibility. The exact upstream rule and its Cloudflare behavior are not established. Do not remove backoff, disable certificate verification, or replace transport without a successful compatibility check. Edge validation and CPU measurement remain required before proposing a production deployment.

### Paid retest, October 20, 21:12–21:15 UTC: partial recovery verified

This supersedes the earlier conclusion that no Cloudflare path worked. An authenticated isolated diagnostic Worker with cpu_ms=1000 returned 200/valid gzip JSON for all three routes with exact HAR headers and the compatible profile excluding zstd: 6/6 sequential probes, PRG. The reason earlier edge checks failed remains unknown; do not attribute recovery solely to Paid or CPU settings. A same-deployment original-profile control returned RST_STREAM:1, while the patched profile returned 200. The actual repository handler with current timestamps, bounded decompression, validation and cache returned 200 MISS then 200 HIT on movie, players and search. Adjacent production movie still returned 502 MISS. Production was unchanged. Settings reported usage_model=standard without explicit limits.

Six concurrent cold search requests produced three 200 (one MISS, two HIT) and three 502 MISS. Two failed connection invocations appeared in telemetry with CPU 52/60 ms; the third was absent from the query output. This remains a production readiness blocker. Per-isolate leases cannot serialize requests globally. Successful transport probe CPU: 95,54,33,38,38,30 ms. Full-handler successful MISS available in telemetry: movie91 ms, search29 ms. HIT CPU0–2 ms. All returned invocation outcomes were ok, not exceededCpu. These small samples cannot establish production percentiles. The custom transport still exceeds Free10ms but fits the explicit Paid diagnostic budget.

All133 tests in11 Worker files passed again, with existing vendor source-map warnings. TLS verification and access controls remain intact. Evidence in ignored reports-browser/worker-cpu/har-fix-20261020: paid-exact-results.json, paid-full-results.json, paid-concurrent-results.json. Playback was not verified. Production deployment requires separate confirmation.

### Production recovery, October 21, authorized by user

The user explicitly requested “Fix prod”. Wrangler deployed the compatible headers, players timestamp, bounded decompression, cache safety and vendor CPU adaptations while preserving existing D1, Telegram settings, secrets, cron and rate-limit bindings. Initial post-deploy probes still failed intermittently. The subsequent all-route check returned 200 MISS then HIT for search/matrix, movie8431006, players8431006 and players301. A cold parallel search batch still had one failure out of four.

Added exactly one retry for the observed HTTP/2 RST_STREAM:1 error, with a250ms delay and a shared15s upstream deadline. Each attempt consumes the existing public upstream budget; no retry for certificate failures, other transport errors or HTTP errors. Transport reset codes are logged only through a fixed numeric allowlist pattern. New tests verify successful recovery, retry exhaustion, non-reset exclusion and budget enforcement.137 tests in11 files pass.

Final production version f2c9ac6f-ff2f-4cbe-bb0b-3167ebc51656, header kinobox-har-fix-2026-10-21. Final search, movie301 and players301 checks all200. Six simultaneous requests for initially cold search/inception all200 (oneMISS,fiveHIT). Input validation400, denied origin403, independent top route200 verified. These bounded checks establish recovery at verification time, not a long-term reliability guarantee or playback verification. Retry may add latency and a second handshake CPU charge on resets. Previous rollback version:2a55f6fd-3944-4635-bf84-c2513d70b2d8. Local changes remain uncommitted.

### Follow-up: concurrency is not an established root cause

The recreated authenticated diagnostic Worker compared independent invocations and connections owned by a single invocation. Each connection retained its own TLS/HTTP2 state, certificate verification and timeout. No cross-request sockets or promises were reused. The test handler bypassed the content cache so every probe opened a new connection. These are transport probes, not a load test of the full application.

Initially, with the HAR fixed ts=5070, eight sequential search connections, four simultaneous connections inside one invocation and six independent simultaneous invocations all failed with HTTP/2 RST_STREAM:1 (PROTOCOL_ERROR). Failures even at concurrency one refute concurrency as a sufficient explanation. An adjacent local comparison still returned 200 from native and vendored HTTP2; native fetch failed.

After switching to current ts, four movie probes with concurrency one and a one-second pause succeeded. Four parallel movie and four parallel search connections also succeeded. A subsequent same-deployment alternating comparison of ts=5070 and current ts returned four successes, so timestamp freshness is NOT established as the cause of the change. Six independent simultaneous search invocations with current ts returned five 200 and one RST_STREAM:1.

Finally, two alternating parallel batches and two sequential batches used the same search resource, headers, current timestamp logic and deployment: parallel 8/8 successful; sequential with a one-second pause 8/8 successful. Serial search latency was 294–314 ms excluding the pause; parallel per-connection completion ranged 244–1030 ms. The small sample and changing upstream behavior do not establish a reliability improvement from serialization, a numeric upstream concurrency limit, or a specific IP/ASN rule. Do not implement a global coordinator solely on these results.

Confirmed failure location: an HTTP2 RST_STREAM frame is received after TLS establishment, not a CPU termination or JSON decoding error. Code1 identifies PROTOCOL_ERROR but does not disclose whether an upstream filter, intermediary or protocol interoperability issue generated it. Compatible headers/ts restore connectivity in controlled examples, but residual resets are intermittent and their exact server-side cause remains unknown. The earlier assumption that the three concurrent failures proved an upstream connection cap is withdrawn. A global IP ban is also unproven. The pre-existing JS TLS CPU overhead is a separate issue.

Local ignored evidence files: concurrency-batches.json, concurrency-independent.json, concurrency-paced.json, concurrency-current-ts.json, timestamp-control.json, current-independent.json, matched-concurrency.json, local-concurrency-control.json. The temporary Worker is deleted after testing. No production changes or new production concurrency controls were made.

### Recheck, October 31: production failing again

Read-only bounded probes; no deployment or configuration changes.

- 17:27:57 UTC: production `search?query=matrix` returned HTTP 504 after 15.6 s with Retry-After 30, ray `a5345f97adf9b77f-PRG`. The duration matches the shared 15 s upstream deadline.
- The next movie 8431006 request returned 503 in 0.17 s, consistent with the 30-second backoff after the preceding failure rather than a separate upstream attempt.
- Home and top pages render cards in the browser; opening a movie page shows the server error message because its movie request receives 504.
- `node scripts/profile-kinobox-transport.mjs --mode=compare --requests=1 --path=/api/movies/8431006 --inspect-profile=off` from the local machine returned 200 with valid gzip JSON and identical decoded SHA256 (prefix `00a27180fd12`) from vendored TLS/HTTP2, Node native HTTP/2 and Node `fetch()`. Earlier in this investigation Node `fetch()` failed with UND_ERR_SOCKET, so its success is new.

The upstream is reachable locally while the Cloudflare path times out. This does not establish an IP/ASN block; production CPU and the server-side cause of the timeouts were not measured. Next step: retest standard `fetch()` and the current transport from an isolated diagnostic Worker before any production change. Playback and authenticated flows were not checked. Production version is still `f2c9ac6f-ff2f-4cbe-bb0b-3167ebc51656`, unverified against the deployment list today.

### Isolated edge check, October 31: TCP does not open from Cloudflare

Authorized by the user. A temporary Worker `reyohoho-fetch-diagnostic-20261031` (no production routes, D1, secrets or cache; random diagnostic key; compatibility date and `nodejs_compat` as in production; `cpu_ms` 1000) ran 17:32–17:36 UTC in PRG and was then deleted. Each probe used the current HAR-compatible headers and a fresh `ts`.

| Probe | Result |
| --- | --- |
| Native `fetch()`, movie/players/search, 2 rounds | 6/6 Cloudflare 520 page in 22–125 ms, `server: cloudflare` |
| Vendored TLS/HTTP2, movie/players/search, 2 rounds | 6/6 `Upstream timeout` at 15 s |
| `connect()` to `api.kinobox.tv:443`, `secureTransport: "off"` | 2/2 socket not opened within 10 s |
| `connect()` with `secureTransport: "on"` | 1/1 not opened within 10 s |

Cloudflare DoH, Google DoH and the local resolver all return 45.133.119.36. From the local machine at the same time TCP connected in 67 ms and TLS in 330 ms to that address, and all three Node transports returned 200 (previous section).

The failure has moved below HTTP/2: earlier edge failures were `RST_STREAM: 1` after TLS, now the TCP connection itself is not established from the tested Cloudflare location, so header or `ts` changes cannot fix it. The 504 after 15 s in production matches this. This is consistent with upstream or intermediate filtering of Cloudflare egress, but only one colo (PRG) was tested and the upstream operator has not confirmed a block. Code changes inside the Worker will not restore connectivity; options are upstream allowlisting or an external transport with a permitted egress. Raw results: ignored `reports-browser/worker-cpu/fetch-20261031/results.jsonl`. Production unchanged.
