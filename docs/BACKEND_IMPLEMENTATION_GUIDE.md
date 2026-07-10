# Реализация backend API для ReYohoho

Этот документ описывает назначение маршрутов, ожидаемые контракты и рекомендуемую реализацию. Он составлен по фактическим вызовам в `src/api/movies.rhserv.js`, `src/api/user.js` и использующим их Vue-компонентам.

## 1. Что уже есть

В `backend/kinoserver.py` находится основное Sanic-приложение, HTTP-клиент, TTL-кеш, CORS,
Swagger UI и catalog/provider routes. Persistent API подключается через `backend/api.py` и
blueprints `routes_core.py`, `routes_social.py`, `routes_external.py`: реализованы пользователи и
авторизация, списки, рейтинги, комментарии, CRUD/модерация таймингов, голоса, заметки и внешние
интеграции. Notifications API пока остаётся совместимой заглушкой без хранения.

`backend/backend.py` — отдельный FastAPI-адаптер Kinopoisk GraphQL. Не следует запускать оба файла как два независимых публичных backend. Практичнее оставить Sanic главным приложением, а функции GraphQL импортировать как внутренний provider.

`backend` является источником рабочего runtime-кода. `graphql_extracted` — исследовательский
снимок схемы, операций и ранних adapter-прототипов; файлы в этих каталогах уже не являются
точными копиями и не должны синхронизироваться вручную.

## 2. Общая архитектура

Разделите приложение на слои:

```text
HTTP route -> validation/auth -> service -> repository/provider -> DB/external API
```

Рекомендуемая структура:

```text
backend/
  app.py
  config.py
  auth.py
  errors.py
  db.py
  models/
  repositories/
  routes/
    catalog.py
    ratings.py
    comments.py
    timings.py
    users.py
    auth.py
  services/
    kinopoisk.py
    shikimori.py
    imdb.py
    telegram.py
    twitch.py
  migrations/
```

Для production используйте PostgreSQL и асинхронный SQLAlchemy. SQLite допустим только для локальной разработки. Добавьте в зависимости `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt` и `pydantic`.

Sanic поддерживает Pydantic-валидацию через `@validate(json=Model)`. Подключение БД создавайте в lifecycle listener, а сессию передавайте через `request.ctx`. Для API задайте `app.config.FALLBACK_ERROR_FORMAT = "json"`.

### 2.1 Единый формат ошибок

```json
{
  "error": {
    "code": "COMMENT_NOT_FOUND",
    "message": "Комментарий не найден",
    "details": null
  }
}
```

Используйте статусы: `400` — неверный ввод, `401` — нет/невалиден токен, `403` — недостаточно прав, `404` — сущность не найдена, `409` — конфликт, `422` — ошибка валидации, `429` — rate limit, `502/503` — внешний provider недоступен.

### 2.2 Авторизация

Фронтенд автоматически отправляет `Authorization: Bearer <token>`. Middleware должен:

1. извлечь Bearer token;
2. проверить подпись, `exp`, `iss` и `aud` JWT;
3. загрузить пользователя;
4. записать его в `request.ctx.user`;
5. для публичных маршрутов разрешить `user = None`, для защищённых вернуть `401`.

JWT должен содержать только идентификатор пользователя и служебные claims. Роли и блокировки нужно каждый раз проверять по БД. Для токенов задайте срок жизни; при необходимости добавьте refresh-token отдельным этапом.

## 3. Таблицы базы данных

Минимальная схема:

- `users`: `id`, `telegram_id UNIQUE`, `name`, `photo`, `role`, `allow_comments`, `created_at`, `updated_at`;
- `telegram_login_sessions`: `token_hash UNIQUE`, `status`, `user_id`, `expires_at`, `consumed_at`;
- `movies`: `kp_id PRIMARY KEY`, `shiki_id`, `imdb_id`, `type`, `metadata JSONB`, `updated_at`;
- `user_lists`: `user_id`, `content_type`, `content_id`, `list_type`, `created_at`, UNIQUE по `(user_id, content_type, content_id, list_type)`;
- `ratings`: `user_id`, `kp_id`, `rating`, `created_at`, `updated_at`, UNIQUE по `(user_id, kp_id)`;
- `comments`: `id`, `movie_id`, `user_id`, `parent_id`, `content`, `is_deleted`, `created_at`, `updated_at`;
- `comment_votes`: `comment_id`, `user_id`, `rating`, UNIQUE по `(comment_id, user_id)`;
- `timing_submissions`: `id`, `kp_id`, `user_id`, `timing_text`, `status`, `moderator_id`, `moderated_at`, `created_at`, `updated_at`;
- `timing_reports`: `id`, `timing_id`, `user_id`, `report_text`, `status`, `created_at`;
- `timing_votes`: `timing_id`, `user_id`, `vote_type`, UNIQUE по `(timing_id, user_id)`;
- `movie_notes`: `user_id`, `kp_id`, `note_text`, `created_at`, `updated_at`, UNIQUE по `(user_id, kp_id)`.

