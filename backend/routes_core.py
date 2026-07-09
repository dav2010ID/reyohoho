from __future__ import annotations

import hashlib
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

from sanic import Blueprint, Request
from sanic.response import json
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .auth import auth_required, issue_access_token
from .config import SETTINGS
from .errors import APIError
from .models import Movie, MovieNote, Rating, TelegramLoginSession, User, UserList
from .services.telegram import complete_telegram_login


bp = Blueprint("persistent_core")
LIST_TYPES = {"favorite", "later", "watching", "completed", "abandoned", "history", "rated"}
PUBLIC_LIST_TYPES = LIST_TYPES - {"history"}
EXCLUSIVE_LIST_TYPES = {"watching", "completed", "abandoned"}
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


class WindowLimiter:
    def __init__(self) -> None:
        self.events: dict[str, deque[float]] = defaultdict(deque)
        self._next_cleanup_at = 0.0

    def _cleanup(self, now: float) -> None:
        if now < self._next_cleanup_at:
            return
        self._next_cleanup_at = now + 60
        for key, events in list(self.events.items()):
            while events and events[0] <= now:
                events.popleft()
            if not events:
                self.events.pop(key, None)

    def check(self, key: str, limit: int, window: int) -> None:
        now = time.monotonic()
        self._cleanup(now)
        events = self.events[key]
        while events and events[0] <= now:
            events.popleft()
        if len(events) >= limit:
            raise APIError("RATE_LIMITED", "Слишком много запросов", 429)
        events.append(now + window)


limiter = WindowLimiter()


def upsert_statement(
    session: AsyncSession,
    model,
    values: dict[str, Any],
    conflict_columns: list[str],
    update_values: dict[str, Any] | None,
):
    dialect = session.get_bind().dialect.name
    factory = sqlite_insert if dialect == "sqlite" else pg_insert if dialect == "postgresql" else None
    if factory is None:
        return None
    statement = factory(model).values(**values)
    if update_values is None:
        return statement.on_conflict_do_nothing(index_elements=conflict_columns)
    return statement.on_conflict_do_update(index_elements=conflict_columns, set_=update_values)


def body(request: Request) -> dict[str, Any]:
    try:
        value = request.json
    except Exception as exc:  # Sanic raises BadRequest for malformed JSON.
        raise APIError("VALIDATION_ERROR", "Некорректный JSON", 422) from exc
    if not isinstance(value, dict):
        raise APIError("VALIDATION_ERROR", "Ожидается JSON-объект", 422)
    return value


def clean_id(value: Any, field: str = "id") -> str:
    result = str(value or "").strip()
    if not result.isdigit():
        raise APIError("VALIDATION_ERROR", f"{field} должен содержать только цифры", 422)
    return result


def as_utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def user_json(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "name": user.name,
        "photo": user.photo,
        "role": user.role,
        "allow_comments": int(user.allow_comments),
    }


def note_json(note: MovieNote) -> dict[str, Any]:
    return {"kp_id": note.kp_id, "note_text": note.note_text, "updated_at": as_utc_iso(note.updated_at)}


def list_item(content_id: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    metadata = dict(metadata or {})
    metadata.setdefault("id", content_id)
    metadata.setdefault("kp_id", content_id)
    metadata.setdefault("title", metadata.get("name_ru") or metadata.get("name_original") or "")
    metadata.setdefault("year", str(metadata.get("year") or ""))
    metadata.setdefault("poster", metadata.get("poster_url") or "")
    return metadata


async def rating_payload(session: AsyncSession, kp_id: str, user_id: int | None) -> dict[str, Any]:
    average, count = (
        await session.execute(
            select(func.avg(Rating.rating), func.count(Rating.id)).where(Rating.kp_id == kp_id)
        )
    ).one()
    user_rating = None
    if user_id is not None:
        user_rating = await session.scalar(
            select(Rating.rating).where(Rating.kp_id == kp_id, Rating.user_id == user_id)
        )
    return {
        "user_rating": user_rating,
        "average_rating": round(float(average), 2) if average is not None else None,
        "vote_count": int(count or 0),
    }


def validate_list_type(list_type: str, *, writable: bool = False) -> None:
    if list_type not in LIST_TYPES:
        raise APIError("INVALID_LIST_TYPE", "Неизвестный тип списка", 422)
    if writable and list_type == "rated":
        raise APIError("READ_ONLY_LIST", "Список rated формируется из оценок", 409)


async def fetch_list(session: AsyncSession, user_id: int, list_type: str) -> list[dict[str, Any]]:
    created_at_by_id: dict[str, datetime] = {}
    if list_type == "rated":
        ids = list(
            (await session.scalars(select(Rating.kp_id).where(Rating.user_id == user_id))).all()
        )
    else:
        rows = (
            await session.execute(
                select(UserList.content_id, UserList.created_at)
                .where(UserList.user_id == user_id, UserList.list_type == list_type)
                .order_by(UserList.created_at.desc())
            )
        ).all()
        ids = [content_id for content_id, _ in rows]
        created_at_by_id = {
            content_id: created_at
            for content_id, created_at in rows
            if created_at is not None
        }
    if not ids:
        return []
    movies = {
        movie.kp_id: movie
        for movie in (
            await session.scalars(select(Movie).where(Movie.kp_id.in_(ids)))
        ).all()
    }
    result = []
    for item in ids:
        payload = list_item(item, movies[item].metadata_json if item in movies else None)
        if item in created_at_by_id:
            payload["addedAt"] = as_utc_iso(created_at_by_id[item])
        result.append(payload)
    return result


@bp.get("/auth/telegram-login-token")
async def telegram_login_token(request: Request):
    limiter.check(f"login-create:{request.ip}", 10, 60)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    ttl = max(300, min(SETTINGS.telegram_login_ttl_seconds, 600))
    session: AsyncSession = request.ctx.db
    session.add(
        TelegramLoginSession(
            token_hash=token_hash,
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl),
        )
    )
    await session.commit()
    username = SETTINGS.telegram_bot_username.lstrip("@")
    link = f"https://t.me/{quote(username)}?start={quote(token)}" if username else ""
    return json({"token": token, "telegram_link": link, "expires_in": ttl})


