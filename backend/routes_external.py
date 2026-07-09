from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from aiohttp import ClientSession
from sanic import Blueprint, Request
from sanic.response import json
from sqlalchemy import func, select

from .config import SETTINGS
from .errors import APIError
from .models import Movie, TimingSubmission, UserList, ViewEvent
from .routes_core import as_utc_iso
from .routes_social import timing_json


bp = Blueprint("external_integrations")


async def enrich_movie(request: Request, movie_data: dict[str, Any], kp_id: str) -> dict[str, Any]:
    session = request.ctx.db
    existing = await session.get(Movie, kp_id)
    if existing is None:
        existing = Movie(
            kp_id=kp_id,
            imdb_id=movie_data.get("imdb_id"),
            shiki_id=movie_data.get("shikimori_id"),
            type="series" if movie_data.get("serial") else "movie",
            metadata_json=movie_data,
        )
        session.add(existing)
    else:
        existing.imdb_id = movie_data.get("imdb_id") or existing.imdb_id
        existing.shiki_id = movie_data.get("shikimori_id") or existing.shiki_id
        existing.metadata_json = movie_data
    session.add(ViewEvent(kp_id=kp_id))
    user = getattr(request.ctx, "user", None)
    if user is not None:
        list_types = set(
            (
                await session.scalars(
                    select(UserList.list_type).where(
                        UserList.user_id == user.id, UserList.content_id == kp_id
                    )
                )
            ).all()
        )
        movie_data["lists"] = {
            "isFavorite": "favorite" in list_types,
            "isHistory": "history" in list_types,
            "isLater": "later" in list_types,
            "isCompleted": "completed" in list_types,
            "isAbandoned": "abandoned" in list_types,
            "isWatching": "watching" in list_types,
            "isRated": "rated" in list_types,
        }
    timings = list(
        (
            await session.scalars(
                select(TimingSubmission).where(
                    TimingSubmission.kp_id == kp_id,
                    TimingSubmission.status.in_({"approved", "clean_text"}),
                    TimingSubmission.is_deleted.is_(False),
                )
            )
        ).all()
    )
    movie_data["nudity_timings"] = [
        await timing_json(session, item, user.id if user else None) for item in timings
    ]
    await session.commit()
    return movie_data


