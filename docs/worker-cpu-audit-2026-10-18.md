# Аудит CPU Kinobox Worker, 18 октября 2026

Проверяемый Worker: `lively-cloud-4e31`, environment `production`, account
`<account-id>`. Production не изменялся. Активная версия
`2a55f6fd-3944-4635-bf84-c2513d70b2d8`, 100% трафика; deployment
`313d0a4f-77e9-4ec0-ad2b-a1327345764e` от 2026-10-13 15:03:14 UTC.

**Критерий 10 мс CPU не выполнен.** Патч устраняет ненужное логирование,
форматирование и копирование, а также исправляет несколько ошибок stale-кеша.
Однако отдельные edge Workers с исправленным кодом использовали 25–56 мс CPU
на измеренных MISS. Сокращение общего CPU в этой выборке не подтверждено.
Нативный Workers `fetch()` вернул 520 на всех трёх проверенных маршрутах,
поэтому транспорт не заменён. Патч нельзя представлять как устранение
`exceededCpu` или как готовность работать на Free при холодном кеше.

## Причина и границы доказательств

Дорогой путь запроса:

1. [`worker.mjs`](../workers/kinobox-search/worker.mjs), `fetch()` и `openTransport()`: передают запрос в контентный обработчик и открывают TCP.
2. [`kinobox-content.mjs`](../workers/kinobox-search/kinobox-content.mjs), `serveKinoboxContent()`: при отсутствии fresh/retry-ответа получает lease и вызывает upstream.
3. [`kinobox-http2-vendored.mjs`](../workers/kinobox-search/kinobox-http2-vendored.mjs), `requestKinoboxHttp2()`: каждый вызов делает `openTransport(HOST, 443)`, создаёт `makeTLSClient()` и выполняет `tls.startHandshake()`.
4. Сгенерированные `vendor-tls.mjs`, `vendor-crypto.mjs`, `vendor-hpack.mjs`: TLS 1.3, ASN.1/X.509, WebCrypto, HTTP/2 и HPACK. Исходные пакеты и хеши закреплены в [`vendor-manifest.json`](../workers/kinobox-search/vendor-manifest.json).

На один MISS, дошедший до upstream, создаётся одно новое TCP-соединение к
Kinobox и одна новая TLS-сессия. Внутреннего reconnect/retry нет. Дополнительно
библиотека может получить разрешённый AIA issuer certificate через `fetch()`.
HIT и отклонённые budget/backoff-запросы не создают Kinobox-соединений. Сокеты
или незавершённые I/O-промисы между отдельными Workers requests не разделяются.

Production HIT занимает 0–3 мс в проверенных примерах, а MISS включает полный
TLS handshake и превышает бюджет. Локальные профили показывают разбор ASN.1,
проверку цепочки сертификатов и TLS CertificateVerify; те же операции остаются
после патча. Это подтверждает источник существенной работы на холодном пути.
Точная функция, на которой прервался каждый исторический `exceededCpu`,
не установлена: у failed invocation нет завершающего cache-лога и профиля.

### Реальные production invocations

Сопоставление сделано по request ID; время CPU взято из invocation, а cache
state — из логов того же запроса. Wall time не используется как CPU.

| Request ID                         | Маршрут / cache / colo | CPU, мс | Wall, мс | Outcome / HTTP    |
| ---------------------------------- | ---------------------- | ------: | -------: | ----------------- |
| `2329e90f6dc20ea54ee037ee2b00ab14` | search / HIT / ARN     |       0 |        6 | ok / 200          |
| `d2b7f736fbb239e42be0c6f8ac21cf11` | players / HIT / FRA    |       3 |       26 | ok / 200          |
| `7ad73c631335e6f1a3d2338d7df04e52` | movie / HIT / HKG      |       1 |        5 | ok / 200          |
| `efad0692e979c56527f010df591769c4` | search / MISS / WAW    |      30 |      415 | ok / 200          |
| `abd88bb1aed054b47d8439745c183fca` | players / VIE          |      20 |      121 | exceededCpu / 503 |
| `2d990e411c3bc391643fe1f5cf68e22d` | search / VIE           |      10 |     3618 | exceededCpu / 503 |
| `a3858db8babc693f22583e5a20117780` | search / VIE           |      10 |      108 | exceededCpu / 503 |