Индексы обязательны для `comments(movie_id, created_at)`, `timing_submissions(kp_id, status)`, `user_lists(user_id, list_type)`, `ratings(kp_id)` и всех внешних ключей.

## 4. Каталог и внешние источники

### `GET /search/{searchTerm}`

Назначение: поиск фильма, сериала или аниме для поискового окна.

Реализация:

1. URL-декодировать строку, обрезать пробелы, ограничить 2–100 символами.
2. Если строка похожа на Kinopoisk ID, сначала выполнить точный поиск.
3. Иначе вызвать Kinopoisk provider; при необходимости объединить с Shikimori.
4. Нормализовать все источники в единый массив и убрать дубликаты по `id`.
5. Кешировать запрос на 5–15 минут.

Ответ — массив объектов:

```json
[{"id":301,"title":"Матрица","year":"1999","poster":"https://...","average_rating":8.5,"raw_data":{"film_id":301,"type":"FILM","genres":[{"genre":"фантастика"}]}}]
```

Всегда возвращайте массив; отсутствие результатов — `200 []`, а не `404`. В path необходимо передавать `encodeURIComponent(searchTerm)` на клиенте; безопаснее в будущем перейти на `/search?q=...`.

### `GET /kp_info2/{kpId}`

Назначение: полная карточка контента. Реализация уже есть через Kinopoisk REST/GraphQL.

Проверьте числовой `kpId`, загрузите основную карточку, а дополнительные независимые данные (`similars`, `videos`, `staff`, ratings) — параллельно. Частичный сбой вторичного запроса не должен ломать основную карточку. Кеш: 6–24 часа.

Критичные поля для фронтенда: `kinopoisk_id`, `imdb_id`, `name_ru`, `name_original`, `poster_url`, `description`, `year`, `type`, `serial`, `rating_kinopoisk`, `rating_imdb`, `genres`, `countries`, `staff`, `videos`, `similars`, `nudity_timings`, `lists`.

Если пользователь авторизован, `lists` должен отражать его списки. Альтернатива — получать списки отдельно, но тогда требуется изменить фронтенд.

### `GET /shiki_info/{shikiId}`

Назначение: карточка аниме по Shikimori ID. Запросите Shikimori API, преобразуйте поля в тот же формат, что и `kp_info2`, добавьте `shikimori_id` и найденный `kinopoisk_id`. Кеш: 6–24 часа. При отсутствии записи — `404`.

### `POST /cache` и `POST /cache_shiki`

Несмотря на название, эти маршруты возвращают набор доступных плееров; кеш — внутренняя оптимизация.

- `/cache`: form-urlencoded поля `kinopoisk=<id>&type=movie`;
- `/cache_shiki`: `shikimori=<id>&type=anime`.

Фронтенд фактически отправляет `application/x-www-form-urlencoded`, а не multipart form-data. Sanic читает значения через `request.form`. Проверяйте допустимый `type`, запускайте providers параллельно с короткими timeout, исключайте неработающие iframe и кешируйте результат на несколько минут.

Ответ:

```json
{"KODIK>1":{"iframe":"https://...","translate":"Дубляж","quality":"1080p","source":"kodik","warning":false}}
```

Не возвращайте токены providers или внутренние диагностические данные.

### `GET /top/{activeTime}?type={typeFilter}&limit={limit}&page={page}`

Назначение: главная подборка. Хотя исходный список не упоминает `page`, фронтенд уже умеет его отправлять.

- `activeTime`: поддержите `24h`, `week`, `month`, `all`;
- `type`: `all`, `movie`, `series`, при необходимости `anime`;
- `limit`: 1–100;
- `page`: от 1.

Текущая заглушка игнорирует `activeTime` и `page`. Для корректного top храните события просмотра/открытия карточек и агрегируйте их за период. Если источником остаётся внешняя коллекция Kinopoisk, явно считайте маршрут «популярным Kinopoisk», а не локальным top за период.

