# ReYohoho backend

Sanic API with PostgreSQL persistence, JWT authentication and the catalog providers from
`kinoserver.py`.

The 13 Kinopoisk GraphQL documents used by the providers are bundled in `backend/graphql/`.
Each document includes its fragments. The backend and its Docker image do not require the
original `graphql_extracted/` research corpus. Add any new provider query to this directory.

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

## Runtime constraints (audit 2026-11-09)

The Docker image installs the Linux/Python 3.13 lock in `requirements.lock` and runs
one worker because the cache and rate limiter are process-local. Regenerate with
`uv pip compile backend/requirements.txt --python-version 3.13 --python-platform x86_64-unknown-linux-gnu --output-file backend/requirements.lock`.
Set POSTGRES_PASSWORD and JWT_SECRET before running Compose; it has no default secrets.
TLS certificate verification is enabled for upstreams. View events older than 90 days
are pruned at startup and hourly; the all-time chart therefore represents retained events.

Proxy headers are ignored by default. Behind a trusted reverse proxy, set
PROXIES_COUNT to the exact trusted chain length, or REAL_IP_HEADER to the header
that the proxy overwrites. Prevent direct access to the backend when trusting those
headers; never accept client-supplied forwarding headers unmodified.