Исходные данные пользователя: около 24 860 invocations и 1 560 ошибок,
почти все `exceededCpu`; dashboard P50/P90/P99 = 13,25/54,54/123 мс.
В выборке 80 ошибок за 12:00–14:31 UTC: search 43, players 35, movie 2.

Отдельные adaptive telemetry оценки за это окно: search — 1 601 `ok`,
468 `exceededCpu`, 11 `canceled`; players — 1 235/195/7 соответственно.
CPU среди `ok`: search median/P90/P99 35/79/101 мс, players 33/67/79 мс.
Это sampled оценки другой совокупности; их нельзя складывать с dashboard
или считать `ok` гарантией HTTP 200.

### Production Flamegraph

Через Cloudflare API получен 15-секундный CPU profile текущей production
версии, файл `reports-browser/worker-cpu/production-before.pprof` (715 байт).
Окно оказалось разреженным и преимущественно с HIT: в стеках есть
`cacheMatch`/`match`/`fetch`, native и idle, но полезного TLS стека нет.
Профиль нельзя ретроспективно привязать к ошибкам 12:00–14:31 UTC.
Наличие sourcemaps не восстанавливает отсутствующие samples.

Поэтому **точного production распределения миллисекунд между TLS, crypto,
HPACK, Buffer, JSON и логированием нет**. В частности, сумма весов этого
pprof и время ожидания Cache API не являются CPU одного запроса.
API: `POST /accounts/{account_id}/workers/workers/{worker}/versions/{version}/profile`,
`{ duration_ms: 15000, profile_type: "cpu" }`.
См. [Cloudflare profiling in production](https://developers.cloudflare.com/workers/observability/profiling-in-production/).

### Локальный workerd: разбор по функциям

Получены 12 профилей исходного и 12 исправленного custom-клиента, по четыре
на search, players и movie. Все 24 ответа — 200 с валидным JSON;
контрольные хеши соответствующих маршрутов совпали. Шаг sampling 250 мкс.
Ни `timeDeltas`, ни wall time не переводились в CPU миллисекунды.

Категории взаимоисключающие; ниже число появлений в `cpuprofile.samples`.
Строки source проверялись по телам функций, а не только по диапазону vendor.

| Работа                                                  | До, samples | После, samples |
| ------------------------------------------------------- | ----------: | -------------: |
| TLS / ASN.1 / X.509, JS                                 |         268 |            291 |
| Native crypto + JS crypto wrappers                      |         120 |            109 |
| HTTP/2 / HPACK, JS                                      |          23 |             30 |
| Node Buffer                                             |          13 |              7 |
| Другие byte/ArrayBuffer helpers                         |          23 |             42 |
| `debuglog` / `internal_inspect` и их native descendants |         131 |              0 |
| TLS hex formatter `ar`                                  |           5 |              0 |

Внутри crypto native `verify` — 54→48 samples: цепочка
`verify ← crypto.verify ← verifyIssued` — 47→44,
TLS CertificateVerify (`Kl`) — 7→4. Это части строки crypto,
повторно прибавлять их нельзя. Native importKey — 15→11,
generateKey — 10→3, deriveBits — 4→4. JS остаётся в BER decoder `QA`,
ASN.1 schema comparison `ur`, ASN.1 block constructor `he`, `fromASN`,
X509 `create` и `isWithinValidity`.

JSON parse/stringify отдельно не попали в samples. Сам локальный probe
разбирает/валидирует JSON и вычисляет hash, поэтому этот профиль не
измеряет выигрыш от передачи исходного JSON text в контентном обработчике.
Всего 802→615 samples с учётом idle, GC, harness и неатрибутированной работы;
это **не процент ускорения**, тем более не edge CPU. JIT, порядок запусков,
GC и распределение native работы меняют выборку.
Безопасная сводка сохранена в [`worker-cpu-evidence-2026-10-18.json`](worker-cpu-evidence-2026-10-18.json).
Полные локальные профили и исходные диагностические данные оставлены
в игнорируемой директории `reports-browser/worker-cpu/`.

## Источник STREAM и изменения кода

`hpack.js` содержит свою копию readable-stream. Её приватный logger
инициализировался через `node:util.debuglog("stream")`. В проверенном workerd
этот logger активен без `NODE_DEBUG`, в отличие от привычного поведения Node.
Вызовы чтения/записи stream порождали форматирование через internal inspect
и сообщения `STREAM:`. У production request `efad...` — 47 логов,
примерно 44 из них `STREAM:`.
См. [workerd debuglog implementation](https://github.com/cloudflare/workerd/blob/main/src/node/internal/debuglog.ts).

В [`runtime-vendor-patches.mjs`](../workers/kinobox-search/runtime-vendor-patches.mjs)
отключён только этот приватный stream logger. Глобальный `node:util`
не модифицируется. Кроме того, четыре TLS trace-вызова теперь проверяют
`traceEnabled !== false` **до** построения аргументов: no-op `trace()`
раньше всё равно вычислял hex каждого переданного буфера. Custom-клиент
явно устанавливает `traceEnabled: false`. Opt-in vendor tracing сохраняется.

[`prepare-vendor.mjs`](../workers/kinobox-search/prepare-vendor.mjs)
применяет адаптации воспроизводимо: проверяет исходный hash, точное
однократное совпадение каждого patch target и итоговый hash из manifest.
Изменение vendor приводит к ошибке сборки, а не к молча пропущенному патчу.

В custom-клиенте убраны промежуточное копирование входящего chunk при
конкатенации и повторное копирование каждого DATA frame. Owned входные
байты сохраняются; тесты проверяют fragmentation и мутацию caller buffer.
В `serveKinoboxContent()` UTF-8 декодируется один раз, JSON валидируется,
в ответ и кеш идёт исходный text без повторного `JSON.stringify(data)`.
Это также сохраняет большие числовые литералы и формат provider JSON.

AIA fetch использует поддерживаемый Workers `redirect: "manual"`;
3xx отклоняются через `!response.ok`. Прежнее `redirect: "error"`
не поддерживается проверенным runtime. Allowlist issuer `.lencr.org`,
5-секундный timeout и предел 64 KiB сохранены.

Сохранены `verifyServerCertificate: true`, TLS 1.3, ALPN h2,
фиксированный `api.kinobox.tv:443`, scoped trust store, входная валидация,
CORS, авторизация, upstream rate budget, общий deadline и размеры ответов.
Это сохранение существующих ограничений, а не полный аудит TLS-библиотеки.

## Проверка нативного Workers fetch

В отдельном edge preview, colo PRG, проверены те же три публичных GET:
search «Матрица», players `kinopoisk=301&title=Матрица`, movie `301`.

| Вариант                                              | search | players | movie | JSON    |
| ---------------------------------------------------- | -----: | ------: | ----: | ------- |
| fetch, те же UA / Referer / Accept / Accept-Encoding |    520 |     520 |   520 | нет     |
| fetch, Accept-Encoding: identity                     |    520 |     520 |   520 | нет     |
| fetch, минимальный Accept: application/json          |    520 |     520 |   520 | нет     |
| custom TLS 1.3 + h2 после патча                      |    200 |     200 |   200 | валиден |

Исходные ответы fetch были HTML либо коротким не-JSON error body. Custom
ответы: search 27 101 байт, players 13 010, movie 3 496; hashes совпали
с успешными локальными ответами.

User-Agent, Referer и Accept можно задать в Workers fetch. Управление
TLS ClientHello fingerprint и принудительным upstream ALPN этот API не
предоставляет. **Причина 520 не доказана:** это может быть fingerprint,
ALPN, upstream rule или особенности сетевого пути. Проверка из одного
colo не доказывает поведение всех colo. Прозрачная замена транспорта
сейчас нарушит работоспособность и поэтому не внесена.

## Кеш, freshness и всплески

Cache API локален дата-центру. Локальная `Map` leases действует только
в одном isolate. Одинаковые ключи из разных colo/isolate могут независимо
создать холодные TLS-сессии; это не глобальный distributed lock.

| Параметр                    | Значение                            |
| --------------------------- | ----------------------------------- |
| search fresh                | 600 с                               |
| players fresh               | 60 с                                |
| movie fresh                 | 21 600 с (6 часов)                  |
| movie stale                 | максимум 48 часов с успешной записи |
| transient/invalid cooldown  | 30 с                                |
| lease                       | 20 с; максимум 256 активных ключей  |
| ожидание холодного follower | до 20 × 500 мс                      |

Stale используется только для movie, при конкурентном обновлении,
transient ошибке или отсутствии upstream budget. Search/players stale
не введён. TTL не увеличены: у player URL и каталога есть требования
к актуальности, увеличение требует отдельного продуктового решения.
Нельзя обеспечить холодный запрос ≤10 мс одним увеличением hit ratio.

Оценки завершённых `public_cache` логов за 12:00–14:31 UTC:

| Kind    | MISS | HIT | BACKOFF | STALE | HIT / (HIT + MISS) |
| ------- | ---: | --: | ------: | ----: | -----------------: |
| search  | 1545 | 112 |      16 |     0 |               6,8% |
| players | 1072 | 297 |      13 |     0 |              21,7% |
| movie   | 1271 | 253 |     135 |     1 |              16,6% |

Это adaptive sampled оценки завершённых логов; они пропускают часть
CPU-прерываний. Sampling Logs 100% не отключает sampling аналитического
запроса. Таблица не является точным hit ratio всего production трафика.

В локальных детерминированных тестах:

- 16 warm запросов: 0 новых upstream calls; независимые response bodies.
- 16 одновременных cold запросов одного ключа: 1 upstream call для каждого из трёх маршрутов.
- 8 разных cold ключей: 8 calls; разные title/query сохраняют отдельные ключи.
- 8 запросов с upstream 403/404: 8 calls, отрицательного кеша нет.
- При отказе cache.put: 8 calls на 8 запросов, сохранено существующее поведение с обращением к upstream.
- Follower ограничен 10 секундами и максимум 43 cache reads для movie; transient retry блокируется на 30 секунд.

Cache key включает origin, Worker version, канонический path и валидированные
параметры; пользовательский `ts` не участвует. Production счетчик физических
TCP connections не измерялся: число calls в тестах и структура клиента
подтверждают число Kinobox connections, а Cloudflare subrequests могут также
включать AIA fetch и потому не равны этому числу.

Внесены проверки владения lease перед записью fresh/stale/retry и удалением
stale. Истёкший владелец не должен перезаписывать ответ нового владельца.
Это best effort перед Cache API I/O, а не атомарное distributed fencing:
между проверкой и завершением cache.put/delete остаётся асинхронная граница.

404, `isSuccess: false`, неверный JSON/schema/encoding удаляют старый movie
stale. Invalid retry marker проверяется до выдачи stale. После ожидания
upstream/budget stale перечитывается, чтобы не вернуть истёкший или уже
удалённый Response snapshot. Эти изменения защищают корректность кеша;
они не являются доказанным снижением CPU.

## Edge before/after без изменения production

Временно созданы два отдельных Worker с fixed-route harness, теми же
`compatibility_date=2026-10-05` и `nodejs_compat`. Harness использовал реальный
`serveKinoboxContent`, transport и public budget с отдельными namespaces.
У него не было production routes, D1, auth secrets или bindings. Вход
защищался случайным диагностическим ключом; ключ и raw headers не включены
в репозиторий. Это тест контентного пути, а не полная копия production.

- До: `reyohoho-cpu-audit-before-20261018`, версия `4b042957-23e8-47d9-b9ab-053d0e1aa502`.
- После: `reyohoho-cpu-audit-after-20261018`, версия `a7884a5e-c58e-472b-a3ab-27cd31635f3f`.

Исходный вариант собран из HEAD `aca0441d3` и исходных pinned vendor;
исправленный — из локального патча. Последовательные чередующиеся GET
создавали новые ключи, затем повторяли их для HIT. За два прогона
(15:49:38–15:49:56 и 15:54:12–15:54:28 UTC) выполнено 192 запроса:
по 48 MISS и 48 HIT на вариант. **192/192 HTTP 200**, JSON валиден,
хеши всех 96 соответствующих before/after пар совпали.

CPU получен из live tail `cpuTime`, в мс. Во втором прогоне удалось
сопоставить по ray/request ID только **36 из 96** ответов: tail остановили
до полного сброса буфера. Ниже только эта неполная выборка из PRG;
nearest-rank P99 при n=13 совпадает с максимумом и не является оценкой
стабильного production P99.

| Вариант | Cache |   n | P50, мс | P90, мс | P99 / max, мс | Диапазон, мс |    STREAM логов |
| ------- | ----- | --: | ------: | ------: | ------------: | ------------ | --------------: |
| До      | MISS  |  13 |      26 |      35 |            41 | 19–41        | 572 (44/запрос) |
| После   | MISS  |  13 |      35 |      39 |            56 | 25–56        |               0 |
| До      | HIT   |   5 |       0 |       1 |             1 | 0–1          |               0 |
| После   | HIT   |   5 |       1 |       1 |             1 | 1–1          |               0 |

Все 36 tail events имеют outcome `ok`, без `exceededCpu`. Это короткая
проверка функциональности, а не доказательство устранения production
ошибок: успешные запросы с CPU >10 мс уже встречались в production.
Возможность временно пройти с превышением не гарантирует бюджет Free.
Наблюдаемый after CPU выше before; выборка мала, поэтому установить
причину этой разницы и устойчивую регрессию нельзя. **Доказательства
снижения общего edge CPU нет.**

Ещё один отдельно пойманный after players MISS: 46 мс CPU, wall 204 мс,
200, 2 лога, STREAM 0. Не включён в matched таблицу. Adaptive GraphQL
агрегаты малой выборки не подменяют эти per-request замеры. Финальный
дополнительный прогон с неверным CLI sampling-rate получил 48 HTTP 200,
но 0 tail events; он исключён из CPU-сравнения. Flamegraph API новых
Workers вернул «No recent executions» и не дал дополнительного профиля.

Оба временных Worker удалены после измерений; local workerd и remote preview
остановлены. Read-only проверка Cloudflare API в 16:06:26 UTC подтвердила
удаление временных Workers и прежнюю production version с распределением 100%.
**Production метрик «после» нет**, поскольку патч туда не деплоился.

## Проверки и воспроизведение

```powershell
node workers/kinobox-search/prepare-vendor.mjs
node node_modules/vitest/vitest.mjs run workers/kinobox-search --reporter=dot --silent=passed-only
npx --yes wrangler@4.150.0 deploy --dry-run --config workers/kinobox-search/wrangler.jsonc --outdir reports-browser/worker-cpu/dry-run
node scripts/profile-kinobox-transport.mjs --mode=offline --iterations=30 --inspect-profile=off
```

Результат: **11 test files, 127 tests passed**. Transport tests проверяют
fixed host, TLS verification и h2 для всех трёх маршрутов, fragmentation,
мутацию input buffer, 1 MiB и превышение на байт, ограничения headers/frames,
CONTINUATION, RST/GOAWAY, push/padding, upstream status, timeout с закрытием,
неверный ALPN и AIA allowlist/redirect/64 KiB. Content tests проверяют
HIT/MISS, независимый CORS, burst, budget, invalid/transient ответы, timeout,
backoff, stale TTL, lease races и сохранение исходного JSON. Существующие
auth/account/history/CORS/budget suites также прошли.
Полный запуск `node node_modules/vitest/vitest.mjs run --reporter=dot --silent=passed-only`
после добавления vendor preparation в CI: **92 test files, 615 tests passed**.
Есть предупреждения об отсутствии исходных `.map` у скачанных vendor,
deprecated Buffer внутри HPACK и extensionless Vite config import; падений нет.

Dry-run Wrangler 4.150.0 успешен, upload 742,47 KiB / gzip 170,79 KiB.
`--dry-run` не меняет production. Реальное восстановление pinned vendor
через prepare-vendor и сверка адаптированных hashes выполнены. CI workflows
`quality.yaml` и `github.yaml` подготавливают pinned vendor перед тестами:
эти generated модули игнорируются Git и отсутствуют на чистом checkout.

[`scripts/profile-kinobox-transport.mjs`](../scripts/profile-kinobox-transport.mjs)
по умолчанию работает offline, без внешних зависимостей, credentials и
записи файлов. Opt-in режимы fetch/native-http2/vendored/compare ограничены
фиксированным origin и 1–3 последовательными GET на transport, без retries.
Node CPU и inspector здесь только диагностические: они не моделируют edge
CPU, ALPN/fingerprint или стоимость Cloudflare log ingestion. В Node
vendored TLS handshake проходил, но полный HTTP/2 запрос завершался
RST_STREAM 1; это не засчитывается как успешный Worker transport.

## Компромиссы и следующий шаг

Патч сохраняет upstream совместимость и убирает доказанно лишние пути
работы. Риски: адаптации привязаны к pinned minified vendor и требуют
пересмотра при обновлении; приватная STREAM диагностика отключена;
ответы теперь сохраняют исходное форматирование JSON и числовые литералы;
дополнительные cache проверки могут добавлять I/O при ошибках. Снижение
ошибок или общего CPU этим патчем не подтверждено.

Оставаться на Free при неизменном custom handshake **как на надёжно
укладывающемся в 10 мс решении сейчас нельзя**. Это вывод о проверенной
реализации, а не доказательство невозможности любой реализации TLS:
после удаления отладки MISS всё ещё 25–56 мс, и профили показывают
сохранившуюся X.509/crypto работу. Кеширование только разобранного X.509
по точному DER — возможный следующий эксперимент, но без измерений
оно не гарантирует 10 мс и не должно отключать validity, chain или
CertificateVerify checks. Второй Free Worker с тем же TLS не решает проблему.

Практические варианты:

1. Получить совместимый доступ к upstream через native Workers fetch: согласовать upstream rule/официальный endpoint, затем повторить проверку JSON и ошибок из нескольких colo. Сейчас замена заблокирована результатом 520.
2. Вынести custom transport в отдельный сервис с достаточным CPU. Worker оставляет CORS, auth, input validation, cache и rate budget; сервис принимает только три фиксированных маршрута, требует авторизацию Worker→service, проверяет сертификаты и соблюдает response/deadline limits. Серверный native HTTP/2 с pooling может использоваться только после проверки upstream совместимости. Это архитектурный вариант; такой сервис в рамках патча не создан и не деплоился.
3. Использовать Workers Paid с измеренным CPU budget для текущего транспорта. Тариф и лимиты не менялись; это эксплуатационный вариант, а не оптимизация кода.

После выбора транспорта или тарифа критерий приёмки остаётся прежним:
достаточная выборка HIT/MISS и параллельных запросов, per-route CPU
P50/P90/P99, `exceededCpu`, HTTP success rate и число upstream attempts.
Публикация патча в production требует отдельного подтверждения пользователя
и сама по себе этот критерий не выполняет.
