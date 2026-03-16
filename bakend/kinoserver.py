from __future__ import annotations

import asyncio
import os
import random
import re
import time
from dataclasses import dataclass
from typing import Any

from aiohttp import ClientError, ClientSession, ClientTimeout
from dotenv import load_dotenv
from sanic import Request, Sanic
from sanic.log import logger
from sanic.response import json, text

load_dotenv()

KINOPOISK_API_BASE = "https://kinopoiskapiunofficial.tech"
KODIK_API_BASE = "https://kodikapi.com"
DEFAULT_TIMEOUT_SECONDS = 12
PLAYER_CACHE_TTL_SECONDS = int(os.getenv("PLAYER_CACHE_TTL_SECONDS", "10800"))
MOVIE_CACHE_TTL_SECONDS = int(os.getenv("MOVIE_CACHE_TTL_SECONDS", "21600"))
SEARCH_CACHE_TTL_SECONDS = int(os.getenv("SEARCH_CACHE_TTL_SECONDS", "1800"))
TOP_CACHE_TTL_SECONDS = int(os.getenv("TOP_CACHE_TTL_SECONDS", "3600"))


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def get(self, key: str) -> Any | None:
        value = self._store.get(key)
        if not value:
            return None
        expires_at, payload = value
        if expires_at <= time.monotonic():
            self._store.pop(key, None)
            self._locks.pop(key, None)
            return None
        return payload

    def set(self, key: str, value: Any, ttl_seconds: int) -> Any:
        self._store[key] = (time.monotonic() + ttl_seconds, value)
        return value

    async def get_or_set(self, key: str, ttl_seconds: int, factory) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            value = await factory()
            self.set(key, value, ttl_seconds)
            return value

    def cleanup(self) -> None:
        now = time.monotonic()
        expired = [key for key, (expires_at, _) in self._store.items() if expires_at <= now]
        for key in expired:
            self._store.pop(key, None)
            self._locks.pop(key, None)


@dataclass(slots=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "0") == "1"
    kinopoisk_token: str = os.getenv("KINOPOISK_TECH_API_TOKEN", "")
    kodik_token: str = os.getenv("KODIK_TOKEN", "")
    collaps_token: str = os.getenv("COLLAPS_TOKEN", "")
    lumex_token: str = os.getenv("LUMEX_TOKEN", "")
    cdnmovies_token: str = os.getenv("CDNMOVIES_TOKEN", "")
    alloha_token: str = os.getenv("ALLOHA_TOKEN", "")
    hdvb_token: str = os.getenv("HDVB_TOKEN", "")
    vibix_token: str = os.getenv("VIBIX_TOKEN", "")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            ",".join(
                [
                    "https://dav2010id.github.io",
                    "https://dav2010id.github.io/reyohoho",
                    "https://reyohoho.serv00.net",
                    "https://reyohoho.surge.sh",
                    "https://reyohoho.vercel.app",
                    "https://reyohoho.onrender.com",
                    "https://reyohoho-c1920f.gitlab.io",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ]
            ),
        ).split(",")
        if origin.strip()
    )


SETTINGS = Settings()


def create_app() -> Sanic:
    app = Sanic("reyohoho")
    app.ctx.settings = SETTINGS
    app.ctx.cache = TTLCache()
    register_lifecycle(app)
    register_middleware(app)
    register_routes(app)
    return app


def register_lifecycle(app: Sanic) -> None:
    @app.before_server_start
    async def setup_client(_: Sanic, __: Any) -> None:
        timeout = ClientTimeout(total=DEFAULT_TIMEOUT_SECONDS)
        app.ctx.http = ClientSession(timeout=timeout)
        app.ctx.cache_cleanup_task = app.add_task(cache_cleanup_loop(app))

    @app.after_server_stop
    async def close_client(_: Sanic, __: Any) -> None:
        session: ClientSession | None = getattr(app.ctx, "http", None)
        if session and not session.closed:
            await session.close()
        cleanup_task: asyncio.Task | None = getattr(app.ctx, "cache_cleanup_task", None)
        if cleanup_task:
            cleanup_task.cancel()


async def cache_cleanup_loop(app: Sanic) -> None:
    while True:
        await asyncio.sleep(60)
        app.ctx.cache.cleanup()


