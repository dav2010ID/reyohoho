# Карта проекта ReYohoho

> Практическая карта репозитория для разработчиков и ИИ-агентов. Состояние кода проверено
> 2026-07-13. Детальные контракты API находятся в [API_DOCUMENTATION.md](API_DOCUMENTATION.md),
> история рисков — в [CODE_AUDIT.md](CODE_AUDIT.md), а backend-инструкции — в
> [BACKEND_IMPLEMENTATION_GUIDE.md](BACKEND_IMPLEMENTATION_GUIDE.md).

## 1. Краткое описание проекта

ReYohoho — Vue-приложение для поиска фильмов, сериалов и аниме, просмотра карточек и выбора
внешнего iframe-плеера. Авторизованные через Telegram пользователи могут хранить списки и историю,
ставить оценки, писать комментарии, отправлять и модерировать тайминги, сохранять приватные заметки.
Frontend может переключаться между несколькими источниками каталога и плееров; локальный Sanic
backend одновременно проксирует внешние providers и хранит пользовательские данные.

| Пользовательский сценарий | Frontend | Backend и внешние зависимости |
|---|---|---|
| Поиск | `src/components/MovieSearch.vue` → `src/api/movies.js` | `/search/*`; RHServ, local, KinoBD, Kinobox fallback |
| Карточка фильма | `MovieInfo.vue`, `MovieInfoShiki.vue` | `/kp_info2/*`, `/shiki_info/*`; Kinopoisk GraphQL/Tech API, Shikimori |
| Просмотр | `PlayerComponent.vue`, `composables/usePlayerSources.js` | `/cache`, `/cache_shiki`; DDBB, Kinobox, Kodik и другие player providers |
| Telegram-вход | `Login.vue` → `AuthSuccess.vue` | `/auth/telegram-*`; `telegram_login_sessions`, JWT |
| Списки и профиль | `UserLists.vue`, `User.vue`, `MovieList/` | `/list/*`, `/user-list/*`, `/user`; `users`, `user_lists`, `movies` |
| Социальные функции | `Comments.vue`, `MovieRating.vue`, timing UI в `MovieInfo.vue` | `routes_social.py`, `routes_core.py`; comments, votes, ratings, timings |
| Top/discussed | `TopMovies.vue`, `MovieSearch.vue` | `/top/*`, `/discussed/*`; `view_events`, comments и provider fallback |

## 2. Технологический стек

| Область | Технологии и файлы-источники |
|---|---|
| Frontend | Vue 3, Vue Router, Pinia + persisted state, Axios; `package.json`, `src/main.js` |
| Сборка frontend | Vite, ViteSSG, Rollup chunks, `vite-plugin-pwa`; `vite.config.js` |
| Backend | Python 3.13, Sanic 25.x, aiohttp; `backend/kinoserver.py` |
| Adapter | FastAPI/Pydantic adapter для Kinopoisk GraphQL в `backend/backend.py`; не основной runtime |
| База данных | Async SQLAlchemy 2; SQLite по умолчанию локально, PostgreSQL 17 в Compose |
| Миграции | Alembic, `backend/alembic.ini`, `backend/migrations/` |
| Auth | Telegram deep-link/webhook или отдельный long-polling bot; HS256 JWT через PyJWT |
| Providers | Kinopoisk GraphQL/Tech API, Shikimori GraphQL, DDBB, Kinobox, KinoBD, Kodik, Bazon, Collaps, CDNMovies, Alloha, iframe mirrors, TMDb, YouTube, Twitch |
| Frontend tests | Vitest; colocated `*.spec.js` |
| Backend tests | pytest, pytest-asyncio, sanic-testing; `backend/tests/` |
| Quality | ESLint, encoding check, Ruff, compileall, production build |
| CI/CD | GitHub Actions, GitLab Pages, GitHub Pages, Render static site, Vercel rewrite |
| Containers | Frontend dev Dockerfile; backend Dockerfile; PostgreSQL + оба приложения в `docker-compose.yml` |

В проекте нет TypeScript typecheck: frontend написан на JavaScript, а `vuex.d.ts` является старым
declaration-файлом. Отдельного PWA smoke-test в CI нет; PWA формируется как часть production build.

## 3. Высокоуровневая архитектура

```text
Browser / PWA / Electron-like host
  ├─ Vue routes and components
  ├─ Pinia persisted state (settings, local lists/history, player preferences, JWT)
  └─ src/api/movies.js (orchestration) + src/api/axios.js (dynamic backend)
       ├─ third-party frontend APIs: KinoBD / Kinobox / DDBB / DDBB Live
       └─ selected RHServ or local Sanic origin
            ├─ catalog routes → Kinopoisk / Shikimori / player providers
            ├─ persistent blueprints → async SQLAlchemy → SQLite/PostgreSQL
            └─ in-process cache / limiter / Twitch token
```

Основное backend-приложение создаётся в `backend/kinoserver.py:create_app()`. Оно подключает
catalog routes, CORS/lifecycle, затем `configure_persistent_api()` из `backend/api.py`, который
регистрирует database/auth/error middleware и три blueprint: `routes_core`, `routes_social`,
`routes_external`.

Авторизация проходит в `backend/auth.py`: request middleware разбирает Bearer JWT, проверяет
issuer/audience/expiry и загружает `User` в `request.ctx.user`. Frontend выбирает backend через
`src/store/api/index.js` и Firebase Remote Config. Общий клиент `src/api/axios.js` отправляет JWT
только на origin из `src/utils/apiTrust.js`; отдельный `movies.local.js` пока не использует эту
проверку и рассматривается как исключение trust policy.

