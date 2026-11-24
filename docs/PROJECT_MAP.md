# Карта проекта ReYohoho

> Практическая карта репозитория для разработчиков и ИИ-агентов. Сверено с кодом 2026-11-24
> (ветка аудита 2026-11-21). Связанные документы: [cloudflare-site.md](cloudflare-site.md)
> (хостинг сайта), [worker-telegram.md](worker-telegram.md) (вход и D1),
> [cloud-history.md](cloud-history.md) (история и мост переноса), [release.md](release.md)
> (порядок релиза), [cache-policy.md](cache-policy.md).

## 1. Кратко

ReYohoho — Vue-приложение для поиска фильмов и сериалов, просмотра карточек и выбора внешнего
iframe-плеера. Production состоит из трёх частей:

- **статический сайт** (vite-ssg + PWA), собирается `yarn build:github`;
- **API Worker** `workers/kinobox-search` на `https://api.reyhoho.fun`: каталог
  (Kinopoisk, kinoapi), Telegram-вход, аккаунт, списки и история в D1 (`HISTORY_DB`);
- **site Worker** `workers/site` (Workers Static Assets) — плановый хостинг `reyhoho.fun`
  с security headers и маршрутизацией фильмов; сейчас сайт публикуется на GitHub Pages.

Python `backend/` — прототип для VPS, в production не используется (раздел 9).

| Сценарий | Frontend | Worker и внешние зависимости |
|---|---|---|
| Поиск | `MovieSearch.vue` → `src/api/movies.js` | `GET /api/movies/search/` → Kinopoisk |
| Карточка | `MovieInfo.vue` | `GET /api/movies/<id>` → Kinopoisk; `movieExtras.js` → kinoapi |
| Топ и новинки | `TopMovies.vue`, `MovieSearch.vue` | `/api/kinopoisk/top`, `/api/kinoapi/latest` |
| Просмотр | `PlayerComponent.vue`, `usePlayerSources.js` | DDBB Live ↔ DDBB (выбранный источник первым) |
| Вход | `Login.vue` → `AuthSuccess.vue` | `/api/auth/*`, Telegram bot, D1 `tg_login`/`tg_sessions`/`tg_users` |
| Списки и профиль | `UserLists.vue`, `User.vue`, `MovieList/` | `/api/user`, `/api/list/*`, `/api/user-list/*` |
| История | `cloudHistory.js`, `historyOutbox.js` | `/api/history*`, D1 `user_history` |

Комментариев, оценок, таймингов, уведомлений и Shikimori во frontend нет.

## 2. Стек

| Область | Технологии |
|---|---|
| Frontend | Vue 3, Vue Router, Pinia + persisted state; `src/main.js` |
| Сборка | Vite, vite-ssg, `vite-plugin-pwa`; `vite.config.js`, `scripts/postbuild-gh-pages.js` |
| Workers | Cloudflare Workers, D1, Cache API, Rate Limiting bindings; `wrangler.jsonc` в каждом Worker |
| Тесты | Vitest (colocated `*.spec.js`, включая Worker), Playwright browser checks в `scripts/` |
| Качество | ESLint (`src workers shared scripts migration`), encoding check, `check:release` |
| CI/CD | GitHub Actions: `quality.yaml`, `github.yaml` (GitHub Pages) |

TypeScript нет, typecheck не выполняется.

## 3. Архитектура

```text
Browser / PWA
  ├─ Vue routes, Pinia persisted state (настройки, локальные списки/история, плеер, сессия)
  └─ src/api/movies.js → providerRegistry (worker | ddbb | ddbb_live)
       ├─ movies.worker.js ───► API Worker (WORKER_API_URL из src/api/workerOrigin.js)
       │                          ├─ каталог: Kinopoisk, kinoapi
       │                          │   └─ upstream-guard: circuit breaker, общий бюджет
       │                          ├─ /api/auth/*, /api/user, /api/list*, /api/history* → D1
       │                          ├─ /api/health (контракт и миграция D1), /api/csp-report
       │                          └─ per-IP бюджет, Cache API
       └─ movies.ddbb.js, movies.ddbb-live.js ──► внешние player index
```