def register_middleware(app: Sanic) -> None:
    @app.on_response
    async def add_cors_headers(request: Request, response) -> None:
        origin = request.headers.get("origin")
        if origin and origin in app.ctx.settings.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"

    @app.options("/<_:path>")
    async def cors_preflight(_: Request, __: str):
        return text("")


def register_routes(app: Sanic) -> None:
    @app.get("/health")
    async def health(_: Request):
        settings: Settings = app.ctx.settings
        return json(
            {
                "ok": True,
                "providers": {
                    "kinopoisk": bool(settings.kinopoisk_token),
                    "kodik": bool(settings.kodik_token),
                    "collaps": bool(settings.collaps_token),
                    "lumex": bool(settings.lumex_token),
                    "cdnmovies": bool(settings.cdnmovies_token),
                    "alloha": bool(settings.alloha_token),
                    "hdvb": bool(settings.hdvb_token),
                    "vibix": bool(settings.vibix_token),
                },
            }
        )

    @app.get("/search/<term:str>")
    async def search_kinopoisk(_: Request, term: str):
        data = await kinopoisk_search(app, term)
        return json(data)

    @app.get("/kp_info2/<kp_id:str>")
    async def kp_info(_: Request, kp_id: str):
        movie = await kinopoisk_film(app, kp_id)
        return json(movie)

    @app.get("/kp_info/<kp_id:str>")
    async def kp_info_legacy(_: Request, kp_id: str):
        movie = await kinopoisk_film(app, kp_id)
        return json(movie)

    @app.get("/shiki_info/<shiki_id:str>")
    async def shiki_info(_: Request, shiki_id: str):
        movie = await shikimori_info(app, shiki_id)
        return json(movie)

    @app.get("/shiki_to_kp/<shiki_id:str>")
    async def shiki_to_kp(_: Request, shiki_id: str):
        kp_id = await shiki_to_kp_id(app, shiki_id)
        if not kp_id:
            return json({}, status=404)
        return json({"kinopoisk_id": kp_id})

    @app.get("/imdb_to_kp/<imdb_id:str>")
    async def imdb_to_kp(_: Request, imdb_id: str):
        kp_id = await imdb_to_kp_id(app, imdb_id)
        if not kp_id:
            return json({}, status=404)
        return json({"kinopoisk_id": kp_id})

    @app.get("/top/<period:str>")
    async def top_movies(request: Request, period: str):
        type_filter = str(request.args.get("type", "all")).strip().lower()
        limit_raw = request.args.get("limit")
        limit = int(limit_raw) if limit_raw and str(limit_raw).isdigit() else None
        items = await get_top_movies(app, period, type_filter=type_filter, limit=limit)
        return json(items)

    @app.get("/discussed/<kind:str>")
    async def discussed(_: Request, kind: str):
        items = await get_top_movies(app, kind, type_filter="all", limit=20)
        return json(items)

    @app.get("/chance")
    async def random_movie(_: Request):
        movie = await get_random_movie(app)
        return json(movie)

    @app.get("/get_dons")
    async def get_dons(_: Request):
        data = os.getenv("DONS_LIST", "XaksFlaX\nTanyaBelkova\nF1ashko\nKrabick\nKati\nTimofey")
        return text(data)

    @app.get("/twitch/<username:str>")
    async def get_twitch_stream(_: Request, username: str):
        return json(
            {
                "username": username,
                "user_info": None,
                "stream_data": [],
            }
        )

    @app.get("/timings/top")
    async def timings_top(_: Request):
        return json([])

    @app.get("/timings/all")
    async def timings_all(_: Request):
        return json([])

    @app.post("/cache")
    async def cache_players(request: Request):
        kp_id = clean_digits(request.form.get("kinopoisk"))
        if not kp_id:
            return json({})
        players = await get_players_by_kp(app, kp_id, request=request)
        return json(players)

    @app.post("/cache_shiki")
    async def cache_shiki_players(request: Request):
        shiki_id = clean_digits(request.form.get("shikimori"))
        if not shiki_id:
            return json({})
        players = await get_players_by_shiki(app, shiki_id, request=request)
        return json(players)