Нормализация распределена по слоям:

- `src/api/movieSeoNormalizer.js` и provider-specific frontend adapters приводят списки и карточки к UI-формату.
- `src/api/movies.js` оркестрирует fallback и объединяет карты плееров.
- `backend/kinoserver.py` нормализует ответы внешних catalog/player providers.
- `backend/services/shikimori.py` нормализует anime и обогащает Kinopoisk-данные.
- `backend/routes_core.py:list_item()` формирует совместимый объект пользовательского списка.

Пользовательские данные хранятся в БД, кроме локального mirror списков/истории и настроек в Pinia
persist/localStorage. Notifications сейчас не сохраняются: backend возвращает совместимые пустые ответы.

## 4. Карта директорий

| Путь | Назначение и ключевые файлы | Безопасно менять | Менять осторожно | Связанные проверки |
|---|---|---|---|---|
| `src/components/` | Routed pages и UI; крупные узлы `MovieInfo.vue`, `PlayerComponent.vue`, `Comments.vue` | Изолированную разметку/стили при сохранении props/events | player DOM/iframe, history sync, auth redirect, timing UI | соответствующие component/composable specs, lint, build |
| `src/api/` | Backend client, provider adapters и orchestration | Provider-local normalization под контрактными тестами | fallback order, dynamic origin, auth headers, public exports `movies.js` | `axios.spec.js`, `movies*.spec.js`, `providerRegistry.spec.js` |
| `src/store/` | Pinia state, persistence и migrations | Новые неперсистентные поля | persisted keys/defaults и legacy hydration | `store/**/*.spec.js` |
| `src/composables/` | Логика comments/player/layout/scroll/notifications | Локальная декомпозиция с теми же входами/выходами | cleanup listeners/timers, same-origin player hooks | colocated composable specs + build |
| `src/router/` | Routes, auth guard, SEO slug redirect, analytics | Meta title или новая lazy route | route names/paths, catch-all, auth redirect | `src/main.spec.js`, auth redirect specs, build |
| `src/utils/` | Trust, sanitization, dates, SEO, local lists, analytics | Pure helpers с unit tests | `apiTrust.js`, `playerSecurity.js`, auth/session helpers | соответствующие `*.spec.js` |
| `src/firebase/` | Remote Config endpoint discovery | Error handling без смены precedence | allowed hosts и runtime endpoint selection | API-store/axios tests, manual endpoint smoke |
| `src/data/` | SEO/prerender movie catalog | Только через SEO scripts | Ручные большие edits и изменение shape | SEO script specs, build |
| `scripts/` | SEO generation, encoding и browser smoke/perf utilities | Отдельные tooling changes | generated outputs и browser assumptions | script specs, конкретная npm/yarn command |
| `public/` | PWA icons, robots, sitemap, static fallback | Статические assets | сгенерированные sitemap/robots/icons | build, generated diff review |
| `backend/` | Основной server runtime | Изолированные validation/error fixes с pytest | route contracts, provider fallback, auth, DB lifecycle | Ruff, compileall, backend pytest |
| `backend/tests/` | Backend integration/unit tests | Добавление regression tests | Shared fixtures/API assumptions | `python -m pytest backend/tests -q` |
| `backend/migrations/` | Alembic environment и schema history | Новая forward migration | Изменение применённой initial migration, downgrade data loss | migration on empty DB + upgrade existing copy |
| `graphql_extracted/` | Исследовательский/сгенерированный GraphQL corpus | Не менять для runtime-задач | Любое массовое обновление — отдельным generated commit | operation resolution tests, corpus regeneration smoke |
| `docs/` | Audit, API contracts, guides и эта карта | Документация отдельным diff | Не считать docs источником истины без сверки с кодом | links/path check, `git diff --check` |
| `.github/workflows/` | Quality и GitHub Pages deployment | Pin versions/quality commands отдельно | permissions, scheduled bot commit/push, deploy branch | workflow review + CI run |

`src/views/` отсутствует: route components находятся в `src/components/`. `node_modules/`, `dist/`,
Python caches, local logs и local database не являются исходным кодом.

## 5. Frontend architecture

### Entrypoints, SSG и PWA

- `index.html` — HTML shell.
- `src/main.js` — `ViteSSG` entrypoint, routes, app setup, service worker registration, theme init,
  preload-error recovery и optional movie prerender entries.
- `src/App.vue` — корневая оболочка и `router-view`.
- `src/composables/useAppSetup.js` — Pinia, persisted-state plugin и общая client setup.
- `vite.config.js` — PWA manifest/workbox, manual vendor chunks и nested SSG output.
- `scripts/postbuild-gh-pages.js` — static-host fallback после build.

SSG-код обязан быть SSR-safe: прямой доступ к `window`, `document`, `localStorage` допускается только
в client guard/lifecycle. Movie pages prerenderятся только при `VITE_PRERENDER_MOVIE_PAGES=true`.

### Router

| Route | Component | Особенности |
|---|---|---|
| `/` | `MovieSearch.vue` | поиск, top/discussed/history |
| `/top` | `TopMovies.vue` | popular catalog |
| `/movie/:kp_id/:slug?` | `MovieInfo.vue` | canonical SEO slug redirect |
| `/shiki/:shiki_id` | `MovieInfoShiki.vue` | anime flow |
| `/settings` | `Settings.vue` | backend/provider/UI settings |
| `/notifications` | `NotificationsPage.vue` | `requiresAuth`; backend пока stub |
| `/login`, `/auth-success` | `Login.vue`, `AuthSuccess.vue` | Telegram poll и локальный sync после входа |
| `/user`, `/lists/:user_id?` | `User.vue`, `UserLists.vue` | profile и own/public lists |
| `/contact`, catch-all | `ContactsPage.vue`, `NotFound.vue` | static/404 |