`src/api/workerOrigin.js` задаёт origin Worker (`VITE_WORKER_API_URL`, по умолчанию
`https://api.reyhoho.fun`); его используют `workerAccount.js`, `cloudHistory.js` и
`movies.worker.js`. Bearer-токен отправляется только на этот origin.

## 4. Директории

| Путь | Назначение | Менять осторожно | Проверки |
|---|---|---|---|
| `src/components/` | Route-страницы и UI | player iframe/overlay, история, auth redirect | component specs, lint, build |
| `src/api/` | Facade `movies.js`, адаптеры, аккаунт, история | порядок fallback, origin Worker, формы ответов | `movies*.spec.js`, `providerRegistry.spec.js`, `workerOrigin.spec.js` |
| `src/store/` | Pinia: main, player, auth, background, theme, trailer | persisted keys и миграции гидрации | `store/**/*.spec.js` |
| `src/composables/` | плеер, layout, подтверждения, уведомления UI | cleanup listeners/timers | colocated specs |
| `src/router/` | routes, auth guard, SEO slug redirect, analytics | route names | `router/*.spec.js`, `main.spec.js` |
| `src/utils/` | сессия, SEO, локальные списки, outbox, `ssgState.js`, `playerSecurity.js` | auth/session, sandbox | `*.spec.js` |
| `shared/` | нормализация истории и карточек (общая с мостом) | `history-data.js` копируется в мост вручную | `shared/*.spec.js`, bridge spec |
| `workers/kinobox-search/` | API Worker и миграции D1 | auth, CORS, лимиты | Worker specs, `wrangler deploy --dry-run` |
| `workers/site/` | site Worker: роутинг и заголовки | `generated/` создаёт postbuild | `router.spec.js`, dry-run |
| `migration/history-transfer/` | мост переноса со старого origin | публикуется из отдельного репозитория | bridge spec |
| `scripts/` | SEO, postbuild, security headers, release check, browser checks | generated outputs | script specs |
| `src/data/`, `public/` | SEO-каталог, sitemap, иконки, `_headers` (cache rules) | только через генераторы | SEO specs, build |
| `backend/` | VPS-прототип, не production | — | pytest/ruff, вне основного гейта |

## 5. Frontend

### Entrypoints, SSG и PWA

- `src/main.js` — `ViteSSG`, routes, PWA, theme init, восстановление SSG state
  (`restoreSsgState()` до чтения `window.__INITIAL_STATE__`).
- `vite.config.js` — PWA/workbox, chunks, `ssgOptions.onPageRendered` переносит state в
  `<script type="application/json" id="ssg-state">` (`src/utils/ssgState.js`), чтобы в HTML
  остались только хэшируемые inline-скрипты.
- `scripts/postbuild-gh-pages.js` — 404-страница, `dist/_headers` (security + cache rules) и
  `workers/site/generated/site-meta.json` (`{headers, movies}`).
- `scripts/site-security.js` — хэши inline-скриптов (не больше 8), CSP (пока report-only),
  остальные security headers.

SSG-код должен быть SSR-safe. Страницы фильмов prerenderятся при `VITE_PRERENDER_MOVIE_PAGES=true`.

### Router

| Route | Component | Особенности |
|---|---|---|
| `/` | `MovieSearch.vue` | поиск, топ, новинки, история |
| `/top` | `TopMovies.vue` | популярное |
| `/movie/:kp_id/:slug?` | `MovieInfo.vue` | canonical slug redirect |
| `/settings` | `Settings.vue` | UI, плеер, синхронизация истории, перенос |
| `/login`, `/auth-success` | `Login.vue`, `AuthSuccess.vue` | Telegram-вход, синхронизация после входа |
| `/user`, `/lists/:user_id?` | `User.vue`, `UserLists.vue` | профиль, свои и публичные списки |
| `/contact`, catch-all | `ContactsPage.vue`, `NotFound.vue` | статика и 404 |

