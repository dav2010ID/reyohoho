# Аудит ReYohoho

Дата снимка: 2026-07-09.

## Область проверки

Проверены Vue/Pinia frontend, Sanic/SQLAlchemy backend, миграции, интеграции с внешними
провайдерами, Docker-конфигурация, GitHub/GitLab CI, тесты и зависимости. Исследовательский
GraphQL-корпус оценивался как входные данные backend, а не как вручную поддерживаемый код.

Контрольная линия до аудиторских правок:

- frontend: 18 файлов тестов, 80 тестов;
- backend: 25 тестов;
- ESLint, проверка кодировки и production build проходили;
- `pip-audit` не нашёл известных уязвимостей в Python-зависимостях;
- Yarn audit находил 3 critical, 55 high, 59 moderate и 6 low advisories.

Финальная линия после безопасных исправлений:

- frontend: 18 файлов тестов, 82 теста; ESLint, проверка кодировки и production build проходят;
- backend: 28 тестов; Ruff и `compileall` проходят (остаётся сторонний deprecation warning
  `websockets.legacy`);
- `yarn audit --groups dependencies`: 0 известных уязвимостей во всех категориях;
- `uvx pip-audit -r backend/requirements.txt`: 0 известных уязвимостей;
- оба CI YAML-файла проходят синтаксический разбор;
- semantic-проверка `docker compose config` не выполнена: Docker CLI отсутствует в среде аудита.

## Архитектурная оценка

Frontend разделён на API-адаптеры, Pinia stores, composables и Vue-компоненты. Это позволяет
переключать источники контента, но `src/api/movies.js` одновременно отвечает за выбор провайдера,
fallback-цепочки, нормализацию и объединение плееров. Крупные экранные компоненты продолжают
содержать слишком много UI-, network- и media-логики.

Backend состоит из основного Sanic-приложения, persistent API blueprints, SQLAlchemy-моделей и
адаптеров внешних сервисов. Асинхронный HTTP-клиент и request-scoped DB sessions выбраны правильно,
валидация и разграничение прав присутствуют. Главные ограничения — process-local state, крупный
`kinoserver.py`, N+1-запросы при сериализации таймингов и неограниченный рост событий просмотров.

## Риски, требующие отдельного решения

Эти изменения не внесены автоматически, потому что могут изменить доступность провайдеров,
контракты API, авторизацию или эксплуатационную модель.

| Приоритет | Проблема | Доказательство | Последствие | Рекомендация |
| --- | --- | --- | --- | --- |
| High | Отключена проверка TLS для Kinobox и Alloha | `backend/kinoserver.py`, вызовы с `ssl=False` | MITM может подменить JSON/iframe; токен Alloha передаётся в query | Исправить цепочку CA или отключать проблемный provider; не использовать `ssl=False` |
| High | Docker Compose запускается с известными dev-секретами | `docker-compose.yml`, defaults для `POSTGRES_PASSWORD` и `JWT_SECRET` | При публикации compose можно подделывать JWT и подключаться к БД известным паролем | Для production требовать переменные через `${VAR:?message}` и ставить `APP_ENV=production` |
| High | Внешние iframe не имеют sandbox/allowlist | `src/components/PlayerComponent.vue` | Недоверенный provider получает широкие browser-возможности | Ввести allowlist `https` origins и подобрать минимальный `sandbox`; проверить каждый player |
| High | JWT живёт 30 дней и сохраняется в localStorage | `backend/config.py`, `src/store/auth/auth.js` | XSS получает долгоживущий bearer token, сервер не умеет отзывать сессии | Короткий access token, refresh rotation, `jti`/revocation и HttpOnly cookie после миграции контракта |
| Medium | Rate limiting и cache process-local при двух workers | `backend/routes_core.py`, `backend/kinoserver.py`, `backend/Dockerfile` | Лимиты обходятся между workers, cache и Twitch token дублируются | Redis-backed limiter/cache или один worker до внедрения shared state |
| Medium | Каждое открытие фильма создаёт `ViewEvent` | `backend/routes_external.py` | Неограниченный рост таблицы и легко накручиваемый top | Агрегировать по временному bucket, дедуплицировать и ввести retention |
| Medium | Сериализация каждого тайминга выполняет несколько запросов | `backend/routes_social.py:126`, `backend/routes_external.py:69` | Латентность растёт линейно и создаёт N+1 нагрузку | Одним batch-query получить users, votes и counts, затем сериализовать в памяти |
| Medium | Комментарии и пользовательские списки возвращаются без pagination | `backend/routes_social.py:62`, `backend/routes_core.py:143` | Большие ответы, память и долгие запросы | Добавить cursor pagination с временным compatibility-режимом |
| Medium | Notifications API пока является заглушкой | `backend/routes_core.py:265` | UI получает успешные ответы без реального хранения | Либо реализовать модель/миграцию, либо явно вернуть `501 NOT_IMPLEMENTED` после согласования |
| Medium | Remote Config управляет URL, куда отправляется bearer token | `src/api/axios.js:18` | Ошибка конфигурации или компрометация Firebase меняет auth trust boundary | Проверять endpoint по allowlist перед добавлением Authorization |
| Medium | Python requirements задают широкие диапазоны без lock/hashes | `backend/requirements.txt` | Docker build не полностью воспроизводим | Генерировать проверяемый constraints/lock и обновлять отдельным dependency workflow |