`src/router/index.js` устанавливает auth guard, SEO slug redirect, scroll restore, hash handling и
GoatCounter tracking. Не менять route names: они используются в guards и navigation.

### Pinia stores

| Store | Ответственность | Persistence/risk |
|---|---|---|
| `store/main/main.js` | history, comments/UI settings, content/search provider | persisted; есть legacy hydration и 30-day local history cleanup |
| `store/player/player.js` | preferred player, source per movie, aspect/overlay/OBS settings | persisted; OBS password также попадает в local persistence |
| `store/auth/auth.js` | JWT, user, name update | token/user persisted в localStorage через Pinia plugin |
| `store/api/index.js` | backend mode, endpoint health, selected URL | смена URL сбрасывает cached Axios instance |
| `store/notifications.js` | notification loading/count/toasts | server API сейчас возвращает empty stub |
| `store/background/`, `theme.js`, `navbar.js`, `trailer/` | presentation state | проверять SSR и persisted migrations |

### API adapters и fallback

- `src/api/axios.js` — dynamic selected backend, request/response interceptors, trusted-origin JWT policy.
- `src/api/providerRegistry.js` — lazy provider imports и supported-method sets.
- `src/api/movies.js` — stable public facade, fallback orchestration, player aggregation/timeout/analytics.
- `movies.rhserv.js` и `movies.local.js` — одинаковый ReYohoho REST contract, но local adapter имеет
  фиксированный local base URL.
- `movies.kinobd.js`, `movies.kinobox.js`, `movies.ddbb.js`, `movies.ddbb-live.js` — third-party adapters.
- `src/api/user.js`, `notifications.js`, `emotes.js` — persistent/user APIs.

Search order: configured search provider, затем `local → rhserv → kinobd → kinobox` без повторения
configured provider. Movie-info order строится из configured provider и `local/rhserv/kinobox/kinobd`.
Player loading выполняет parallel attempts для configured source и aggregate sources, применяет
15-second provider timeout, затем `mergePlayerMaps()` удаляет duplicate iframe и слабые mirrors при
наличии предпочтительного source.

### Основные frontend flows

- **Movie details:** `MovieInfo.vue:fetchMovieInfo()` вызывает `getKpInfo()`, обновляет SEO/background,
  local/server history, затем lazy-монтирует `PlayerComponent`, comments и timing controls.
- **Player:** `usePlayerSources.js` загружает/нормализует карту, выбирает сохранённый provider только
  после успешного iframe load; `PlayerComponent.vue` ведёт loading/timeout/error analytics и использует
  same-origin DOM access для overlays. Внешний iframe не sandboxed.
- **Comments:** `Comments.vue` использует `useCommentsData` для loading/error/retry и facade
  `movies.js` для CRUD/votes; formatting/actions вынесены в composables.
- **Auth:** `Login.vue` получает one-time token и polling; `AuthSuccess.vue` убирает JWT из URL,
  сохраняет его, получает user и синхронизирует local history/lists. Redirect проходит через
  `utils/authRedirect.js`, который не допускает внешний redirect.
- **Search:** `MovieSearch.vue` управляет query, latest-request protection, fallback API, empty/error
  state, top/discussed infinite loading и random movie.
- **Lists/profile:** local mirror изменяется рядом с REST calls; unauthenticated/network fallback может
  показать local lists. Public history закрыта backend-правилом.

## 6. Backend architecture

### Main application

`backend/kinoserver.py` содержит:

- `Settings` для host/provider/CORS/cache variables;
- process-local `TTLCache` со stale-while-revalidate и per-key locks;
- shared `aiohttp.ClientSession` и cleanup task;
- CORS middleware;
- catalog/player routes и provider normalization;
- импорт функций Kinopoisk GraphQL из `backend/backend.py`;
- подключение persistent API.

Запускать основной backend следует как `python -m backend.kinoserver`. Container запускает Sanic с
двумя workers после `alembic upgrade head`. Из-за process-local cache/limiter/token state workers не
делят эти данные.

### Blueprints and layers

| Файл | Ответственность |
|---|---|
| `backend/api.py` | Composition root persistent API |
| `backend/routes_core.py` | Telegram auth, user, stub notifications, ratings, lists, notes |
| `backend/routes_social.py` | comments, votes, timings, moderation, discussed |
| `backend/routes_external.py` | movie persistence/enrichment, top from ViewEvent, IMDb guide, Twitch |
| `backend/auth.py` | issue/decode JWT, required/moderator decorators |
| `backend/db.py` | async engine lifecycle и request-scoped session |
| `backend/models.py` | SQLAlchemy mapped models; явных ORM relationships нет |
| `backend/errors.py` | normalized API errors |
| `backend/services/shikimori.py` | Shikimori GraphQL enrichment/normalization |
| `backend/services/telegram.py` | completion of one-time Telegram login |
| `backend/telegram_bot.py` | отдельный long-polling process для dev без webhook |