### `GET /discussed/{type}`

Назначение: фильмы с активным обсуждением. `type` может быть `hot`, `new` или согласованный фильтр контента. Запрос должен агрегировать `comments` по `movie_id`, учитывать период и сортировать по числу комментариев/уникальных авторов с затуханием по времени. Подтяните metadata фильмов пакетно, без N+1 запросов. Поддержите `page` и `limit`.

### `GET /get_dons`

Назначение: список донатеров. Текущий фронтенд принимает ответ без преобразования, а заглушка возвращает plain text. Зафиксируйте один формат. Для обратной совместимости оставьте `text/plain` со строками, но предпочтительный новый ответ: `{"donors":[{"name":"...","amount":null}]}`.

### `GET /imdb_to_kp/{imdb_id}` и `GET /shiki_to_kp/{shiki_id}`

Назначение: разрешение внешнего ID в Kinopoisk ID. Нормализуйте IMDb к `tt` + цифры. Ищите сначала в локальной таблице `movies`, затем во внешнем API, после чего сохраняйте mapping.

Успех: `{"kinopoisk_id":"301"}`. Не найдено: `404` с нормализованной ошибкой.

### `GET /imdb_parental_guide/{imdb_id}`

Назначение: получить сведения Parents Guide, используемые рядом с таймингами нежелательных сцен. Не следует строить production-интеграцию на HTML scraping IMDb: разметка и правила доступа нестабильны. Используйте лицензированный API или собственную модерируемую таблицу. Ответ должен быть структурированным, например `{"nudity":{"severity":"moderate","items":[...]},"source":"...","updated_at":"..."}`. Кешируйте надолго.

### `GET /chance`

Назначение: случайный фильм. Не используйте `ORDER BY random()` на большой таблице. Выбирайте случайный ID из заранее сформированной eligible-выборки или top collection. Ответ должен иметь формат полной карточки или SearchItem — фронтенд необходимо проверить на один фиксированный вариант. Текущий каркас возвращает карточку.

### `GET /twitch/{username}`

Назначение: информация о пользователе и текущем стриме. Backend должен получить app access token Twitch, кешировать его, вызвать Helix Users и Streams, затем вернуть:

```json
{"username":"name","user_info":{"id":"...","display_name":"...","profile_image_url":"..."},"stream_data":[{"title":"...","viewer_count":10,"thumbnail_url":"..."}]}
```

Токен Twitch хранится только на сервере. Отсутствие активного стрима — `stream_data: []`.

## 5. Рейтинги

### `GET /rating/{kpId}`

Публичный маршрут с optional auth. Верните среднее и количество голосов для всех, а `user_rating` — только для текущего пользователя:

```json
{"user_rating":8,"average_rating":7.6,"vote_count":125}
```

### `POST /rating/{kpId}`

Защищённый маршрут. `{ "rating": 1..10 }` создаёт/обновляет оценку; `{ "rating": null }` удаляет её — именно так работает `MovieRating.vue`. Выполните upsert/delete в транзакции. Среднее не принимайте от клиента, вычисляйте SQL-агрегацией. Ответ может совпадать с GET.

## 6. Комментарии

### Контракт комментария

```json
{
  "id": 10,
  "movie_id": "301",
  "user_id": 5,
  "parent_id": null,
  "name": "User",
  "user_avatar": "/media/avatar.jpg",
  "user_movie_rating": 8,
  "content": "Текст",
  "rating": 3,
  "user_rating": 1,
  "is_deleted": false,
  "created_at": "2026-06-22T10:00:00Z",
  "updated_at": "2026-06-22T10:00:00Z",
  "replies": []
}
```

### Маршруты

- `GET /comments/{movieId}` — публичный, возвращает массив корневых комментариев с вложенным `replies`. Ограничьте глубину одним уровнем или собирайте дерево безопасно; добавьте pagination при росте данных.
- `POST /comments/{movieId}` — auth, `{content, parent_id}`. Текст после trim: 1–1500 символов. Проверить `allow_comments`; `parent_id` должен относиться к тому же фильму.
- `PUT /comments/{commentId}` — auth, только автор или moderator; обновляет текст и `updated_at`.
- `DELETE /comments/{commentId}` — auth, soft delete. Не удаляйте строку физически, иначе сломается дерево ответов.
- `POST /comments/{commentId}/rate` — auth. Рекомендуемые значения `-1`, `1`, а повтор того же значения удаляет голос. Upsert должен быть атомарным.