## Поддерживаемость и производительность

- `src/components/MovieInfo.vue` превышает 6 000 строк, `PlayerComponent.vue` — 2 500 строк,
  `backend/kinoserver.py` — около 2 000 строк. Их следует делить по ответственности, сохраняя
  существующие публичные props/routes.
- Анализ дублирования нашёл 83 clone-группы (около 1.5% строк). Самые практичные кандидаты:
  общая нормализация DDBB/Kinobox, HTTP JSON helpers и повторяющиеся modal/comment styles.
- `src/api/movies.js` объединяет provider registry, fallback policy и response normalization;
  отдельный provider orchestrator упростит тестирование отказов.
- Backend содержит два settings-объекта (`backend/config.py` и `backend/kinoserver.py`), что создаёт
  риск разных defaults в одной программе.
- GraphQL-корпус содержит сотни generated files. Нужны версия источника, команда регенерации и
  проверка diff, иначе schema drift трудно рецензировать.
- Текущий warm-cache path быстрый; дальнейшая оптимизация должна быть направлена на cold external
  calls и batch enrichment, а не на ещё один локальный cache layer.

## Безопасные изменения, внесённые по итогам аудита

- Обновлены frontend-зависимости и точечно закреплены patched transitive versions. После обновления
  `yarn audit --groups dependencies` сообщает 0 известных advisories; остаётся peer warning
  `vite-ssg` / `@unhead/dom`, не являющийся найденной уязвимостью.
- Docker context исключает `.env`, локальные БД, Git metadata, dependency/build caches и логи.
- In-memory rate limiter периодически удаляет истёкшие ключи, не меняя лимиты и окна.
- Stale cache не запускает несколько одинаковых background refresh для одного ключа.
- Локальное зеркало списков восстанавливается после повреждённых данных и не блокирует server sync,
  если localStorage недоступен или переполнен.
- Health-check всегда освобождает abort timer; local API requests имеют конечный timeout.
- Persistent frontend-запросы используют централизованный backend selector и в режиме `auto` не
  обращаются сначала к localhost.
- Player teardown очищает глобальные callbacks и overlay timers.
- Удалены два неиспользуемых Python-import.
- Добавлен общий GitHub quality workflow; GitLab Pages использует Yarn lockfile и те же frontend
  проверки.
- Локальные profiling JSON и Python tool caches исключены из Git.

## Наибольший эффект при минимальных затратах

1. Обязательные production secrets и `APP_ENV=production` в production deployment.
2. Удаление `ssl=False` после настройки доверенного TLS для провайдеров.
3. Pagination для comments/lists и batch-сериализация timings.
4. Shared limiter/cache перед горизонтальным масштабированием backend.
5. Выделение provider orchestration из `movies.js` и разбиение двух крупнейших Vue-компонентов.

Пункты 1–4 должны выполняться отдельными изменениями с migration/rollout plan, потому что они
могут повлиять на запуск, API-ответы или доступность плееров.