Database session создаётся `open_session` middleware на каждый request и закрывается `on_response`.
Handlers сами вызывают `commit()`/`rollback()`; автоматического commit нет. При добавлении route нельзя
оставлять failed transaction без rollback, если после `IntegrityError` route продолжает использовать session.

### GraphQL/FastAPI adapter

`backend/backend.py` читает operation documents из `graphql_extracted/clean_graphql/queries/query`,
выполняет Kinopoisk GraphQL и строит `FilmResponse`. Его async функции импортируются Sanic provider.
В этом же файле существует отдельный FastAPI `app` с `/health` и `/films/{film_id}`. Deployment его
не запускает; удалять или переносить файл нельзя без замены импортов Sanic и GraphQL tests.

### Cache, limits and background logic

- Catalog/search/player/top cache — in-memory `TTLCache`; limits задаются env.
- Rate limits — in-memory `WindowLimiter` в `routes_core.py`, импортируется social routes.
- Twitch access token — `app.ctx`, то есть process-local.
- Cache cleanup — Sanic background task раз в 60 секунд.
- Telegram long polling — отдельный optional process, не background task web server.
- Scheduled SEO refresh — GitHub Actions weekly job, не backend scheduler.

## 7. API map

Auth: `нет` означает публичный route; `опц.` — Bearer улучшает персонализированный ответ; `да` —
`@auth_required`; `moderator` — роль moderator/admin. Все пути ниже обслуживает основной Sanic app.

### Catalog and external APIs

| Method/path | Назначение | Auth | Frontend caller | Backend owner / риск |
|---|---|---|---|---|
| `GET /health` | health + provider configuration flags | нет | `store/api/index.js` | `kinoserver.py`; не проверяет реальную доступность upstream |
| `GET /openapi.json`, `/docs` | OpenAPI/Swagger | нет | browser/manual | `kinoserver.py`, `openapi.py`; schema сверять с decorators |
| `GET /search/{term}` | catalog search | нет | `movies.rhserv.js`, `movies.local.js` | `kinoserver.py`; provider fallback/cache |
| `GET /kp_info2/{kpId}` | enriched movie; optional `include_players` | нет | те же adapters | `kinoserver.py` + `routes_external.py`; создаёт ViewEvent |
| `GET /kp_info/{kpId}` | legacy movie response | нет | прямой caller не найден | `kinoserver.py`; compatibility route |
| `GET /shiki_info/{id}` | anime details | нет | movie adapters | `kinoserver.py`, Shikimori |
| `GET /shiki_to_kp/{id}`, `/imdb_to_kp/{id}` | ID mappings | нет | movie adapters | mapping сохраняется в `movies` |
| `GET /top/{period}` | top by period/type/page | нет | movie adapters | local ViewEvent first, provider fallback; abuse/growth risk |
| `GET /discussed/{kind}` | discussed by comments | нет | movie adapters | `routes_social.py`; page/limit |
| `GET /chance` | random movie | нет | movie adapters | `kinoserver.py` provider call |
| `GET /get_dons` | donor text | нет | `movies.rhserv.js` | env/default text; legacy contract |
| `GET /trailer/youtube` | trailer search | нет | прямой caller не найден | `kinoserver.py`; token optional |
| `GET /trailer/tmdb/{type}/{id}` | TMDb trailer | нет | прямой caller не найден | `kinoserver.py`; token optional |
| `POST /cache` | player map by Kinopoisk ID, form-urlencoded | нет | movie adapters | `kinoserver.py`; legacy name/contract |
| `GET /players/{kpId}` | player map by Kinopoisk ID | нет | прямой caller не найден | `kinoserver.py`; alternative route |
| `POST /cache_shiki` | anime player map, form-urlencoded | нет | movie adapters | `kinoserver.py` |
| `GET /imdb_parental_guide/{id}` | parental guide | нет | movie adapters | `routes_external.py`; remote URL configurable |
| `GET /twitch/{username}` | Twitch stream info | нет | movie adapters | `routes_external.py`; process-local token |

### Auth, user and lists

| Method/path | Назначение | Auth | Frontend caller | Backend owner / риск |
|---|---|---|---|---|
| `GET /auth/telegram-login-token` | one-time login token/deep link | нет | `api/user.js`, `Login.vue` | `routes_core.py`; IP limiter |
| `GET /auth/check-telegram-auth?token=` | consume session and return JWT | нет | `api/user.js` poller | one-time DB update; token reaches browser query then is removed |
| `POST /auth/telegram-webhook` | Telegram webhook completion | webhook secret | Telegram | secret header; disabled without config |
| `GET /user`, `PUT /user/name` | profile read/update | да | `api/user.js`, profile/auth | name validation; JWT required |
| `GET /notifications*`, `POST .../mark-read`, `DELETE .../{id}` | notification compatibility API | да | `api/notifications.js` | stub only; no model/storage |
| `PUT /list/{type}/{id}` | add/upsert list item + metadata | да | `api/user.js` | exclusive status lists; history timestamp refresh |
| `DELETE /list/{type}/{id}`, `DELETE /list/{type}` | remove/clear | да | `api/user.js` | optimistic frontend rollback must remain |
| `GET /list/{type}` | own list | да | `api/user.js` | optional `page/limit`; no params returns legacy full array |
| `GET /user-list/{userId}/{type}` | public/own list | опц. | `api/user.js` | history private unless same authenticated user |
| `GET /user-list-counters/{userId}` | list counters | опц. | `api/user.js` | hides history for other users |
| `GET/POST/DELETE /movies/{kpId}/note` | private note CRUD | да | movie adapters, `MovieInfo.vue` | max 10,000 chars; user-scoped unique row |