Старые `/shiki/*` и `/movie/shiki<id>/*` ведут на NotFound.

### API и fallback

- `providerRegistry.js` — lazy-импорт `worker`, `ddbb`, `ddbb_live`; `PLAYER_SOURCES` — выбор в настройках.
- Поиск и карточки — всегда Worker (`searchProviderOrder.js`, `contentProviderOrder.js`).
- Плееры — цепочка из двух источников: выбранный (по умолчанию DDBB Live), затем второй;
  8 с на источник, второй стартует через 2 с ожидания, `mergePlayerMaps()` убирает дубли.
- `workerAccount.js`, `user.js` — аккаунт и списки; `cloudHistory.js` — история;
  `listMetadata.js` — дозагрузка метаданных (не больше 60 за загрузку).

### Основные потоки

- **Карточка:** `MovieInfo.vue` загружает данные, обновляет SEO/фон, локальную и облачную историю,
  затем лениво монтирует `PlayerComponent`.
- **Плеер:** `usePlayerSources.js` загружает карту, сохранённый источник выбирается только после
  успешной загрузки iframe. Sandbox включается по `VITE_PLAYER_IFRAME_SANDBOX` или для origins из
  `VITE_PLAYER_SANDBOX_ORIGINS` (`getPlayerIframeSandbox`).
- **Вход:** `Login.vue` получает одноразовый токен и опрашивает Worker; бот присылает уведомление о
  входе с кнопками отзыва сессии. Redirect идёт через `utils/authRedirect.js`.
- **История:** изменения сначала в `historyOutbox.js`, затем в Worker; подробности в
  [cloud-history.md](cloud-history.md). Статусы просмотра (watching/completed/abandoned)
  взаимоисключающие.

## 6. API Worker

| Путь | Назначение | Auth |
|---|---|---|
| `GET /api/movies/search/?query=` | поиск | нет |
| `GET /api/movies/<id>` | карточка | нет |
| `GET /api/players` | выведен из работы: всегда `410 Gone` | нет |
| `GET /api/kinopoisk/top`, `/api/kinoapi/latest`, `/api/movies/<id>/extras` | топ, новинки, доп. данные | нет |
| `GET /api/health` | версия, `apiContract`, последняя миграция D1, `schemaReady` | нет |
| `POST /api/csp-report` | приём CSP-отчётов (логируются только origin и path) | нет |
| `/api/auth/telegram-login-token`, `check-telegram-auth`, `telegram-webhook`, `logout` | вход | webhook secret / сессия |
| `/api/user`, `/api/user/name`, `/api/list*`, `/api/user-list*`, `/api/notifications*` | аккаунт и списки (D1 `account_lists`) | сессия |
| `/api/history*` | облачная история | сессия |

Защита: allowlist Origin (`localhost:5173` только при `ALLOW_DEV_ORIGINS=true`, то есть в
staging), per-IP бюджет, `ACCOUNT_RATE_LIMITER`, `UPSTREAM_RATE_LIMITER`, circuit breaker на
upstream (`upstream-guard.mjs`). Миграции D1 —
`workers/kinobox-search/migrations/0001…0005`. Подробнее — README Worker и
[worker-telegram.md](worker-telegram.md).

Устаревшая ветка: `history.mjs` всё ещё принимает внешние токены через `HISTORY_AUTH_USER_URL`
(прежний backend); её удаление ждёт решения H-03.

## 7. Безопасность

- Сессия Worker хранится в localStorage (Pinia persist); XSS может её прочитать. Переход на
  HttpOnly cookie запланирован (P3).