Не доверяйте BBCode/HTML клиента: храните исходный безопасный текст и санитизируйте вывод. Ограничьте частоту создания комментариев и голосов.

## 7. Тайминги и модерация

Статусы: `pending`, `approved`, `rejected`, `clean_text`. Переходы статусов выполняются только сервером. `clean_text` означает подтверждение отсутствия сцен, а не произвольную строку.

Контракт timing, который ожидает `MovieInfo.vue`:

```json
{"id":12,"kp_id":"301","user_id":5,"username":"User","user_timing_count":4,"timing_text":"00:10:20-00:11:05","status":"approved","upvotes":3,"downvotes":1,"voteScore":2,"userVote":"upvote","created_at":"2026-06-22T10:00:00Z"}
```

Обратите внимание: отдельные vote endpoints используют snake_case (`vote_score`, `user_vote`), а объект timing во фронтенде — camelCase (`voteScore`, `userVote`). Для нового backend лучше вернуть оба поля временно или нормализовать фронтенд в одном месте.

### CRUD

- `POST /timings/{kpId}` — auth; создать `pending`, проверить формат и длину `timing_text`.
- `PUT /timings/{timingId}` — auth; автор может менять свой pending/approved timing, после существенного изменения статус лучше вернуть в `pending`; moderator может менять любой.
- `DELETE /timings/{timingId}` — автор или moderator; soft delete или audit log.
- `POST /timings/{timingId}/report` — auth; `{report_text}` 3–1000 символов, одна открытая жалоба пользователя на timing.

Проверяйте формат диапазонов сервером: начало меньше конца, значения не отрицательны, диапазоны не перекрываются некорректно и по возможности не выходят за длительность фильма.

### Голоса

- `POST /timings/{timingId}/vote` — auth; `vote_type` только `upvote|downvote`; повторный одинаковый голос снимает его, противоположный заменяет.
- `GET /timings/{timingId}/vote` — optional auth; `{"upvotes":3,"downvotes":1,"vote_score":2,"user_vote":"upvote"}`.

Обе операции агрегации выполняйте одной SQL-командой/транзакцией, чтобы избежать гонок.

### Списки и модерация

- `GET /timings/top` — публичный; фронтенд ожидает объект `{"submissions":[...]}`, а не текущий `[]`. Это leaderboard авторов, например `user_id`, `username`, `approved_count`.
- `GET /timings/all` — только moderator/admin; фронтенд ожидает `{"timings":[...]}`. Добавьте query `status`, `page`, `limit`.
- `POST /timings/submission/{id}/approve` — moderator, перевод `pending -> approved`.
- `POST /timings/submission/{id}/reject` — moderator, перевод `pending -> rejected`.
- `POST /timings/submission/{id}/clean_text` — moderator, перевод `pending -> clean_text`.

Используйте условный UPDATE `WHERE id=:id AND status='pending'`; если строк не обновлено, верните `409`. Сохраняйте moderator и время решения.

## 8. Личные заметки

- `GET /movies/{kpId}/note` — auth; `{"note": null}` или `{"note":{"kp_id":"301","note_text":"...","updated_at":"..."}}`.
- `POST /movies/{kpId}/note` — auth; upsert `{note_text}`, после trim 1–10000 символов; ответ `{"note": {...}}`.
- `DELETE /movies/{kpId}/note` — auth; idempotent, `204` или `200 {"deleted":true}`.

Заметки строго приватны: во всех запросах условие должно включать `user_id` из JWT, никогда из body/query.

## 9. Пользовательские списки

Допустимые `type`: `favorite`, `later`, `watching`, `completed`, `abandoned`, `history`, `rated`.

- `PUT /list/{type}/{id}` — auth, idempotent upsert. Для обычного списка добавляет content; взаимоисключающие статусы (`watching/completed/abandoned`) лучше переносить атомарно. `rated` формируется из ratings и не должен редактироваться этим маршрутом.
- `DELETE /list/{type}/{id}` — auth, idempotent delete.
- `DELETE /list/{type}` — auth; запретить `rated`, для остальных удалить список текущего пользователя в транзакции.
- `GET /list/{type}` — auth, список текущего пользователя.
- `GET /user-list/{userId}/{type}` — публичный профиль; приватные типы (`history`) не отдавать чужому пользователю.
- `GET /user-list-counters/{userId}` — объект вида `{"favorite":3,"later":8,"watching":1,"completed":10,"abandoned":2,"rated":7,"history":20}` с теми же privacy-правилами.