@bp.get("/auth/check-telegram-auth")
async def check_telegram_auth(request: Request):
    token = str(request.args.get("token") or "")
    if len(token) < 40 or len(token) > 100:
        raise APIError("INVALID_LOGIN_TOKEN", "Некорректный login token", 422)
    digest = hashlib.sha256(token.encode()).hexdigest()
    limiter.check(f"login-poll:{request.ip}:{digest[:12]}", 35, 60)
    session: AsyncSession = request.ctx.db
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(TelegramLoginSession)
        .where(
            TelegramLoginSession.token_hash == digest,
            TelegramLoginSession.status == "authenticated",
            TelegramLoginSession.consumed_at.is_(None),
            TelegramLoginSession.expires_at > now,
            TelegramLoginSession.user_id.is_not(None),
        )
        .values(status="consumed", consumed_at=now)
        .returning(TelegramLoginSession.user_id)
    )
    user_id = result.scalar_one_or_none()
    if user_id is not None:
        await session.commit()
        return json({"authenticated": True, "token": issue_access_token(user_id)})
    login = await session.scalar(
        select(TelegramLoginSession).where(TelegramLoginSession.token_hash == digest)
    )
    if login is None or login.status == "consumed":
        raise APIError("LOGIN_TOKEN_NOT_FOUND", "Login token не найден или уже использован", 404)
    expires_at = login.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        login.status = "expired"
        await session.commit()
        raise APIError("LOGIN_TOKEN_EXPIRED", "Login token истёк", 410)
    return json({"authenticated": False})


@bp.post("/auth/telegram-webhook")
async def telegram_webhook(request: Request):
    if not SETTINGS.telegram_webhook_secret:
        raise APIError("WEBHOOK_DISABLED", "Telegram webhook не настроен", 503)
    supplied = request.headers.get("x-telegram-bot-api-secret-token", "")
    if not secrets.compare_digest(supplied, SETTINGS.telegram_webhook_secret):
        raise APIError("FORBIDDEN", "Некорректный webhook secret", 403)
    payload = body(request)
    message = payload.get("message") or {}
    sender = message.get("from") or {}
    text_value = str(message.get("text") or "")
    match = re.fullmatch(r"/start(?:@\w+)?\s+([A-Za-z0-9_-]{40,100})", text_value.strip())
    if not match or not sender.get("id"):
        return json({"ok": True})
    session: AsyncSession = request.ctx.db
    await complete_telegram_login(session, match.group(1), sender)
    return json({"ok": True})


@bp.get("/user")
@auth_required
async def get_user(request: Request):
    return json(user_json(request.ctx.user))


@bp.get("/notifications")
@auth_required
async def get_notifications(_: Request):
    return json({"notifications": [], "unread_count": 0})


@bp.get("/notifications/unread-count")
@auth_required
async def get_unread_notifications_count(_: Request):
    return json({"unread_count": 0})


@bp.post("/notifications/mark-read")
@auth_required
async def mark_notifications_as_read(_: Request):
    return json({"updated": True, "unread_count": 0})


@bp.delete("/notifications/<notification_id:int>")
@auth_required
async def delete_notification(_: Request, notification_id: int):
    return json({"id": notification_id, "deleted": True})