- CSP публикуется как `Content-Security-Policy-Report-Only`; enforce — после разбора отчётов.
- `src/utils/playerSecurity.js` классифицирует origins плееров; sandbox раскатывается по
  провайдерам. Same-origin overlay-код требует доступа к DOM плеера.
- `htmlSanitizer.js` (DOMPurify) используется для toast-сообщений.
- Security review обязателен для `workerOrigin.js`, auth store/utils, `PlayerComponent.vue`,
  `playerSecurity.js`, CORS и auth в Worker, `site-security.js`.

## 8. Тесты, сборка, CI

```powershell
yarn.cmd lint
yarn.cmd check:encoding
yarn.cmd check:release
yarn.cmd test:unit --run
yarn.cmd build:github          # с VITE_PRERENDER_MOVIE_PAGES=true для prerender фильмов
node scripts/browser-artifact-check.js dist
```

Под Node 26 тестам нужен `NODE_OPTIONS=--no-experimental-webstorage` (скрипт `test:unit` его
задаёт). Browser checks (`scripts/browser-*.js`) используют локальный fixture
`frontend-profile-server.js` и не ходят во внешние сервисы.

- `quality.yaml` — lint, encoding, тесты, сборка, `check:release`, `wrangler deploy --dry-run`
  обоих Workers; actions закреплены по SHA.
- `github.yaml` — сборка и публикация на GitHub Pages, еженедельное обновление SEO
  (`ALLOW_STALE_SEO` / input `allow_stale_seo`), live-проверка `check-release --live` перед
  публикацией.
- Порядок релиза: миграция D1 → API Worker → frontend ([release.md](release.md)).
- `Dockerfile.dev` и `docker-compose.yml` — только для разработки.

Переменные frontend: `VITE_WORKER_API_URL`, `VITE_WORKER_AUTH_ENABLED`, `VITE_BASE_URL`,
`VITE_SITE_ORIGIN`, `VITE_PRERENDER_MOVIE_PAGES`, `VITE_REVIEWED_PLAYER_ORIGINS`,
`VITE_PLAYER_IFRAME_SANDBOX`, `VITE_PLAYER_SANDBOX_ORIGINS`, URL player index. Полный список:
`rg 'import.meta.env' src`.

## 9. Python backend (VPS-прототип)

`backend/` (Sanic, SQLAlchemy, Alembic) — прототип для размещения на VPS. Frontend к нему не
обращается, в production не развёртывается и в аудиты не входит. Документация:
[backend/IMPLEMENTATION_GUIDE.md](../backend/IMPLEMENTATION_GUIDE.md), OpenAPI — `/openapi.json`
самого backend. Проверки: `uv run ruff check backend`,
`uv run pytest backend/tests -q`.

## 10. Generated code

| Путь | Источник | Правило |
|---|---|---|
| `src/data/movies.json` | `yarn seo:fetch` / еженедельный CI | отдельный commit |
| `public/sitemap.xml`, `public/robots.txt` | `yarn seo:assets` | не смешивать с runtime |
| `public/icons/*` | `yarn icons*` | отдельный commit |
| `dist/`, `workers/site/generated/` | build/postbuild | не коммитить |
| `workers/kinobox-search/vendor-*.mjs` | `prepare-vendor.mjs` | не редактировать вручную |
| `yarn.lock` | Yarn | только dependency-коммиты |

## 11. Правила для агентов

1. `git status --short --branch`; не трогать чужие изменения.
2. Сверять docs с кодом: маршруты — `src/router/routes.js` и `workers/kinobox-search/worker.mjs`.
3. Сохранять формы ответов API, имена маршрутов, props/events и persisted keys без
   согласованной миграции.
4. Новая миграция D1 — новый файл и обновление `release.json`; применённые не менять.
5. Не логировать токены, Telegram payload и секреты.
6. Не делать `git push` и deploy без явной команды в текущем разговоре.
7. Conventional Commits; рефакторинг отдельно от изменения поведения; generated-файлы отдельно.