### Ratings, comments and timings

| Method/path | Назначение | Auth | Frontend caller | Backend owner / риск |
|---|---|---|---|---|
| `GET /rating/{kpId}` | aggregate + optional own rating | опц. | movie adapters | `routes_core.py` |
| `POST /rating/{kpId}` | set 1..10 or delete with null | да | movie adapters | unique user/movie upsert |
| `GET /comments/{movieId}` | complete comment tree | опц. | comments flow | no pagination; response growth risk |
| `POST /comments/{movieId}` | create root/reply | да | comments flow | rate limit, max 1500, replies flattened to one level |
| `PUT/DELETE /comments/{commentId}` | edit/soft-delete | да | comments flow | owner or moderator; decorator dispatched internally |
| `POST /comments/{id}/rate` | toggle/change vote | да | comments flow | unique comment/user vote |
| `POST /timings/{kpId}` | submit pending timing | да | timing UI | 10/hour process-local limit |
| `PUT/DELETE /timings/{id}` | edit/soft-delete timing | да | timing UI | owner/moderator state rules |
| `POST /timings/{id}/report` | report timing | да | timing UI | one open report per user/timing |
| `GET/POST /timings/{id}/vote` | get/toggle vote | опц./да | timing UI | `routes_social.py` |
| `GET /timings/top` | top approved submitters | нет | timing UI | aggregate query |
| `GET /timings/all` | moderation queue | moderator | timing UI | page/limit/status, batch serializer |
| `POST /timings/submission/{id}/{action}` | approve/reject/clean_text | moderator | timing UI | atomic pending-state transition |

`src/api/emotes.js` вызывает `GET /search_emotes/{query}`, но такого route в локальном backend нет.
Это контракт внешнего RHServ либо незавершённая локальная функция; перед реализацией требуется проверить
фактический response shape.

## 8. Data flow

| Поток | Frontend entry/store | API/backend/DB/providers | Edge cases |
|---|---|---|---|
| Movie info | route `/movie/*` → `MovieInfo.vue`; main/background/trailer/player stores | `movies.js` → provider adapter → `/kp_info2/*` → `kinoserver.py` → Kinopoisk; `Movie`/`ViewEvent`, Shikimori enrichment | stale request, missing provider fields, anime false-positive fallback, every load records view |
| Player | `PlayerComponent.vue` + `usePlayerSources`, player/main stores | `getPlayers()` → parallel local/DDBB/etc.; local `/cache` → many backend providers | provider timeout, duplicate iframe, external origin, same-origin overlays, no sandbox |
| Auth | `Login.vue`, `AuthSuccess.vue`, auth/main stores | login token/poll/webhook → `TelegramLoginSession`, `User` → JWT | one-time consume, expired token, safe redirect, partial list migration, long-lived local token |
| Comments | `Comments.vue`, `useCommentsData`, auth/main stores | `movies.js` → `/comments/*` → `Comment`, `CommentVote`, `User` | full tree load, soft-deleted parents, auth errors, optimistic UI/retry |
| Timings | timing controls/modals in `MovieInfo.vue` | `/timings/*` → submissions/reports/votes/users | moderation races, parsing text, process-local rate limit, role checks |
| Lists | movie controls, `UserLists.vue`, `MovieList.vue`; local mirror/main store | `api/user.js` → `/list/*` → `UserList`, `Movie`, `Rating` | legacy full array vs optional pagination, offline mirror, private history, optimistic delete rollback |
| History/views | `MovieInfo.vue` updates local/server history | history is `UserList`; anonymous popularity is `ViewEvent` from enrichment | two distinct concepts; ViewEvent lacks visitor dedup/retention |
| Search | `MovieSearch.vue`, main provider settings | `movies.js` sequential fallback → local/RHServ/KinoBD/Kinobox; local backend → Kinopoisk | empty response triggers fallback, provider schemas differ, stale response suppression |

## 9. Security and trust boundaries

### JWT and auth state

- Backend issues HS256 token with `sub`, `iat`, `exp`, `iss`, `aud`; default TTL is 30 days.
- Frontend auth store persists token in localStorage via Pinia persisted state. Any successful XSS can read it.
- `src/api/axios.js` computes the final URL and attaches `Authorization` only when exact origin belongs
  to `VITE_APP_API_URL`, `VITE_LOCAL_API_URL` or `VITE_TRUSTED_API_ORIGINS`.
- Trusted API HTTP is accepted only for loopback; other trusted origins must be HTTPS.
- Dynamic Remote Config endpoint is not automatically trusted. Public requests continue without JWT.
- **Исключение:** local adapter `src/api/movies.local.js` имеет отдельный interceptor и прикрепляет
  JWT к `LOCAL_API_URL` без `isTrustedApiRequest`. Default — loopback, но изменённый
  `VITE_LOCAL_API_URL` должен считаться доверенным только после такой же проверки. До исправления не
  задавать здесь непроверенный origin.

Не переводить auth на cookies, refresh tokens, token revocation или другой issuer без согласованной
миграции frontend/backend/deployment. Не логировать token, Telegram payload или secrets.

### Iframe and HTML

- `src/utils/playerSecurity.js` классифицирует origins как same-origin/reviewed/unreviewed/insecure,
  но это report-only telemetry.
- `<iframe>` в `PlayerComponent.vue` не имеет `sandbox` и не блокирует unreviewed origin.
- Same-origin player необходим текущему overlay-коду: компонент читает video DOM, добавляет controls и
  управляет fullscreen. Глобальный sandbox может сломать этот flow.
