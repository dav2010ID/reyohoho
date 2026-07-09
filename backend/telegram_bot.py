from __future__ import annotations

import asyncio
import re

from aiohttp import ClientSession, ClientTimeout
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from .config import SETTINGS
from .services.telegram import complete_telegram_login


START_TOKEN = re.compile(r"/start(?:@\w+)?\s+([A-Za-z0-9_-]{40,100})")


async def telegram_call(http: ClientSession, method: str, **payload):
    url = f"https://api.telegram.org/bot{SETTINGS.telegram_bot_token}/{method}"
    async with http.post(url, json=payload) as response:
        data = await response.json(content_type=None)
        if response.status >= 400 or not data.get("ok"):
            raise RuntimeError(f"Telegram {method} failed: {data}")
        return data.get("result")


async def run_bot() -> None:
    if not SETTINGS.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")
    engine = create_async_engine(SETTINGS.database_url, pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    offset = 0
    timeout = ClientTimeout(total=40)
    try:
        async with ClientSession(timeout=timeout) as http:
            me = await telegram_call(http, "getMe")
            print(f"Telegram bot @{me.get('username')} started", flush=True)
            while True:
                try:
                    updates = await telegram_call(
                        http, "getUpdates", offset=offset, timeout=30, allowed_updates=["message"]
                    )
                    for update in updates or []:
                        offset = max(offset, int(update["update_id"]) + 1)
                        message = update.get("message") or {}
                        sender = message.get("from") or {}
                        chat = message.get("chat") or {}
                        match = START_TOKEN.fullmatch(str(message.get("text") or "").strip())
                        if not match:
                            continue
                        async with sessions() as session:
                            completed = await complete_telegram_login(
                                session, match.group(1), sender
                            )
                        response_text = (
                            "Авторизация подтверждена. Вернитесь в ReYohoho."
                            if completed
                            else "Ссылка недействительна или уже истекла. Создайте новую на странице входа."
                        )
                        await telegram_call(
                            http,
                            "sendMessage",
                            chat_id=chat.get("id"),
                            text=response_text,
                        )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # Keep polling after transient Telegram/network errors.
                    print(f"Telegram polling error: {exc}", flush=True)
                    await asyncio.sleep(3)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_bot())