def clean_digits(value: Any) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def parse_float(value: Any) -> float | None:
    try:
        if value in (None, "", "null"):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def map_kinopoisk_type(value: Any) -> str:
    normalized = str(value or "").lower()
    if "series" in normalized or "tv" in normalized:
        return "TV_SERIES"
    if "show" in normalized:
        return "TV_SHOW"
    if "mini" in normalized:
        return "MINI_SERIES"
    return "FILM"


def normalize_top_item(item: dict[str, Any]) -> dict[str, Any]:
    kp_id = str(item.get("kinopoiskId") or item.get("filmId") or item.get("kinopoisk_id") or "")
    title = item.get("nameRu") or item.get("nameEn") or item.get("nameOriginal") or ""
    year = str(item.get("year") or "")
    poster = item.get("posterUrlPreview") or item.get("posterUrl") or ""
    rating = parse_float(item.get("ratingKinopoisk") or item.get("rating"))

    return {
        "id": kp_id,
        "kp_id": kp_id,
        "title": title,
        "year": year,
        "poster": poster,
        "average_rating": rating,
        "raw_data": {
            "film_id": kp_id,
            "name_ru": item.get("nameRu") or "",
            "name_en": item.get("nameEn") or "",
            "name_original": item.get("nameOriginal") or "",
            "type": map_kinopoisk_type(item.get("type")),
            "year": year or None,
            "description": item.get("description") or None,
            "countries": item.get("countries") or [],
            "genres": item.get("genres") or [],
            "poster_url": item.get("posterUrl") or poster,
            "poster_url_preview": poster,
            "rating": item.get("ratingKinopoisk") or item.get("rating") or None,
            "rating_vote_count": item.get("ratingKinopoiskVoteCount") or 0,
        },
    }


def normalize_search_item(item: dict[str, Any]) -> dict[str, Any]:
    title_base = item.get("nameRu") or item.get("nameEn") or item.get("nameOriginal") or ""
    year = item.get("year")
    title = f"{title_base} ({year})" if title_base and year else title_base
    return {
        "id": item.get("filmId") or item.get("kinopoiskId"),
        "kp_id": str(item.get("filmId") or item.get("kinopoiskId") or ""),
        "title": title,
        "poster": item.get("posterUrlPreview") or item.get("posterUrl") or "",
        "average_rating": parse_float(item.get("rating")),
        "raw_data": item,
    }


def normalize_film_payload(payload: dict[str, Any]) -> dict[str, Any]:
    year = payload.get("year")
    kp_id = str(payload.get("kinopoiskId") or payload.get("filmId") or "")
    poster = payload.get("posterUrl") or payload.get("posterUrlPreview") or ""

    return {
        "id": kp_id,
        "kp_id": kp_id,
        "kinopoisk_id": kp_id,
        "id_kp": kp_id,
        "title": payload.get("nameRu") or payload.get("nameEn") or payload.get("nameOriginal") or "",
        "name_ru": payload.get("nameRu") or "",
        "name_en": payload.get("nameEn") or "",
        "name_original": payload.get("nameOriginal") or "",
        "short_description": payload.get("shortDescription") or payload.get("description") or "",
        "description": payload.get("description") or "",
        "year": str(year or ""),
        "type": map_kinopoisk_type(payload.get("type")),
        "countries": payload.get("countries") or [],
        "genres": payload.get("genres") or [],
        "poster_url": poster,
        "poster_url_preview": payload.get("posterUrlPreview") or poster,
        "logo_url": payload.get("logoUrl") or "",
        "cover_url": payload.get("coverUrl") or "",
        "web_url": payload.get("webUrl") or f"https://www.kinopoisk.ru/film/{kp_id}/",
        "film_length": payload.get("filmLength"),
        "rating_kinopoisk": parse_float(payload.get("ratingKinopoisk")),
        "rating_kinopoisk_vote_count": payload.get("ratingKinopoiskVoteCount") or 0,
        "rating_imdb": parse_float(payload.get("ratingImdb")),
        "rating_imdb_vote_count": payload.get("ratingImdbVoteCount") or 0,
        "rating_age_limits": payload.get("ratingAgeLimits"),
        "rating_mpaa": payload.get("ratingMpaa"),
        "slogan": payload.get("slogan") or "",
        "imdb_id": payload.get("imdbId") or "",
        "serial": bool(payload.get("serial")),
        "short_film": bool(payload.get("shortFilm")),
        "completed": bool(payload.get("completed")),
        "screenshots": [],
        "videos": [],
        "staff": [],
        "sequels_and_prequels": [],
        "similars": [],
        "lists": {},
        "nudity_timings": [],
        "raw_data": payload,
    }