- Comments formatting проходит через `src/utils/htmlSanitizer.js`/DOMPurify и formatting composables.
  Любое изменение разрешённых tags/attributes требует XSS tests.
- Provider URLs и iframe normalization являются trust boundary: нельзя слепо переносить raw HTML или
  произвольные URL в DOM.

Security review обязателен для `apiTrust.js`, `axios.js`, `auth.py`, `routes_core.py` auth routes,
`PlayerComponent.vue`, `playerSecurity.js`, HTML sanitizer, CORS defaults, provider TLS и deployment secrets.

## 10. Внешние провайдеры

### Frontend providers

| Provider | Реализация/данные | Normalization/fallback | Known risks and smoke checks |
|---|---|---|---|
| RHServ | `movies.rhserv.js`; полный ReYohoho REST | default generic facade | dynamic origin/JWT trust; smoke search, card, comments/auth separately |
| Local | `movies.local.js`; local Sanic contract | selected explicitly, fallback to RHServ for supported methods | localhost/backend-mode mismatch; test health + auth request |
| KinoBD | `movies.kinobd.js`; search, cards, top, player/source candidates | provider-specific normalization; fallback RHServ | token is client-visible `VITE_*`; smoke title/kp search and playerdata |
| Kinobox | `movies.kinobox.js`; players and search fallback | normalized player/search response | upstream TLS/CORS instability; smoke real response shape |
| DDBB | `movies.ddbb.js`; player index | merged with local and deduplicated | changing response shape/origin; smoke iframe list |
| DDBB Live | `movies.ddbb-live.js`; player index | participates when configured | external availability/CORS; smoke only, no auth headers |

### Backend providers

| Provider/group | Реализация | Output/use | Risk/check |
|---|---|---|---|
| Kinopoisk GraphQL | `backend/backend.py`, GraphQL operations corpus | search/movie details/similars/trailers | operation drift; `test_graphql_provider.py` + live smoke |
| Kinopoisk Tech API | `kinoserver.py` | fallback/search/top/random/mappings | requires token; response normalization/live quota |
| Shikimori GraphQL | `services/shikimori.py` | anime info, mapping/enrichment | title fallback must remain anime-gated; Shikimori tests |
| Player index | DDBB + Kinobox functions in `kinoserver.py` | provider-level iframe entries | Kinobox currently uses `ssl=False`; MITM risk |
| Token player APIs | Kodik, Bazon, Collaps, CDNMovies, Alloha, Befriend | normalized iframe maps | optional tokens, query-secret exposure; Alloha uses `ssl=False` |
| Embed probes | KP mirrors, iframe.video, pleer.video, Videoseed, OBRUT, Militorys | fallback iframe entries | availability/legal/TLS/HTML behavior; mobile/fullscreen smoke |
| Trailers | TMDb, YouTube | trailer metadata | optional credentials, quota |
| Twitch | `routes_external.py` | stream info | token cached per worker |
| Parental guide | configurable upstream URL | JSON guide cached in `Movie` | validate URL/deployment ownership; requires live contract check |

После provider change проверять: timeout, empty response, malformed JSON, duplicate iframe, provider
fallback order, HTTPS origin, desktop/mobile fullscreen и отсутствие secrets в logs/query where avoidable.

## 11. Database map

Явные ORM `relationship()` не заданы; связи выражены foreign keys и route queries.

| Model/table | Ключи и связи | Read/write endpoints | Growth/index notes |
|---|---|---|---|
| `User` / `users` | unique indexed `telegram_id`; role/allow_comments | auth, `/user`, comments/timings ownership | base identity table |
| `TelegramLoginSession` | hashed unique token, optional user FK, expiry | Telegram auth routes | expired rows need periodic cleanup |
| `Movie` / `movies` | PK `kp_id`, unique shiki/imdb IDs, JSON metadata | enrichment, mappings, lists, top/discussed | cache-like persistent metadata; update policy is ad hoc |
| `ViewEvent` / `view_events` | `kp_id`, timestamp; composite created/kp index | write on movie enrichment, read `/top` | fastest unbounded table; no visitor key/dedup/retention |
| `UserList` / `user_lists` | unique user/content/type/list; user/type index | list/history endpoints | can grow per user; compatibility pagination exists |
| `Rating` / `ratings` | unique user/kp; kp index | rating + rated list/counters | bounded by user/movie pairs |
| `Comment` / `comments` | user FK, self parent FK, soft delete; movie/created index | comments/discussed | unpaginated tree; content retained as empty after delete |
| `CommentVote` / `comment_votes` | unique comment/user, cascade comment/user | comment rate/read | grows with engagement |
| `TimingSubmission` | user/moderator FK, status/soft delete; kp/status index | timing CRUD/moderation/top | queue pagination exists; consider status+created index at scale |
| `TimingReport` | timing/user/status unique | report timing | closed/open lifecycle is incomplete in current UI |
| `TimingVote` | unique timing/user, cascades | timing vote/read | grows with engagement |
| `MovieNote` | unique user/kp, cascade user | note CRUD | private text; backup/privacy-sensitive |

Initial migration `20260622_01_initial_schema.py` invokes `Base.metadata.create_all/drop_all`. Не
редактировать её после применения в окружениях: schema changes должны быть новыми Alembic revisions.
Текущая migration не реализует retention jobs.

## 12. Testing map

### Commands