GET списков должен возвращать массив SearchItem/карточек, поскольку фронтенд передаёт ответ в `normalizeMovieListResponse`. Чтобы избежать N+1, metadata фильма храните локально в `movies.metadata` и обновляйте лениво.

Идентификатор `id` сейчас не содержит provider. Если в списках могут быть Shikimori-only записи, храните ещё `content_type` (`movie|anime`) и определите, какой ID возвращается фронтенду.

## 10. Пользователь и Telegram login

### `GET /user`

Auth required. Ответ минимум:

```json
{"id":5,"telegram_id":123456,"name":"User","photo":"/media/avatar.jpg","role":"user","allow_comments":1}
```

Не возвращайте служебные данные Telegram, token hash или права, не нужные UI.

### `PUT /user/name`

Auth required. `{name}` после trim: 2–50 символов. Запретите control characters и при необходимости зарезервированные имена. Верните обновлённого пользователя или `{"name":"..."}`.

### `GET /auth/telegram-login-token`

Создайте криптографически случайный одноразовый token, сохраните только его hash со сроком 5–10 минут и верните:

```json
{"token":"opaque-token","telegram_link":"https://t.me/your_bot?start=opaque-token","expires_in":600}
```

### `GET /auth/check-telegram-auth?token=...`

Фронтенд опрашивает маршрут каждые 2 секунды. До подтверждения верните `{"authenticated":false}`. После `/start <token>` Telegram bot связывает session с `telegram_id`, создаёт/обновляет пользователя. Первый успешный poll атомарно помечает session consumed и возвращает `{"authenticated":true,"token":"JWT"}`.

Требования безопасности:

- token минимум 256 бит entropy, короткий TTL и одноразовое использование;
- хранить hash, сравнивать constant-time;
- rate limit по IP и token;
- Telegram webhook проверять через secret token;
- не помещать JWT в Telegram URL;
- после consumed/expired не выдавать JWT повторно.

Текущий клиент создаёт бесконечный `setInterval`; желательно добавить остановку после expiry/unmount, но backend всё равно обязан ограничивать polling.

## 11. Публичные и защищённые маршруты

Публичные: health, search, карточки, top/discussed, mappings, parental guide, chance, donations, Twitch, GET comments, GET rating, GET timing votes, публичные user lists.

Auth required: изменение рейтинга, комментариев и таймингов, reports/votes, notes, собственные lists, `/user`, смена имени.

Moderator/admin: все timing moderation endpoints и `/timings/all`. Проверку роли выполняйте на backend; скрытая кнопка во фронтенде не является защитой.

## 12. Порядок реализации

1. Вынести существующие catalog routes из монолитного `kinoserver.py`, не меняя ответы.
2. Подключить PostgreSQL, Alembic, единые ошибки и auth middleware.
3. Реализовать Telegram login и `/user`; без этого нельзя корректно тестировать остальные защищённые функции.
4. Реализовать ratings, lists и notes как простые независимые CRUD-модули.
5. Реализовать comments с soft delete и votes.
6. Реализовать timings, reports, votes и state machine модерации.
7. Заменить заглушки discussed/top submitters/Twitch/parental guide.
8. Расширить OpenAPI реальными response schemas, добавить integration tests и rate limits.

Для каждого маршрута нужны тесты: успешный сценарий, validation error, anonymous access, forbidden чужая запись, not found, повторная idempotent операция и конкурентный upsert/vote.

## 13. Критические замечания

- Извлечённый Kinopoisk GraphQL — внутренний, недокументированный интерфейс. Он может измениться без предупреждения и может иметь ограничения использования. Изолируйте его за provider-интерфейсом и предусмотрите официальный источник/fallback.
- `activeTime` в текущем `/top` не работает семантически: параметр удаляется, затем всегда запрашивается одна коллекция Kinopoisk.
- `/discussed` сейчас просто возвращает top, `/twitch` и timing endpoints — заглушки.
- `POST /cache*` — URL-encoded form, не настоящий multipart form-data.
- Нельзя хранить пользовательские данные только в in-memory TTLCache: после рестарта они исчезнут, а несколько workers будут видеть разное состояние.
- В production CORS не должен отражать произвольный Origin. Задайте явный список доменов frontend.