@bp.put("/user/name")
@auth_required
async def update_user_name(request: Request):
    name = str(body(request).get("name") or "").strip()
    if not 2 <= len(name) <= 50 or CONTROL_CHARS.search(name):
        raise APIError("INVALID_USER_NAME", "Имя должно содержать от 2 до 50 символов", 422)
    request.ctx.user.name = name
    await request.ctx.db.commit()
    return json(user_json(request.ctx.user))


@bp.get("/rating/<kp_id:str>")
async def get_rating(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    user = getattr(request.ctx, "user", None)
    return json(await rating_payload(request.ctx.db, kp_id, user.id if user else None))


@bp.post("/rating/<kp_id:str>")
@auth_required
async def set_rating(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    value = body(request).get("rating")
    if value is not None and (type(value) is not int or not 1 <= value <= 10):
        raise APIError("INVALID_RATING", "Оценка должна быть целым числом от 1 до 10 или null", 422)
    session: AsyncSession = request.ctx.db
    if value is None:
        await session.execute(
            delete(Rating).where(Rating.user_id == request.ctx.user.id, Rating.kp_id == kp_id)
        )
    else:
        now = datetime.now(timezone.utc)
        statement = upsert_statement(
            session,
            Rating,
            {"user_id": request.ctx.user.id, "kp_id": kp_id, "rating": value, "created_at": now, "updated_at": now},
            ["user_id", "kp_id"],
            {"rating": value, "updated_at": now},
        )
        if statement is not None:
            await session.execute(statement)
        else:
            rating = await session.scalar(
                select(Rating).where(Rating.user_id == request.ctx.user.id, Rating.kp_id == kp_id)
            )
            if rating is None:
                session.add(Rating(user_id=request.ctx.user.id, kp_id=kp_id, rating=value))
            else:
                rating.rating = value
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise APIError("RATING_CONFLICT", "Конкурентное обновление оценки", 409) from exc
    return json(await rating_payload(session, kp_id, request.ctx.user.id))


@bp.put("/list/<list_type:str>/<content_id:str>")
@auth_required
async def add_to_list(request: Request, list_type: str, content_id: str):
    validate_list_type(list_type, writable=True)
    content_id = clean_id(content_id, "content id")
    session: AsyncSession = request.ctx.db
    supplied_metadata = (body(request) if request.body else {}).get("metadata")
    if isinstance(supplied_metadata, dict):
        allowed_fields = {
            "id",
            "kp_id",
            "kinopoisk_id",
            "title",
            "name_ru",
            "name_en",
            "name_original",
            "year",
            "type",
            "poster",
            "poster_url",
            "poster_url_preview",
            "rating_kp",
            "rating_kinopoisk",
            "rating_imdb",
            "slug",
        }
        metadata = {
            key: value
            for key, value in supplied_metadata.items()
            if key in allowed_fields and value is not None
        }
        metadata["id"] = content_id
        metadata["kp_id"] = content_id
        metadata["kinopoisk_id"] = content_id
        metadata["title"] = str(
            metadata.get("title")
            or metadata.get("name_ru")
            or metadata.get("name_original")
            or ""
        )[:300]
        metadata["poster"] = str(
            metadata.get("poster")
            or metadata.get("poster_url_preview")
            or metadata.get("poster_url")
            or ""
        )[:2000]
        movie = await session.get(Movie, content_id)
        if movie is None:
            movie = Movie(
                kp_id=content_id,
                type=str(metadata.get("type") or "movie")[:30],
                metadata_json=metadata,
            )
            session.add(movie)
        else:
            movie.metadata_json = {**(movie.metadata_json or {}), **metadata}
    if list_type in EXCLUSIVE_LIST_TYPES:
        await session.execute(
            delete(UserList).where(
                UserList.user_id == request.ctx.user.id,
                UserList.content_type == "movie",
                UserList.content_id == content_id,
                UserList.list_type.in_(EXCLUSIVE_LIST_TYPES - {list_type}),
            )
        )
    values = {
        "user_id": request.ctx.user.id,
        "content_type": "movie",
        "content_id": content_id,
        "list_type": list_type,
        "created_at": datetime.now(timezone.utc),
    }
    statement = upsert_statement(
        session,
        UserList,
        values,
        ["user_id", "content_type", "content_id", "list_type"],
        {"created_at": values["created_at"]} if list_type == "history" else None,
    )
    if statement is not None:
        await session.execute(statement)
    else:
        exists = await session.scalar(
            select(UserList.id).where(
                UserList.user_id == request.ctx.user.id,
                UserList.content_type == "movie",
                UserList.content_id == content_id,
                UserList.list_type == list_type,
            )
        )
        if exists is None:
            session.add(UserList(**values))
    await session.commit()
    return json({"id": content_id, "type": list_type, "added": True})


@bp.delete("/list/<list_type:str>/<content_id:str>")
@auth_required
async def remove_from_list(request: Request, list_type: str, content_id: str):
    validate_list_type(list_type, writable=True)
    content_id = clean_id(content_id, "content id")
    await request.ctx.db.execute(
        delete(UserList).where(
            UserList.user_id == request.ctx.user.id,
            UserList.content_id == content_id,
            UserList.list_type == list_type,
        )
    )
    await request.ctx.db.commit()
    return json({"id": content_id, "type": list_type, "deleted": True})


@bp.delete("/list/<list_type:str>")
@auth_required
async def clear_list(request: Request, list_type: str):
    validate_list_type(list_type, writable=True)
    await request.ctx.db.execute(
        delete(UserList).where(
            UserList.user_id == request.ctx.user.id, UserList.list_type == list_type
        )
    )
    await request.ctx.db.commit()
    return json({"type": list_type, "deleted": True})


@bp.get("/list/<list_type:str>")
@auth_required
async def get_own_list(request: Request, list_type: str):
    validate_list_type(list_type)
    return json(await fetch_list(request.ctx.db, request.ctx.user.id, list_type))


@bp.get("/user-list/<user_id:int>/<list_type:str>")
async def get_public_list(request: Request, user_id: int, list_type: str):
    validate_list_type(list_type)
    current = getattr(request.ctx, "user", None)
    if list_type not in PUBLIC_LIST_TYPES and (current is None or current.id != user_id):
        raise APIError("PRIVATE_LIST", "Этот список является приватным", 403)
    if await request.ctx.db.get(User, user_id) is None:
        raise APIError("USER_NOT_FOUND", "Пользователь не найден", 404)
    return json(await fetch_list(request.ctx.db, user_id, list_type))


@bp.get("/user-list-counters/<user_id:int>")
async def get_list_counters(request: Request, user_id: int):
    if await request.ctx.db.get(User, user_id) is None:
        raise APIError("USER_NOT_FOUND", "Пользователь не найден", 404)
    rows = (
        await request.ctx.db.execute(
            select(UserList.list_type, func.count(UserList.id))
            .where(UserList.user_id == user_id)
            .group_by(UserList.list_type)
        )
    ).all()
    counters = {item: 0 for item in LIST_TYPES}
    counters.update({item: int(count) for item, count in rows})
    counters["rated"] = int(
        await request.ctx.db.scalar(select(func.count(Rating.id)).where(Rating.user_id == user_id)) or 0
    )
    current = getattr(request.ctx, "user", None)
    if current is None or current.id != user_id:
        counters.pop("history", None)
    return json(counters)


@bp.get("/movies/<kp_id:str>/note")
@auth_required
async def get_note(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    note = await request.ctx.db.scalar(
        select(MovieNote).where(MovieNote.user_id == request.ctx.user.id, MovieNote.kp_id == kp_id)
    )
    return json({"note": note_json(note) if note else None})


@bp.post("/movies/<kp_id:str>/note")
@auth_required
async def save_note(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    note_text = str(body(request).get("note_text") or "").strip()
    if not 1 <= len(note_text) <= 10_000:
        raise APIError("INVALID_NOTE", "Заметка должна содержать от 1 до 10000 символов", 422)
    session: AsyncSession = request.ctx.db
    now = datetime.now(timezone.utc)
    values = {
        "user_id": request.ctx.user.id,
        "kp_id": kp_id,
        "note_text": note_text,
        "created_at": now,
        "updated_at": now,
    }
    statement = upsert_statement(
        session,
        MovieNote,
        values,
        ["user_id", "kp_id"],
        {"note_text": note_text, "updated_at": now},
    )
    if statement is not None:
        await session.execute(statement)
    else:
        note = await session.scalar(
            select(MovieNote).where(MovieNote.user_id == request.ctx.user.id, MovieNote.kp_id == kp_id)
        )
        if note is None:
            session.add(MovieNote(**values))
        else:
            note.note_text = note_text
    await session.commit()
    note = await session.scalar(
        select(MovieNote).where(MovieNote.user_id == request.ctx.user.id, MovieNote.kp_id == kp_id)
    )
    return json({"note": note_json(note)})


@bp.delete("/movies/<kp_id:str>/note")
@auth_required
async def delete_note(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    await request.ctx.db.execute(
        delete(MovieNote).where(MovieNote.user_id == request.ctx.user.id, MovieNote.kp_id == kp_id)
    )
    await request.ctx.db.commit()
    return json({"deleted": True})