async def local_top(
    request: Request, period: str, type_filter: str, page: int, limit: int
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    cutoffs = {
        "24h": now - timedelta(hours=24),
        "week": now - timedelta(days=7),
        "month": now - timedelta(days=30),
        "all": None,
    }
    query = select(ViewEvent.kp_id, func.count(ViewEvent.id).label("views")).group_by(ViewEvent.kp_id)
    if cutoffs[period] is not None:
        query = query.where(ViewEvent.created_at >= cutoffs[period])
    if type_filter != "all":
        query = query.join(Movie, Movie.kp_id == ViewEvent.kp_id).where(Movie.type == type_filter)
    rows = (
        await request.ctx.db.execute(
            query.order_by(func.count(ViewEvent.id).desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()
    ids = [row.kp_id for row in rows]
    if not ids:
        return []
    movies = {
        movie.kp_id: movie
        for movie in (
            await request.ctx.db.scalars(select(Movie).where(Movie.kp_id.in_(ids)))
        ).all()
    }
    result = []
    for item in ids:
        movie = movies.get(item)
        if movie is None:
            continue
        metadata = dict(movie.metadata_json or {})
        metadata.setdefault("id", item)
        metadata.setdefault("kp_id", item)
        result.append(metadata)
    return result


async def cached_mapping(request: Request, field: str, value: str) -> str | None:
    column = Movie.imdb_id if field == "imdb_id" else Movie.shiki_id
    return await request.ctx.db.scalar(select(Movie.kp_id).where(column == value))


async def store_mapping(request: Request, kp_id: str, field: str, value: str) -> None:
    movie = await request.ctx.db.get(Movie, kp_id)
    if movie is None:
        movie = Movie(kp_id=kp_id, metadata_json={})
        request.ctx.db.add(movie)
    setattr(movie, field, value)
    await request.ctx.db.commit()


@bp.get("/imdb_parental_guide/<imdb_id:str>")
async def parental_guide(request: Request, imdb_id: str):
    digits = "".join(char for char in imdb_id if char.isdigit())
    if not digits:
        raise APIError("INVALID_IMDB_ID", "Некорректный IMDb ID", 422)
    normalized = f"tt{digits}"
    movie = await request.ctx.db.scalar(select(Movie).where(Movie.imdb_id == normalized))
    if movie is not None and movie.parental_guide:
        return json(movie.parental_guide)
    if not SETTINGS.parental_guide_url:
        return json(
            {
                "nudity": {"severity": "unknown", "items": []},
                "source": "local",
                "updated_at": None,
            }
        )
    client: ClientSession = request.app.ctx.http
    try:
        async with client.get(SETTINGS.parental_guide_url, params={"imdb_id": normalized}) as response:
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}")
            payload = await response.json(content_type=None)
    except Exception as exc:  # noqa: BLE001
        raise APIError("PARENTAL_GUIDE_UNAVAILABLE", "Источник Parents Guide недоступен", 502) from exc
    if not isinstance(payload, dict):
        raise APIError("INVALID_PROVIDER_RESPONSE", "Источник вернул некорректный ответ", 502)
    payload.setdefault("source", "configured-provider")
    payload.setdefault("updated_at", as_utc_iso(datetime.now(timezone.utc)))
    if movie is not None:
        movie.parental_guide = payload
        await request.ctx.db.commit()
    return json(payload)


async def twitch_access_token(request: Request) -> str:
    cached = getattr(request.app.ctx, "twitch_access_token", None)
    expires_at = getattr(request.app.ctx, "twitch_access_token_expires", None)
    now = datetime.now(timezone.utc)
    if cached and expires_at and expires_at > now:
        return cached
    if not SETTINGS.twitch_client_id or not SETTINGS.twitch_client_secret:
        raise APIError("TWITCH_NOT_CONFIGURED", "Twitch API не настроен", 503)
    client: ClientSession = request.app.ctx.http
    try:
        async with client.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": SETTINGS.twitch_client_id,
                "client_secret": SETTINGS.twitch_client_secret,
                "grant_type": "client_credentials",
            },
        ) as response:
            payload = await response.json(content_type=None)
            if response.status >= 400:
                raise RuntimeError(str(payload))
    except Exception as exc:  # noqa: BLE001
        raise APIError("TWITCH_UNAVAILABLE", "Twitch OAuth недоступен", 502) from exc
    token = str(payload.get("access_token") or "")
    if not token:
        raise APIError("TWITCH_UNAVAILABLE", "Twitch не вернул access token", 502)
    request.app.ctx.twitch_access_token = token
    request.app.ctx.twitch_access_token_expires = now + timedelta(
        seconds=max(60, int(payload.get("expires_in") or 3600) - 60)
    )
    return token


@bp.get("/twitch/<username:str>")
async def twitch(request: Request, username: str):
    username = username.strip().lower()
    if not username or len(username) > 25:
        raise APIError("INVALID_TWITCH_USERNAME", "Некорректное имя Twitch", 422)
    token = await twitch_access_token(request)
    headers = {"Authorization": f"Bearer {token}", "Client-Id": SETTINGS.twitch_client_id}
    client: ClientSession = request.app.ctx.http
    try:
        async with client.get(
            "https://api.twitch.tv/helix/users", headers=headers, params={"login": username}
        ) as response:
            users = await response.json(content_type=None)
            if response.status >= 400:
                raise RuntimeError(str(users))
        user_info = (users.get("data") or [None])[0]
        streams: list[dict[str, Any]] = []
        if user_info:
            async with client.get(
                "https://api.twitch.tv/helix/streams",
                headers=headers,
                params={"user_id": user_info["id"]},
            ) as response:
                stream_payload = await response.json(content_type=None)
                if response.status >= 400:
                    raise RuntimeError(str(stream_payload))
                streams = stream_payload.get("data") or []
    except Exception as exc:  # noqa: BLE001
        raise APIError("TWITCH_UNAVAILABLE", "Twitch API недоступен", 502) from exc
    return json({"username": username, "user_info": user_info, "stream_data": streams})
