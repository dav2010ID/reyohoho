# Telegram-авторизация на Cloudflare Workers

Worker обслуживает вход через Telegram, профиль, приватные списки и историю в D1.
Комментарии, оценки, заметки, тайминги и модерация остаются в Python backend;
Worker-сессии туда не передаются. Для Worker-аккаунтов комментарии отключены,
уведомления пока пустые.

## Конфигурация и подключение

1. Создать бота через @BotFather. Записать `TELEGRAM_BOT_TOKEN` и
   `TELEGRAM_BOT_USERNAME` в игнорируемый `backend/.env`.
2. Скопировать `workers/kinobox-search/wrangler.jsonc` в
   `workers/kinobox-search/wrangler.local.jsonc`. Локальный файл исключён из Git
   и Docker-контекста. Заполнить `account_id` и `database_id` binding `HISTORY_DB`
   настоящими значениями из Cloudflare; при необходимости изменить имя Worker
   и базы. Шаблон не содержит ID инфраструктуры и имеет выключенную авторизацию.
3. Авторизовать Wrangler: `npx wrangler login`. Для настройки нужны права на
   Workers и D1. Авторизация плагина Cloudflare не заменяет авторизацию CLI.
4. Выполнить `node scripts/configure-worker-telegram.mjs` из корня проекта.

Скрипт проверяет приватный файл и бота, не перезаписывает чужой webhook, применяет
миграции D1, передаёт bot token и webhook secret через stdin в Cloudflare Secrets,
публикует Worker и регистрирует webhook. Секреты не передаются в аргументах команд
и не выводятся. Git push скрипт не выполняет. Токены нельзя помещать в tracked
root `.env`, VITE-переменные, документацию или исходники.

Не запускать long polling Python-бота одновременно с webhook для того же бота.
Для остальных Wrangler-команд также использовать `--config workers/kinobox-search/wrangler.local.jsonc`.
Если регистрация webhook не завершилась, скрипт можно повторить; ошибка не
откатывает уже опубликованный Worker.

## Frontend

Для локальной проверки добавить в игнорируемый `.env.local`:

```env
VITE_WORKER_AUTH_ENABLED=true
```

Перезапустить Vite. После проверки включить GitHub repository variable
`VITE_WORKER_AUTH_ENABLED=true` для production сборки. Без флага используется
прежний вход. Worker-аккаунты используют D1 для истории; импорт гостевой истории
при входе требует подтверждения. Отклонённая история сохраняется локально и
доступна для импорта в настройках.

## API

- POST `/api/auth/telegram-login-token`: создать запрос входа на 10 минут.
- POST `/api/auth/check-telegram-auth`, JSON `{token}`: проверить подтверждение.
- POST `/api/auth/telegram-webhook`: Telegram webhook с secret header.
- POST `/api/auth/logout`: отозвать текущую bearer-сессию.
- GET `/api/user`, PUT `/api/user/name`: профиль.
- GET/PUT/DELETE `/api/list/<тип>[/<kp_id>]`: приватные списки.
- `/api/history`: история текущего аккаунта; детали в [cloud-history.md](cloud-history.md).

Polling-token и Telegram start-token различаются. Бот показывает код для сверки
и требует отдельного подтверждения кнопкой в приватном чате. Одноразовый polling
выдаёт случайную opaque bearer-сессию. В D1 хранятся только хэши токенов; срок
сессии — 30 дней, максимум 10 активных сессий на аккаунт. Cron удаляет истёкшие
запросы и сессии, сохраняя историю. Logout отзывает сессию при доступной сети.

Приватные ответы имеют `Cache-Control: private, no-store`. Rate limiting
обязателен для auth/account маршрутов; отсутствие binding закрывает доступ.
Нельзя логировать Authorization, Telegram payload и URL Bot API с токеном.

## Проверка

Проверить полный вход через Telegram, совпадение кодов, обновление меню без
перезагрузки, списки, историю и logout. Без bearer приватные маршруты должны
отвечать 401, webhook без секрета — 403. Повторный polling не должен выдавать
новую сессию. Поиск, карточки, плееры и топ должны продолжать работать.

`npx vitest run`, `npm run lint`, `npm run check:encoding` и `npm run build:github`
проверяют исходники. Unit-тесты SQLite не заменяют проверку реальной D1 и бота.
