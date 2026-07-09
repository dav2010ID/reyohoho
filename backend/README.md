# ReYohoho backend

Sanic API with PostgreSQL persistence, JWT authentication and the catalog providers from
`kinoserver.py`.

## Local development

```powershell
python -m pip install -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.kinoserver
```

Without `DATABASE_URL`, local development uses `backend/reyohoho.db` through SQLite. Production
must use PostgreSQL and set a strong random `JWT_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, explicit
`ALLOWED_ORIGINS`, provider credentials, and `APP_ENV=production`. Production mode refuses the
documented development JWT secret.

Configure the Telegram bot webhook to `POST /auth/telegram-webhook` and pass the same secret via
Telegram's `secret_token` option. The backend validates the resulting
`X-Telegram-Bot-Api-Secret-Token` header.

For a minimal local bot without a public webhook, create a bot through BotFather, set
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`, then run the long-polling process separately:

```powershell
python -m backend.telegram_bot
```

Do not run long polling and a Telegram webhook for the same bot at the same time.

Run backend tests with:

```powershell
python -m pytest backend/tests -q
```

The complete stack is defined in `docker-compose.yml`; migrations run before the backend starts.