```powershell
# Frontend complete gate
yarn.cmd lint
yarn.cmd check:encoding
yarn.cmd test:unit --run
yarn.cmd build

# Backend complete gate
python -m ruff check backend
python -m compileall -q backend
python -m pytest backend/tests -q

# Migrations/local backend
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.kinoserver
```

`npm.cmd` equivalents допустимы для scripts, но lockfile и CI используют Yarn. Для meaningful local
HTTP timing использовать `127.0.0.1`, не `localhost`.

### Targeted tests

| Изменяемая область | Минимальные tests |
|---|---|
| Axios/API trust/backend selection | `src/api/axios.spec.js`, `utils/apiTrust.spec.js`, `store/api/api.spec.js` |
| Provider registry/player fallback | `providerRegistry.spec.js`, `movies.players.spec.js`, provider-specific spec |
| Player UI/security | `PlayerModal.spec.js`, `playerSecurity.spec.js`, player composable specs, build + browser smoke |
| Comments | `useCommentsData.spec.js`; backend `test_persistent_api.py` comments case |
| Auth redirect/session | `authRedirect.spec.js`, `authSession.spec.js`, `telegramAuthPoller.spec.js`; persistent API auth case |
| Lists/history/persistence | MovieList, localUserLists, main-store persist specs; persistent API list case |
| SEO/SSG | MovieInfo SEO, movieSeo, main specs, SEO script specs, production build |
| Backend cache/providers | TTL cache, player index, GraphQL provider, Shikimori tests |
| Timings | `test_timing_batch.py` + persistent timing state-machine test |
| Rate limits | `test_rate_limiter.py`; multi-worker behavior всё равно не покрыт |

Пробелы: нет E2E auth с реальным Telegram, provider contract tests mostly mocked, нет automated
mobile/fullscreen iframe matrix, PostgreSQL-specific integration job, migration-upgrade test на production-like
snapshot, comment pagination tests (функции пока нет), Docker smoke и PWA offline behavioral test.

## 13. Build, CI and deployment

### Local and production commands

```powershell
yarn.cmd install --frozen-lockfile
yarn.cmd dev
yarn.cmd build
yarn.cmd preview

python -m pip install -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.kinoserver

docker compose up --build
```

`backend/.env.example` — tracked template. Созданный из него `backend/.env` игнорируется Git; не
публиковать его реальные значения.

### Environment contract

Frontend groups: `VITE_APP_API_URL`, `VITE_LOCAL_API_URL`, `VITE_TRUSTED_API_ORIGINS`,
`VITE_ALLOWED_API_HOSTS`, Firebase `VITE_FIREBASE_*`, provider URLs/tokens, `VITE_BASE_URL`,
`VITE_SITE_ORIGIN`, `VITE_PRERENDER_MOVIE_PAGES`, `VITE_REVIEWED_PLAYER_ORIGINS`.

Backend groups: database/JWT (`APP_ENV`, `DATABASE_URL`, `JWT_*`), Telegram (`TELEGRAM_*`), provider
tokens/URLs, CORS (`ALLOWED_ORIGINS`), cache TTL/size, `HOST`, `PORT`, `DEBUG`. Полный factual list
следует получать через `rg 'os.getenv|import.meta.env'`, не копировать секретные значения.

### CI/CD map

- `.github/workflows/quality.yaml`: Node 22 frontend full gate; Python 3.13 Ruff/compileall/pytest.
- `.github/workflows/github.yaml`: build/deploy GitHub Pages on `main`; weekly SEO generation may
  commit and push generated files with bot credentials.
- `.gitlab-ci.yml`: quality + build Pages only for branch `vue`.
- `render.yaml`: static frontend build/publish only.
- `vercel.json`: SPA rewrite only.
- `backend/Dockerfile`: migrations then two-worker Sanic production-like process.
- root `Dockerfile`: frontend Vite dev server, не production static server.
- `docker-compose.yml`: PostgreSQL, backend и frontend dev; содержит dev defaults и не должен
  использоваться как production deployment без hardening.

Без Docker CLI нельзя считать проверенными image build, Compose health/dependency order и PostgreSQL
connectivity. Без production secrets нельзя проверить Telegram webhook, paid providers, CORS allowlist,
Firebase Remote Config rules и provider quotas.

## 14. Generated and third-party code

| Path/output | Source/regeneration | Rule |
|---|---|---|
| `graphql_extracted/` | extracted GraphQL corpus; точная extraction command требует проверки в истории/исходном исследовательском проекте | не редактировать массово вручную; отдельный generated commit |
| `src/data/movies.json` | `yarn seo:fetch` / weekly CI | generated catalog; review size/schema |
| `public/sitemap.xml`, `public/robots.txt` | `yarn seo:assets` or `yarn seo:prepare` | не смешивать с runtime changes |
| root `sitemap.xml` | legacy/static duplicate; active regeneration relationship требует проверки | не синхронизировать вручную без выяснения consumer |
| `public/icons/*.png` | `yarn icons` | generated binary assets отдельным commit |
| `dist/`, service worker/workbox output | `yarn build` | build artifact, не редактировать/не коммитить |
| `node_modules/`, `__pycache__/`, local DB/logs | package/runtime tools | никогда не редактировать и не включать в review |
| `yarn.lock` | Yarn resolver | dependency-only commit; не ручное редактирование |

## 15. Known risks and TODO from audit

Ниже актуальные риски из [CODE_AUDIT.md](CODE_AUDIT.md) и сверки с runtime-кодом. Allowlist общего
Axios-клиента, batch timings и compatibility pagination списков уже реализованы; для JWT остаётся
отдельное исключение local adapter, указанное первым в таблице.

