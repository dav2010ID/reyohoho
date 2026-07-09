from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import TelegramLoginSession, User


async def complete_telegram_login(
    session: AsyncSession, raw_token: str, sender: dict[str, Any]
) -> bool:
    if not raw_token or not sender.get("id"):
        return False
    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    login = await session.scalar(
        select(TelegramLoginSession).where(
            TelegramLoginSession.token_hash == digest,
            TelegramLoginSession.status == "pending",
        )
    )
    if login is None:
        return False
    expires_at = login.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        login.status = "expired"
        await session.commit()
        return False

    telegram_id = int(sender["id"])
    user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
    display_name = str(
        sender.get("first_name") or sender.get("username") or f"User {telegram_id}"
    )[:50]
    if user is None:
        user = User(telegram_id=telegram_id, name=display_name)
        session.add(user)
        await session.flush()
    elif display_name and user.name.startswith("User "):
        user.name = display_name
    login.user_id = user.id
    login.status = "authenticated"
    await session.commit()
    return True