def normalize_shiki_player(name: str, link: str, quality: str = "") -> dict[str, str]:
    return {
        "translate": name,
        "iframe": link,
        "quality": quality or "",
        "warning": False,
        "source": "kodik",
    }


def build_player_entry(
    source: str,
    iframe: str,
    translate: str,
    quality: str = "",
    *,
    warning: bool = False,
) -> dict[str, Any]:
    return {
        "translate": translate,
        "iframe": iframe,
        "quality": quality or "",
        "warning": warning,
        "source": source,
    }


def merge_player_maps(*providers: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    used_iframes: set[str] = set()
    for provider in providers:
        for key, value in provider.items():
            iframe = str(value.get("iframe") or "").strip()
            if not iframe or iframe in used_iframes:
                continue
            used_iframes.add(iframe)
            base_key = key
            candidate = base_key
            index = 2
            while candidate in merged:
                candidate = f"{base_key} #{index}"
                index += 1
            merged[candidate] = value
    return merged


async def fetch_json(
    app: Sanic,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    session: ClientSession = app.ctx.http
    try:
        async with session.get(url, headers=headers, params=params) as response:
            body = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {body[:200]}")
            return await response.json(content_type=None)
    except (ClientError, asyncio.TimeoutError) as exc:
        raise RuntimeError(str(exc)) from exc


async def fetch_text(
    app: Sanic,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
) -> str:
    session: ClientSession = app.ctx.http
    try:
        async with session.get(url, headers=headers, params=params) as response:
            body = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {body[:200]}")
            return body
    except (ClientError, asyncio.TimeoutError) as exc:
        raise RuntimeError(str(exc)) from exc


async def kinopoisk_search(app: Sanic, term: str) -> list[dict[str, Any]]:
    term = term.strip()
    if not term:
        return []
    cache_key = f"search:{term.lower()}"

    async def factory() -> list[dict[str, Any]]:
        ensure_provider_token(app.ctx.settings.kinopoisk_token, "Kinopoisk token is missing")
        payload = await fetch_json(
            app,
            f"{KINOPOISK_API_BASE}/api/v2.1/films/search-by-keyword",
            headers={"X-API-KEY": app.ctx.settings.kinopoisk_token},
            params={"keyword": term},
        )
        films = payload.get("films") or []
        return [normalize_search_item(item) for item in films if item.get("filmId")]

    return await app.ctx.cache.get_or_set(cache_key, SEARCH_CACHE_TTL_SECONDS, factory)


async def kinopoisk_film(app: Sanic, kp_id: str) -> dict[str, Any]:
    kp_id = clean_digits(kp_id)
    if not kp_id:
        return {}
    cache_key = f"film:{kp_id}"

    async def factory() -> dict[str, Any]:
        ensure_provider_token(app.ctx.settings.kinopoisk_token, "Kinopoisk token is missing")
        payload = await fetch_json(
            app,
            f"{KINOPOISK_API_BASE}/api/v2.2/films/{kp_id}",
            headers={"X-API-KEY": app.ctx.settings.kinopoisk_token},
        )
        return normalize_film_payload(payload)

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def shikimori_info(app: Sanic, shiki_id: str) -> dict[str, Any]:
    shiki_id = clean_digits(shiki_id)
    if not shiki_id:
        return {}
    cache_key = f"shiki_info:{shiki_id}"

    async def factory() -> dict[str, Any]:
        ensure_provider_token(app.ctx.settings.kodik_token, "Kodik token is missing")
        payload = await fetch_json(
            app,
            f"{KODIK_API_BASE}/search",
            params={"token": app.ctx.settings.kodik_token, "shikimori_id": shiki_id},
        )
        first = (payload.get("results") or [{}])[0]
        return {
            "shikimori_id": shiki_id,
            "kinopoisk_id": first.get("kinopoisk_id"),
            "name_ru": first.get("title") or "",
            "name_en": first.get("title_orig") or "",
            "name_original": first.get("title_orig") or "",
            "slogan": first.get("other_title") or "",
            "year": str(first.get("year") or ""),
            "poster_url": first.get("poster") or "",
            "poster_url_preview": first.get("poster") or "",
            "screenshots": [],
            "videos": [],
            "staff": [],
            "sequels_and_prequels": [],
            "similars": [],
            "lists": {},
            "nudity_timings": [],
        }

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def shiki_to_kp_id(app: Sanic, shiki_id: str) -> str | None:
    shiki_id = clean_digits(shiki_id)
    if not shiki_id:
        return None
    cache_key = f"shiki_to_kp:{shiki_id}"

    async def factory() -> str | None:
        ensure_provider_token(app.ctx.settings.kodik_token, "Kodik token is missing")
        payload = await fetch_json(
            app,
            f"{KODIK_API_BASE}/search",
            params={"token": app.ctx.settings.kodik_token, "shikimori_id": shiki_id},
        )
        for item in payload.get("results") or []:
            kp_id = clean_digits(item.get("kinopoisk_id"))
            if kp_id:
                return kp_id
        return None

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def imdb_to_kp_id(app: Sanic, imdb_id: str) -> str | None:
    imdb_id = str(imdb_id or "").strip()
    if not imdb_id:
        return None
    cache_key = f"imdb_to_kp:{imdb_id.lower()}"

    async def factory() -> str | None:
        ensure_provider_token(app.ctx.settings.kinopoisk_token, "Kinopoisk token is missing")
        payload = await fetch_json(
            app,
            f"{KINOPOISK_API_BASE}/api/v2.2/films",
            headers={"X-API-KEY": app.ctx.settings.kinopoisk_token},
            params={"imdbId": imdb_id},
        )

        items = payload.get("items") or []
        for item in items:
            kp_id = clean_digits(item.get("kinopoiskId") or item.get("filmId"))
            if kp_id:
                return kp_id
        return None

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def fetch_kodik_results(
    app: Sanic, *, kinopoisk_id: str | None = None, shikimori_id: str | None = None
) -> list[dict[str, Any]]:
    cache_key = f"kodik:{kinopoisk_id or ''}:{shikimori_id or ''}"

    async def factory() -> list[dict[str, Any]]:
        ensure_provider_token(app.ctx.settings.kodik_token, "Kodik token is missing")
        params: dict[str, Any] = {"token": app.ctx.settings.kodik_token}
        if kinopoisk_id:
            params["kinopoisk_id"] = kinopoisk_id
        if shikimori_id:
            params["shikimori_id"] = shikimori_id
        payload = await fetch_json(app, f"{KODIK_API_BASE}/search", params=params)
        return payload.get("results") or []

    return await app.ctx.cache.get_or_set(cache_key, PLAYER_CACHE_TTL_SECONDS, factory)


async def get_players_by_kp(app: Sanic, kp_id: str, request: Request | None = None) -> dict[str, Any]:
    referer = str(request.headers.get("referer") or "") if request else ""
    cache_key = f"players_kp:{kp_id}:{referer}"

    async def factory() -> dict[str, Any]:
        tasks = [
            get_kodik_players(app, kinopoisk_id=kp_id),
            get_collaps_players(app, kp_id),
            get_lumex_players(app, kp_id),
            get_cdnmovies_players(app, kp_id, request=request),
            get_alloha_players(app, kp_id),
            get_hdvb_players(app, kp_id),
            get_vibix_players(app, kp_id),
            get_videoseed_players(app, kp_id),
            get_turbo_players(app, kp_id),
            get_militorys_players(app, kp_id),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        provider_maps: list[dict[str, Any]] = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Player provider failed for kp_id=%s: %s", kp_id, result)
                continue
            provider_maps.append(result)
        return merge_player_maps(*provider_maps)

    return await app.ctx.cache.get_or_set(cache_key, PLAYER_CACHE_TTL_SECONDS, factory)


async def get_players_by_shiki(
    app: Sanic, shiki_id: str, request: Request | None = None
) -> dict[str, Any]:
    referer = str(request.headers.get("referer") or "") if request else ""
    cache_key = f"players_shiki:{shiki_id}:{referer}"

    async def factory() -> dict[str, Any]:
        results = await get_kodik_players(app, shikimori_id=shiki_id)
        kp_id = await shiki_to_kp_id(app, shiki_id)
        if not kp_id:
            return results
        return merge_player_maps(results, await get_players_by_kp(app, kp_id, request=request))

    return await app.ctx.cache.get_or_set(cache_key, PLAYER_CACHE_TTL_SECONDS, factory)


async def get_kodik_players(
    app: Sanic, *, kinopoisk_id: str | None = None, shikimori_id: str | None = None
) -> dict[str, Any]:
    results = await fetch_kodik_results(app, kinopoisk_id=kinopoisk_id, shikimori_id=shikimori_id)
    return normalize_kodik_results(results)


def normalize_kodik_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    players: dict[str, Any] = {}
    seen_links: set[str] = set()

    for index, item in enumerate(results, start=1):
        link = str(item.get("link") or "").strip()
        if not link:
            continue
        if link.startswith("//"):
            link = f"https:{link}"
        elif not link.startswith("http://") and not link.startswith("https://"):
            link = f"https:{link.lstrip('/')}"

        if link in seen_links:
            continue
        seen_links.add(link)

        title = item.get("translation", {}).get("title") or item.get("title") or f"KODIK {index}"
        quality = str(item.get("quality") or "")
        key = f"KODIK>{index}"
        players[key] = normalize_shiki_player(title, link, quality)

    return players


async def get_collaps_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.collaps_token
    if not token:
        return {}
    provider_results: list[dict[str, Any]] = []
    endpoints = [
        "https://api.collaps.cc/list",
        "https://api.bhcesh.me/list",
    ]
    for endpoint in endpoints:
        try:
            payload = await fetch_json(app, endpoint, params={"token": token, "kinopoisk_id": kp_id})
            provider_results = payload.get("results") or []
            if provider_results:
                break
        except Exception as exc:  # noqa: BLE001
            logger.warning("Collaps provider failed at %s for kp_id=%s: %s", endpoint, kp_id, exc)

    players: dict[str, Any] = {}
    for index, item in enumerate(provider_results, start=1):
        iframe = str(item.get("iframe_url") or "").strip()
        if not iframe:
            continue
        players[f"COLLAPS>{index}"] = build_player_entry(
            "collaps",
            iframe,
            item.get("translation") or f"COLLAPS {index}",
        )
    return players


async def get_lumex_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.lumex_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://portal.lumex.host/api/short",
            params={"api_token": token, "kinopoisk_id": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Lumex provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload.get("data") or [], start=1):
        iframe = str(item.get("iframe_src") or "").strip()
        if not iframe:
            continue
        players[f"LUMEX>{index}"] = build_player_entry(
            "lumex",
            iframe,
            item.get("translation") or f"LUMEX {index}",
        )
    return players


async def get_cdnmovies_players(
    app: Sanic, kp_id: str, *, request: Request | None = None
) -> dict[str, Any]:
    token = app.ctx.settings.cdnmovies_token
    if not token:
        return {}
    referer = str(request.headers.get("referer") or "") if request else ""
    if "github.io" in referer:
        return {}
    try:
        response_text = await fetch_text(
            app,
            "https://api.cdnmovies.net/v1/contents",
            params={"token": token, "kinopoisk_id": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("CDNMovies provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    if "iframe" not in response_text.lower():
        return {}
    iframe = f"https://ugly-turkey.cdnmovies-stream.online/kinopoisk/{kp_id}/iframe?domain=reyohoho.github.io"
    return {"CDNMOVIES>1": build_player_entry("cdnmovies", iframe, "CDNMOVIES")}


async def get_alloha_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.alloha_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://api.apbugall.org",
            params={"token": token, "kp": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alloha provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    data = payload.get("data") or {}
    iframe = str(data.get("iframe") or "").strip()
    if not iframe:
        return {}
    iframe = re.sub(r"^https?://[^/]+", "https://attractive-as.allarknow.online", iframe)
    return {"ALLOHA>1": build_player_entry("alloha", iframe, "ALLOHA")}


async def get_hdvb_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.hdvb_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://kinolordfilm.com/api/videos.json",
            params={"token": token, "id_kp": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("HDVB provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload or [], start=1):
        iframe = str(item.get("iframe_url") or "").strip()
        if not iframe:
            continue
        players[f"HDVB>{index}"] = build_player_entry(
            "hdvb",
            iframe,
            item.get("translation") or f"HDVB {index}",
        )
    return players


async def get_vibix_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.vibix_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            f"https://vibix.org/api/v1/publisher/videos/kp/{kp_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vibix provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    iframe = str(payload.get("iframe_url") or "").strip()
    if not iframe:
        return {}
    return {"VIBIX>1": build_player_entry("vibix", iframe, "VIBIX")}


async def get_videoseed_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    try:
        session: ClientSession = app.ctx.http
        async with session.get(
            "https://tv-2-kinoserial.net/api.php",
            params={"kp_id": kp_id},
            allow_redirects=True,
        ) as response:
            if response.status >= 400:
                return {}
            target_url = str(response.url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Videoseed provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    if "embed" not in target_url:
        return {}
    return {"VIDEOSEED>1": build_player_entry("videoseed", target_url, "VIDEOSEED")}


async def get_turbo_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    iframe = f"https://4f463c79.obrut.show/embed?IDN=kinopoisk&id={kp_id}"
    try:
        session: ClientSession = app.ctx.http
        async with session.get(
            iframe,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
            },
        ) as response:
            if response.status >= 400:
                return {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Turbo provider failed for kp_id=%s: %s", kp_id, exc)
        return {}
    return {"TURBO>1": build_player_entry("turbo", iframe, "TURBO")}


async def get_militorys_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    try:
        page = await fetch_text(app, f"https://militorys.net/api/{kp_id}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Militorys provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    if "playlist_id" not in page:
        return {}
    iframe = f"https://militorys.net/van/{kp_id}"
    return {"MILITORYS>1": build_player_entry("militorys", iframe, "MILITORYS")}


async def get_top_movies(
    app: Sanic, period: str, *, type_filter: str = "all", limit: int | None = None
) -> list[dict[str, Any]]:
    cache_key = f"top:{period}:{type_filter}:{limit or 0}"

    async def factory() -> list[dict[str, Any]]:
        del period
        ensure_provider_token(app.ctx.settings.kinopoisk_token, "Kinopoisk token is missing")
        payload = await fetch_json(
            app,
            f"{KINOPOISK_API_BASE}/api/v2.2/films/collections",
            headers={"X-API-KEY": app.ctx.settings.kinopoisk_token},
            params={"type": "TOP_POPULAR_ALL", "page": 1},
        )
        items = [normalize_top_item(item) for item in payload.get("items") or []]

        if type_filter == "movie":
            items = [item for item in items if item["raw_data"].get("type") == "FILM"]
        elif type_filter == "series":
            items = [item for item in items if item["raw_data"].get("type") == "TV_SERIES"]

        if limit is not None and limit > 0:
            items = items[:limit]
        return items

    return await app.ctx.cache.get_or_set(cache_key, TOP_CACHE_TTL_SECONDS, factory)


async def get_random_movie(app: Sanic) -> dict[str, Any]:
    top_movies = await get_top_movies(app, "all", type_filter="all", limit=50)
    if not top_movies:
        return {}
    selected = random.choice(top_movies)
    kp_id = clean_digits(selected.get("kp_id"))
    if not kp_id:
        return selected
    try:
        return await kinopoisk_film(app, kp_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Random movie fallback for kp_id=%s: %s", kp_id, exc)
        return selected


def ensure_provider_token(token: str, message: str) -> None:
    if not token:
        raise RuntimeError(message)


app = create_app()


@app.exception(RuntimeError)
async def handle_runtime_error(_: Request, exception: RuntimeError):
    message = str(exception)
    status = 503 if "token is missing" in message.lower() else 502
    return json({"error": message}, status=status)


@app.exception(Exception)
async def handle_unexpected_error(_: Request, exception: Exception):
    logger.exception("Unhandled backend error: %s", exception)
    return json({"error": "Internal server error"}, status=500)


if __name__ == "__main__":
    app.run(host=SETTINGS.host, port=SETTINGS.port, debug=SETTINGS.debug, auto_reload=SETTINGS.debug)