| Priority/problem | Location/danger | Auto-fix? | Safe plan and tests |
|---|---|---|---|
| High: local adapter JWT bypasses common allowlist | `src/api/movies.local.js`; изменённый `VITE_LOCAL_API_URL` получает token без `apiTrust` | да, после regression tests | применить `isTrustedApiRequest` к final URL, удалить stale header; local/HTTPS/untrusted HTTP tests |
| High: `ssl=False` Kinobox/Alloha | `backend/kinoserver.py`; MITM может подменить JSON/iframe | нет, provider may break | выяснить CA issue, report-only/live smoke, затем удалить по provider; fallback tests |
| High: iframe без enforcement | `PlayerComponent.vue`; untrusted browser capabilities | нет | inventory origins/capabilities, profile per provider, report-only, staged sandbox; mobile/fullscreen/overlay tests |
| High: 30-day JWT в localStorage | `config.py`, auth store; XSS/token replay | нет, contract change | short access + refresh rotation + HttpOnly cookie + revocation migration; auth E2E |
| High: Compose dev secrets | `docker-compose.yml`; accidental production compromise | нет для общего dev compose | отдельный production compose, required vars, `APP_ENV=production`; Docker/deploy smoke |
| Medium: process-local state with 2 workers | cache/limiter/Twitch token | нет, architecture/deploy decision | Redis/shared backend or temporarily one worker; concurrency/load tests |
| Medium: unbounded ViewEvent | `routes_external.py`, `models.py` | нет, privacy/analytics decision | choose visitor key, bucket unique index, dual metrics, retention migration/job |
| Medium: comments no pagination | `routes_social.py` | осторожно | cursor over root comments, complete replies, legacy full-array compatibility; tree contract tests |
| Medium: notification stubs | `routes_core.py` | нет, UX/API decision | add model/migration or explicitly return 501 after coordinated frontend rollout |
| Medium: unlocked Python ranges | requirements | осторожно | generate constraints/hashes in dependency-only workflow; build/test images |
| Medium: duplicate backend settings | `config.py`, `kinoserver.py` | осторожно | consolidate one env group at a time with env-contract tests |
| Low: tracked public `VITE_*` env | `.env`; public key confusion/rule abuse | owner/deployment | treat as public, restrict Firebase key/rules; never put server secrets there |

Additional maintainability risk: `MovieInfo.vue`, `PlayerComponent.vue` and `Comments.vue` remain large.
Decompose only along already-tested boundaries (timings, player overlay, comment editor/thread) while
preserving public props/events and separating refactor from behavior changes.

## 16. Agent working guide

### Start here

1. Run `git status --short --branch`; never discard unrelated user changes.
2. Read this file, then the relevant section of `CODE_AUDIT.md`.
3. For frontend contracts read `src/api/movies.js`, target adapter, `src/api/axios.js`, target component
   and its tests. For backend read `kinoserver.py:create_app`, owning route file, model and tests.
4. Confirm routes with decorators and callers with `rg`; docs can be stale.
5. Before provider work inspect both normalization and fallback order. Before DB work inspect migration
   history and SQLite/PostgreSQL compatibility.

### Safe-change rules

- Preserve API response shapes, route names, component props/events and persisted store keys unless the
  owner explicitly approves migration.
- Keep SSR guards around browser globals.
- Never attach JWT to a new origin merely because Remote Config returned it; update explicit allowlist
  only after security review.
- Do not add global iframe sandbox/allowlist enforcement without provider capability matrix and rollout.
- Do not remove `backend/backend.py`: Sanic imports its GraphQL functions.
- Do not edit applied migration; add a revision.
- Do not expose `.env`, tokens, cookies, Telegram payloads or provider credentials in logs/reports.
- Do not run `git push` without an explicit current-conversation command.
- Treat unexpected concurrent file changes as user work; stop only if they conflict directly.

### Verification and report

Run targeted tests during iteration, then the full gate for runtime changes. Documentation-only changes
need encoding/path review and `git diff --check`; runtime build/tests are unnecessary unless docs generation
touches outputs. Provider/deployment work also needs live smoke or must be reported as not verified.

Final report should state: changed behavior, compatibility, risks, tests/commands with results, files,
deferred owner decisions and whether any generated files changed. Do not claim Docker/provider/production
verification if only unit tests passed.

## 17. Recommended commit strategy

- Use Conventional Commits with scope: `fix(frontend):`, `security(frontend):`, `perf(backend):`,
  `refactor(api):`, `test(backend):`, `docs(architecture):`, `chore(deps):`.
- Do not mix frontend and backend unless one atomic contract change requires both; in that case order
  backward-compatible backend first, frontend adoption second, cleanup last.
- Security changes are separate from refactor and provider additions.
- Refactor commits must preserve behavior; behavior changes receive their own commit.
- Tests directly proving a fix belong with that fix. Broad test infrastructure may be separate `test:`.
- Documentation is separate from runtime code unless a tiny contract note is inseparable from the change.
- Generated SEO/GraphQL/icons and lockfile updates are separate from handwritten runtime changes.
- Database order: additive migration → backward-compatible backend → frontend adoption → later cleanup.
- Provider order: contract tests/normalization → adapter → fallback wiring → optional UI/settings.
- Before each commit inspect `git diff --cached --name-only` and `git diff --cached`; never stage the whole
  dirty tree blindly.
