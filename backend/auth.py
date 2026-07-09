from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Awaitable, Callable, ParamSpec, TypeVar

import jwt
from sanic import Request, Sanic
from sqlalchemy.ext.asyncio import AsyncSession

from .config import SETTINGS
from .errors import APIError
from .models import User


P = ParamSpec("P")
R = TypeVar("R")


def issue_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(seconds=SETTINGS.jwt_ttl_seconds),
            "iss": SETTINGS.jwt_issuer,
            "aud": SETTINGS.jwt_audience,
        },
        SETTINGS.jwt_secret,
        algorithm="HS256",
    )


def register_auth_middleware(app: Sanic) -> None:
    @app.on_request(priority=80)
    async def load_current_user(request: Request) -> None:
        request.ctx.user = None
        header = request.headers.get("authorization", "")
        if not header:
            return
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise APIError("INVALID_TOKEN", "Некорректный токен авторизации", 401)
        try:
            payload = jwt.decode(
                token,
                SETTINGS.jwt_secret,
                algorithms=["HS256"],
                audience=SETTINGS.jwt_audience,
                issuer=SETTINGS.jwt_issuer,
                options={"require": ["sub", "exp", "iss", "aud"]},
            )
            user_id = int(payload["sub"])
        except (jwt.PyJWTError, TypeError, ValueError) as exc:
            raise APIError("INVALID_TOKEN", "Токен недействителен или истёк", 401) from exc
        session: AsyncSession = request.ctx.db
        user = await session.get(User, user_id)
        if user is None:
            raise APIError("INVALID_TOKEN", "Пользователь токена не найден", 401)
        request.ctx.user = user


def auth_required(handler: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    @wraps(handler)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        request = next((item for item in args if isinstance(item, Request)), None)
        if request is None or getattr(request.ctx, "user", None) is None:
            raise APIError("AUTH_REQUIRED", "Требуется авторизация", 401)
        return await handler(*args, **kwargs)

    return wrapped


def moderator_required(handler: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    @wraps(handler)
    @auth_required
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        request = next(item for item in args if isinstance(item, Request))
        if request.ctx.user.role not in {"moderator", "admin"}:
            raise APIError("FORBIDDEN", "Недостаточно прав", 403)
        return await handler(*args, **kwargs)

    return wrapped
