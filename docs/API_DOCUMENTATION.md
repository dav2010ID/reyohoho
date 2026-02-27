# API документация проекта ReYohoho

## 1) Базовый API backend

- HTTP-клиент: `axios` через [`src/api/axios.js`](../src/api/axios.js)
- Базовый URL берется динамически:
  - сначала из Firebase Remote Config (`api_endpoints`),
  - если не удалось, используется `VITE_APP_API_URL`.
- Fallback в текущем `.env`: `https://api4.rhserv.vu`
- Если есть токен, добавляется заголовок `Authorization: Bearer <token>`.

## 2) Проверка доступности API

Источник: [`src/store/api/index.js`](../src/store/api/index.js)

- `GET {endpoint}/health` - проверка доступности каждого endpoint из Remote Config.
- Timeout проверки: 5 секунд.

## 3) REST-эндпоинты backend

Ниже перечислены относительные пути, которые вызываются через выбранный `baseURL`.

### 3.1 Movies API (`src/api/movies.js`)

- `GET /search/{searchTerm}`
- `GET /shiki_info/{shikiId}`
- `GET /kp_info2/{kpId}`
- `POST /cache` (form-data: `kinopoisk`, `type=movie`)
- `POST /cache_shiki` (form-data: `shikimori`, `type=anime`)
- `GET /top/{activeTime}?type={typeFilter}[&limit={limit}]`
- `GET /discussed/{type}`
- `GET /get_dons`
- `GET /imdb_to_kp/{imdb_id}`
- `GET /imdb_parental_guide/{imdb_id}`
- `GET /shiki_to_kp/{shiki_id}`
- `GET /rating/{kpId}`
- `POST /rating/{kpId}` body: `{ rating }`
- `GET /comments/{movieId}`
- `POST /comments/{movieId}` body: `{ content, parent_id }`
- `PUT /comments/{commentId}` body: `{ content }`
- `DELETE /comments/{commentId}`
- `POST /comments/{commentId}/rate` body: `{ rating }`
- `POST /timings/{kpId}` body: `{ timing_text }`
- `PUT /timings/{timingId}` body: `{ timing_text }`
- `DELETE /timings/{timingId}`
- `POST /timings/{timingId}/report` body: `{ report_text }`
- `GET /timings/top`
- `GET /timings/all`
- `GET /chance`
- `POST /timings/submission/{submissionId}/approve`
- `POST /timings/submission/{submissionId}/reject`
- `POST /timings/submission/{submissionId}/clean_text`
- `GET /twitch/{username}`
- `POST /timings/{timingId}/vote` body: `{ vote_type }`
- `GET /timings/{timingId}/vote`
- `GET /movies/{kpId}/note`
- `POST /movies/{kpId}/note` body: `{ note_text }`
- `DELETE /movies/{kpId}/note`

### 3.2 User API (`src/api/user.js`)

- `PUT /list/{type}/{id}`
- `DELETE /list/{type}/{id}`
- `DELETE /list/{type}`
- `GET /list/{type}`
- `GET /user-list/{userId}/{type}`
- `GET /user-list-counters/{userId}`
- `GET /user`
- `GET /auth/telegram-login-token`
- `GET /auth/check-telegram-auth?token={token}`
- `PUT /user/name` body: `{ name }`

### 3.3 Emotes API (`src/api/emotes.js`)

- `GET /search_emotes/{query}`

### 3.4 Notifications API (`src/api/notifications.js`)

- `GET /notifications`
- `GET /notifications/unread-count`
- `POST /notifications/mark-read` body: `{ notification_ids }`
- `DELETE /notifications/{notificationId}`

## 4) Внешние сетевые интеграции (не основной backend API)

### 4.1 Firebase Remote Config

Источник: [`src/firebase/firebase.js`](../src/firebase/firebase.js)

- Инициализация Firebase приложения.
- Запрос Remote Config через `fetchAndActivate`.
- Ключи конфигурации:
  - `api_endpoints`
  - `load_script`

### 4.2 Условная загрузка внешних скриптов

Источник: [`index.html`](../index.html)

При `load_script === 'true'`:
- загружается `https://myroledance.com/services/?id=172633`
- затем динамически подключается `https://js11.${efe3584080_domain}/js/customs/efe3584080.js?...`

### 4.3 Прямой `fetch` к YouTube preview

Источник: [`src/components/TrailerCarousel.vue`](../src/components/TrailerCarousel.vue)

- `GET https://img.youtube.com/vi/{videoId}/0.jpg`

## 5) Важные замечания

- В [`src/components/ErrorMessage.vue`](../src/components/ErrorMessage.vue) есть ссылка на статус:
  - `http://38.180.83.227:8080/status/reyohoho`
  - это `href`, не автоматический API-вызов.
- В проекте есть внешние ссылки (Twitch, IMDb, Кинопоиск, Google Translate и т.д.), но они в основном используются как переходы пользователя, а не как программные REST-запросы через `fetch/axios`.
