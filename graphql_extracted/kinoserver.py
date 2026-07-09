from __future__ import annotations

import asyncio
import json as jsonlib
import os
import random
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote_plus

from aiohttp import ClientError, ClientSession, ClientTimeout
from dotenv import load_dotenv
from sanic import Request, Sanic
from sanic.log import logger
from sanic.response import html, json, text

try:
    from .backend import GraphQLError as BackendGraphQLError
    from .backend import fetch_film_async as fetch_graphql_film
except ImportError:  # Direct execution: python graphql_extracted/kinoserver.py
    from backend import GraphQLError as BackendGraphQLError
    from backend import fetch_film_async as fetch_graphql_film

load_dotenv(Path(__file__).resolve().parent / ".env")

KINOPOISK_API_BASE = "https://kinopoiskapiunofficial.tech"
KINOPOISK_GRAPHQL_URL = "https://graphql.kinopoisk.ru/graphql"
KODIK_API_BASE = "https://kodikapi.com"
WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql"
DEFAULT_TIMEOUT_SECONDS = 12
PLAYER_CACHE_TTL_SECONDS = int(os.getenv("PLAYER_CACHE_TTL_SECONDS", "10800"))
MOVIE_CACHE_TTL_SECONDS = int(os.getenv("MOVIE_CACHE_TTL_SECONDS", "21600"))
SEARCH_CACHE_TTL_SECONDS = int(os.getenv("SEARCH_CACHE_TTL_SECONDS", "1800"))
TOP_CACHE_TTL_SECONDS = int(os.getenv("TOP_CACHE_TTL_SECONDS", "3600"))
DEFAULT_KP_EMBED_SOURCES = (
    "https://api1690380040.atomics.ws/embed/kp/{kp_id}",
    "https://api.atomics.ws/embed/kp/{kp_id}",
    "https://api.marts.ws/embed/kp/{kp_id}",
    "https://api.domem.ws/embed/kp/{kp_id}",
    "https://api.embess.ws/embed/kp/{kp_id}",
    "https://api.namy.ws/embed/kp/{kp_id}",
)
SWAGGER_UI_HTML = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ReYohoho Backend API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({url: '/openapi.json', dom_id: '#swagger-ui'});</script>
</body>
</html>"""


class TTLCache:
    def __init__(self, max_entries: int = 5000) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._max_entries = max(100, max_entries)

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
        if key not in self._store and len(self._store) >= self._max_entries:
            oldest_key = min(self._store, key=lambda item: self._store[item][0])
            self._store.pop(oldest_key, None)
            self._locks.pop(oldest_key, None)
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
    bazon_token: str = os.getenv("BAZON_TOKEN", "")
    collaps_token: str = os.getenv("COLLAPS_TOKEN", "")
    lumex_token: str = os.getenv("LUMEX_TOKEN", "")
    videocdn_token: str = os.getenv("VIDEOCDN_TOKEN", "")
    cdnmovies_token: str = os.getenv("CDNMOVIES_TOKEN", "")
    alloha_token: str = os.getenv("ALLOHA_TOKEN", "")
    hdvb_token: str = os.getenv("HDVB_TOKEN", "")
    vibix_token: str = os.getenv("VIBIX_TOKEN", "")
    befriend_token: str = os.getenv("BEFRIEND_TOKEN", "")
    obrut_embed_url: str = os.getenv(
        "OBRUT_EMBED_URL",
        "https://5414e3c9.obrut.show/embed/kDN?kinopoisk_id={kp_id}",
    )
    kp_embed_sources: tuple[str, ...] = tuple(
        source.strip()
        for source in os.getenv("KP_EMBED_SOURCES", "\n".join(DEFAULT_KP_EMBED_SOURCES)).splitlines()
        if source.strip()
    )
    tmdb_token: str = os.getenv("TMDB_TOKEN", "")
    youtube_token: str = os.getenv("YOUTUBE_TOKEN", "")
    kinopoisk_provider: str = os.getenv("KINOPOISK_PROVIDER", "auto").strip().lower()
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
                    "http://localhost:8000",
                    "http://127.0.0.1:8000",
                ]
            ),
        ).split(",")
        if origin.strip()
    )


SETTINGS = Settings()


def create_app() -> Sanic:
    app = Sanic("reyohoho")
    app.ctx.settings = SETTINGS
    app.ctx.cache = TTLCache(int(os.getenv("CACHE_MAX_ENTRIES", "5000")))
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
    @app.on_request
    async def handle_cors_preflight(request: Request):
        if request.method == "OPTIONS":
            return text("", status=204)

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


def build_openapi_schema() -> dict[str, Any]:
    kp_parameter = {
        "name": "kp_id",
        "in": "path",
        "required": True,
        "schema": {"type": "string", "pattern": "^[0-9]+$"},
        "description": "ID фильма или сериала на Кинопоиске",
    }
    json_response = {"200": {"description": "Успешный JSON-ответ"}}
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "ReYohoho Backend API",
            "version": "2.0.0",
            "description": "Карточки Кинопоиска, поиск, трейлеры и доступные iframe-плееры.",
        },
        "paths": {
            "/health": {"get": {"summary": "Состояние backend", "responses": json_response}},
            "/kp_info2/{kp_id}": {
                "get": {
                    "summary": "Карточка фильма",
                    "parameters": [
                        kp_parameter,
                        {
                            "name": "include_players",
                            "in": "query",
                            "schema": {"type": "boolean", "default": False},
                            "description": "Добавить проверенные iframe-плееры",
                        },
                    ],
                    "responses": json_response,
                }
            },
            "/kp_info/{kp_id}": {
                "get": {
                    "summary": "Карточка фильма (legacy)",
                    "parameters": [kp_parameter],
                    "responses": json_response,
                }
            },
            "/players/{kp_id}": {
                "get": {
                    "summary": "Первый рабочий набор плееров",
                    "parameters": [kp_parameter],
                    "responses": json_response,
                }
            },
            "/search/{term}": {
                "get": {
                    "summary": "Поиск по названию",
                    "parameters": [
                        {"name": "term", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": json_response,
                }
            },
            "/imdb_to_kp/{imdb_id}": {
                "get": {
                    "summary": "Преобразовать IMDb ID в ID Кинопоиска",
                    "parameters": [
                        {"name": "imdb_id", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": json_response,
                }
            },
            "/shiki_to_kp/{shiki_id}": {
                "get": {
                    "summary": "Преобразовать Shikimori ID в ID Кинопоиска",
                    "parameters": [
                        {"name": "shiki_id", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": json_response,
                }
            },
            "/trailer/youtube": {
                "get": {
                    "summary": "Найти трейлер на YouTube",
                    "parameters": [
                        {"name": "title", "in": "query", "required": True, "schema": {"type": "string"}},
                        {"name": "year", "in": "query", "schema": {"type": "string"}},
                    ],
                    "responses": json_response,
                }
            },
            "/trailer/tmdb/{media_type}/{tmdb_id}": {
                "get": {
                    "summary": "Получить трейлер TMDb",
                    "parameters": [
                        {
                            "name": "media_type",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string", "enum": ["movie", "tv"]},
                        },
                        {"name": "tmdb_id", "in": "path", "required": True, "schema": {"type": "string"}},
                    ],
                    "responses": json_response,
                }
            },
            "/cache": {
                "post": {
                    "summary": "Плееры по ID Кинопоиска (legacy)",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/x-www-form-urlencoded": {
                                "schema": {
                                    "type": "object",
                                    "required": ["kinopoisk"],
                                    "properties": {"kinopoisk": {"type": "string"}},
                                }
                            }
                        },
                    },
                    "responses": json_response,
                }
            },
        },
    }


def register_routes(app: Sanic) -> None:
    @app.get("/health")
    async def health(_: Request):
        settings: Settings = app.ctx.settings
        return json(
            {
                "ok": True,
                "movie_adapter": "backend.py",
                "providers": {
                    "kinopoisk": bool(settings.kinopoisk_token),
                    "kinopoisk_graphql": True,
                    "kodik": bool(settings.kodik_token),
                    "bazon": bool(settings.bazon_token),
                    "collaps": bool(settings.collaps_token),
                    "lumex": bool(settings.lumex_token),
                    "videocdn": bool(settings.videocdn_token),
                    "cdnmovies": bool(settings.cdnmovies_token),
                    "alloha": bool(settings.alloha_token),
                    "hdvb": bool(settings.hdvb_token),
                    "vibix": bool(settings.vibix_token),
                    "befriend": bool(settings.befriend_token),
                    "kp_embed_mirrors": len(settings.kp_embed_sources),
                    "obrut": bool(settings.obrut_embed_url),
                    "tmdb": bool(settings.tmdb_token),
                    "youtube": bool(settings.youtube_token),
                },
            }
        )

    @app.get("/openapi.json")
    async def openapi(_: Request):
        return json(build_openapi_schema())

    @app.get("/docs")
    async def api_docs(_: Request):
        return html(SWAGGER_UI_HTML)

    @app.get("/search/<term:str>")
    async def search_kinopoisk(_: Request, term: str):
        term = unquote_plus(term)
        data = await kinopoisk_search(app, term)
        return json(data)

    @app.get("/kp_info2/<kp_id:str>")
    async def kp_info(request: Request, kp_id: str):
        include_players = str(request.args.get("include_players", "0")).lower() in {"1", "true", "yes"}
        if include_players:
            movie, players = await asyncio.gather(
                kinopoisk_film(app, kp_id),
                get_players_by_kp(app, kp_id, request=request),
            )
            movie = {**movie, "players": players}
        else:
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

    @app.get("/trailer/youtube")
    async def youtube_trailer(request: Request):
        title = str(request.args.get("title") or "").strip()
        year = str(request.args.get("year") or "").strip()
        if not title:
            return json({}, status=400)
        return json(await get_youtube_trailer(app, title, year))

    @app.get("/trailer/tmdb/<media_type:str>/<tmdb_id:str>")
    async def tmdb_trailer(_: Request, media_type: str, tmdb_id: str):
        if media_type not in {"movie", "tv"}:
            return json({"error": "media_type must be movie or tv"}, status=400)
        return json(await get_tmdb_trailer(app, media_type, tmdb_id))

    @app.post("/cache")
    async def cache_players(request: Request):
        kp_id = clean_digits(request.form.get("kinopoisk"))
        if not kp_id:
            return json({})
        players = await get_players_by_kp(app, kp_id, request=request)
        return json(players)

    @app.get("/players/<kp_id:str>")
    async def players_by_kp(request: Request, kp_id: str):
        kp_id = clean_digits(kp_id)
        if not kp_id:
            return json({})
        return json(await get_players_by_kp(app, kp_id, request=request))

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


def use_kinopoisk_graphql(settings: Settings) -> bool:
    if settings.kinopoisk_provider == "graphql":
        return True
    if settings.kinopoisk_provider == "tech":
        return False
    return not bool(settings.kinopoisk_token)


def kp_graphql_headers(referer: str = "https://www.kinopoisk.ru/") -> dict[str, str]:
    return {
        "accept": "application/json",
        "content-type": "application/json",
        "origin": "https://www.kinopoisk.ru",
        "referer": referer,
        "service-id": "25",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        ),
        "x-preferred-language": "ru",
    }


def generic_user_agent() -> str:
    return "ReYohohoBackend/1.0 (https://github.com/dav2010id; contact: dev@example.com)"


def kp_image_url(value: Any, size: str | None = None) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    if url.startswith("//"):
        url = f"https:{url}"
    if size and "avatars.mds.yandex.net" in url:
        url = re.sub(r"/(?:orig|\d+x(?:\d+)?)$", "", url.rstrip("/"))
        return f"{url}/{size}"
    return url


def first_present(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return None


def gql_query_path(*parts: str) -> Path:
    return Path(__file__).resolve().parent.joinpath(*parts)


def load_gql_query(name: str) -> str:
    candidates = [
        gql_query_path("kp_graphql_queries", f"{name}.gql"),
        gql_query_path(".jellyfin-kp-white_tmp", "KinopoiskWhite", "Api", "Queries", f"{name}.gql"),
    ]
    for path in candidates:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    raise RuntimeError(f"GraphQL query template is missing: {name}.gql")


def load_kinopapi_body(*parts: str) -> dict[str, Any]:
    candidates = [
        gql_query_path("kp_graphql_queries", "kinopapi", *parts),
        gql_query_path(".kinopapi_tmp", "kinopapi", "templates", "bodies", *parts),
    ]
    for path in candidates:
        if path.is_file():
            return jsonlib.loads(path.read_text(encoding="utf-8"))
    raise RuntimeError(f"GraphQL JSON body template is missing: {'/'.join(parts)}")


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
    kp_id = clean_digits(payload.get("kinopoiskId") or payload.get("filmId"))
    poster = payload.get("posterUrl") or payload.get("posterUrlPreview") or ""

    return {
        "kinopoisk_id": int(kp_id) if kp_id else None,
        "imdb_id": payload.get("imdbId"),
        "name_ru": payload.get("nameRu") or "",
        "name_en": payload.get("nameEn"),
        "name_original": payload.get("nameOriginal") or "",
        "poster_url": poster,
        "poster_url_preview": payload.get("posterUrlPreview") or poster,
        "reviews_count": payload.get("reviewsCount") or 0,
        "rating_good_review": parse_float(payload.get("ratingGoodReview")),
        "rating_good_review_vote_count": payload.get("ratingGoodReviewVoteCount") or 0,
        "rating_kinopoisk": parse_float(payload.get("ratingKinopoisk")),
        "rating_kinopoisk_vote_count": payload.get("ratingKinopoiskVoteCount") or 0,
        "rating_imdb": parse_float(payload.get("ratingImdb")),
        "rating_imdb_vote_count": payload.get("ratingImdbVoteCount") or 0,
        "rating_film_critics": parse_float(payload.get("ratingFilmCritics")),
        "rating_film_critics_vote_count": payload.get("ratingFilmCriticsVoteCount") or 0,
        "rating_await": parse_float(payload.get("ratingAwait")),
        "rating_await_count": payload.get("ratingAwaitCount") or 0,
        "rating_rf_critics": parse_float(payload.get("ratingRfCritics")),
        "rating_rf_critics_vote_count": payload.get("ratingRfCriticsVoteCount") or 0,
        "year": int(year) if str(year or "").isdigit() else year,
        "film_length": payload.get("filmLength"),
        "is_tickets_available": bool(payload.get("isTicketsAvailable")),
        "production_status": normalize_production_status(payload.get("productionStatus"), year),
        "type": map_kinopoisk_type(payload.get("type")),
        "has_imax": bool(payload.get("hasImax")),
        "has_3_d": bool(payload.get("has3D")),
        "countries": payload.get("countries") or [],
        "genres": payload.get("genres") or [],
        "start_year": payload.get("startYear"),
        "end_year": payload.get("endYear"),
        "cover_url": payload.get("coverUrl"),
        "logo_url": payload.get("logoUrl"),
        "web_url": payload.get("webUrl") or f"https://www.kinopoisk.ru/film/{kp_id}/",
        "slogan": payload.get("slogan"),
        "description": payload.get("description"),
        "short_description": payload.get("shortDescription"),
        "editor_annotation": payload.get("editorAnnotation"),
        "rating_mpaa": payload.get("ratingMpaa"),
        "rating_age_limits": payload.get("ratingAgeLimits"),
        "last_sync": payload.get("lastSync") or datetime.utcnow().isoformat(),
        "serial": bool(payload.get("serial")),
        "short_film": bool(payload.get("shortFilm")),
        "completed": bool(payload.get("completed")),
        "sequels_and_prequels": [],
        "similars": [],
        "videos": [],
        "staff": [],
        "nudity_timings": [],
        "lists": default_lists(),
    }


def default_lists() -> dict[str, bool]:
    return {
        "isFavorite": False,
        "isHistory": True,
        "isLater": False,
        "isCompleted": False,
        "isAbandoned": False,
        "isWatching": False,
        "isRated": False,
    }


def normalize_production_status(status: Any, year: Any) -> Any:
    if status:
        return status
    try:
        if int(year) >= datetime.utcnow().year:
            return "POST_PRODUCTION"
    except (TypeError, ValueError):
        pass
    return None


def gql_person_name(item: dict[str, Any]) -> str:
    person = item.get("person") or item
    return person.get("name") or person.get("originalName") or ""


def gql_staff_items(items: list[dict[str, Any]], profession_key: str, profession_text: str) -> list[dict[str, Any]]:
    staff: list[dict[str, Any]] = []
    for item in items or []:
        person = item.get("person") or {}
        person_id = person.get("id")
        if not person_id:
            continue
        staff.append(
            {
                "staff_id": person_id,
                "staffId": person_id,
                "name_ru": person.get("name") or "",
                "nameRu": person.get("name") or "",
                "name_en": person.get("originalName") or "",
                "nameEn": person.get("originalName") or "",
                "description": "",
                "poster_url": "",
                "posterUrl": "",
                "profession_text": profession_text,
                "professionText": profession_text,
                "profession_key": profession_key,
                "professionKey": profession_key,
            }
        )
    return staff


def normalize_gql_movie_card(movie: dict[str, Any], relation_type: str = "SIMILAR") -> dict[str, Any]:
    title = movie.get("title") or {}
    film_id = movie.get("id")
    poster_url = f"https://kinopoiskapiunofficial.tech/images/posters/kp/{film_id}.jpg" if film_id else ""
    poster_preview = f"https://kinopoiskapiunofficial.tech/images/posters/kp_small/{film_id}.jpg" if film_id else ""
    return {
        "film_id": film_id,
        "name_ru": title.get("russian") or "",
        "name_en": title.get("english") or title.get("original"),
        "name_original": title.get("original") or "",
        "poster_url": poster_url,
        "poster_url_preview": poster_preview,
        "relation_type": relation_type,
    }


def normalize_gql_search_movie(movie: dict[str, Any]) -> dict[str, Any]:
    title_data = movie.get("title") or {}
    year = (
        movie.get("productionYear")
        or ((movie.get("releaseYears") or {}).get("start") if isinstance(movie.get("releaseYears"), dict) else None)
    )
    title_base = title_data.get("russian") or title_data.get("original") or ""
    title = f"{title_base} ({year})" if title_base and year else title_base
    poster = movie.get("poster") or {}
    raw = {
        "filmId": movie.get("id"),
        "kinopoiskId": movie.get("id"),
        "nameRu": title_data.get("russian") or "",
        "nameOriginal": title_data.get("original") or "",
        "year": year,
        "posterUrl": kp_image_url(poster.get("avatarsUrl"), "576x"),
        "posterUrlPreview": kp_image_url(poster.get("avatarsUrl"), "300x"),
        "rating": (((movie.get("rating") or {}).get("kinopoisk") or {}).get("value")),
        "type": map_kinopoisk_type(movie.get("type") or movie.get("__typename")),
    }
    return {
        "id": movie.get("id"),
        "kp_id": str(movie.get("id") or ""),
        "title": title,
        "poster": raw["posterUrlPreview"] or raw["posterUrl"],
        "average_rating": parse_float(raw["rating"]),
        "raw_data": raw,
    }


def normalize_gql_film_payload(
    film: dict[str, Any],
    *,
    imdb_id: str | None = None,
    similars: list[dict[str, Any]] | None = None,
    videos: list[dict[str, Any]] | None = None,
    reviews_total: int | None = None,
) -> dict[str, Any]:
    title = film.get("title") or {}
    rating = film.get("rating") or {}
    poster_url = first_present(
        ((film.get("poster") or {}).get("avatarsUrl")),
        (((film.get("gallery") or {}).get("posters") or {}).get("marketingVertical") or {}).get("avatarsUrl"),
        (((film.get("gallery") or {}).get("posters") or {}).get("kpVertical") or {}).get("avatarsUrl"),
        (((film.get("gallery") or {}).get("posters") or {}).get("vertical") or {}).get("avatarsUrl"),
    )
    cover_url = first_present(
        (((film.get("cover") or {}).get("image") or {}).get("avatarsUrl")),
        (((film.get("gallery") or {}).get("covers") or {}).get("horizontal") or {}).get("avatarsUrl"),
        (((film.get("gallery") or {}).get("covers") or {}).get("square") or {}).get("avatarsUrl"),
    )
    logo_url = first_present(
        (((film.get("gallery") or {}).get("logos") or {}).get("horizontal") or {}).get("avatarsUrl"),
        (((film.get("gallery") or {}).get("logos") or {}).get("colored") or {}).get("avatarsUrl"),
    )
    kinopoisk_rating = rating.get("kinopoisk") or {}
    imdb_rating = rating.get("imdb") or {}
    rf_critics = rating.get("russianCritics") or {}
    world_critics = rating.get("worldwideCritics") or {}
    review_count = rating.get("reviewCount") or {}
    restriction = film.get("restriction") or {}
    release_options = film.get("releaseOptions") or {}
    kp_id = str(film.get("id") or "")
    sequels = []
    for item in ((film.get("sequelsPrequels") or {}).get("items") or []):
        movie = item.get("movie") or {}
        sequels.append(normalize_gql_movie_card(movie, item.get("relationType") or "RELATED"))

    rh_poster_url = f"https://kinopoiskapiunofficial.tech/images/posters/kp/{kp_id}.jpg" if kp_id else kp_image_url(poster_url, "576x")
    rh_poster_preview = kp_image_url(poster_url, "300x450") or (
        f"https://kinopoiskapiunofficial.tech/images/posters/kp_small/{kp_id}.jpg" if kp_id else ""
    )

    return {
        "kinopoisk_id": int(kp_id) if kp_id else None,
        "imdb_id": imdb_id,
        "name_ru": title.get("russian") or "",
        "name_en": title.get("english"),
        "name_original": title.get("original") or "",
        "poster_url": rh_poster_url,
        "poster_url_preview": rh_poster_preview,
        "reviews_count": reviews_total if reviews_total is not None else review_count.get("count") or 0,
        "rating_good_review": world_critics.get("percent"),
        "rating_good_review_vote_count": world_critics.get("positiveCount") or 0,
        "rating_kinopoisk": parse_float(kinopoisk_rating.get("value")),
        "rating_kinopoisk_vote_count": kinopoisk_rating.get("count") or 0,
        "rating_imdb": parse_float(imdb_rating.get("value")),
        "rating_imdb_vote_count": imdb_rating.get("count") or 0,
        "rating_film_critics": parse_float(world_critics.get("value")),
        "rating_film_critics_vote_count": world_critics.get("count") or 0,
        "rating_await": parse_float(((rating.get("plannedToWatch") or {}).get("value"))),
        "rating_await_count": ((rating.get("plannedToWatch") or {}).get("count")) or 0,
        "rating_rf_critics": parse_float(rf_critics.get("value")),
        "rating_rf_critics_vote_count": rf_critics.get("count") or 0,
        "year": film.get("productionYear"),
        "film_length": film.get("duration"),
        "is_tickets_available": bool(film.get("isTicketsAvailable")),
        "production_status": normalize_production_status(film.get("productionStatus"), film.get("productionYear")),
        "type": map_kinopoisk_type(film.get("__typename") or film.get("type")),
        "has_imax": bool(release_options.get("isImax")),
        "has_3_d": bool(release_options.get("is3d")),
        "countries": [{"country": item.get("name") or ""} for item in film.get("countries") or []],
        "genres": [{"genre": item.get("name") or ""} for item in film.get("genres") or []],
        "start_year": None,
        "end_year": None,
        "cover_url": kp_image_url(cover_url, "576x") or None,
        "logo_url": kp_image_url(logo_url, "576x") or None,
        "web_url": f"https://www.kinopoisk.ru/film/{kp_id}/",
        "slogan": film.get("tagline"),
        "description": film.get("synopsis"),
        "short_description": film.get("shortDescription"),
        "editor_annotation": film.get("editorAnnotation"),
        "rating_mpaa": restriction.get("mpaa"),
        "rating_age_limits": restriction.get("age"),
        "last_sync": datetime.utcnow().isoformat(),
        "serial": map_kinopoisk_type(film.get("__typename") or film.get("type")) != "FILM",
        "short_film": bool(film.get("isShortFilm")),
        "completed": False,
        "sequels_and_prequels": sequels,
        "similars": similars or [],
        "videos": [],
        "staff": [],
        "nudity_timings": [],
        "lists": default_lists(),
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
    ssl: bool | None = None,
) -> dict[str, Any]:
    session: ClientSession = app.ctx.http
    try:
        async with session.get(url, headers=headers, params=params, ssl=ssl) as response:
            body = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {body[:200]}")
            return await response.json(content_type=None)
    except (ClientError, asyncio.TimeoutError) as exc:
        raise RuntimeError(str(exc)) from exc


async def post_json(
    app: Sanic,
    url: str,
    *,
    payload: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    session: ClientSession = app.ctx.http
    try:
        async with session.post(url, headers=headers, json=payload) as response:
            body = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}: {body[:300]}")
            return jsonlib.loads(body)
    except (ClientError, asyncio.TimeoutError, jsonlib.JSONDecodeError) as exc:
        raise RuntimeError(str(exc)) from exc


async def kinopoisk_graphql(
    app: Sanic,
    operation_name: str,
    query: str,
    variables: dict[str, Any],
    *,
    referer: str = "https://www.kinopoisk.ru/",
) -> dict[str, Any]:
    payload = {
        "operationName": operation_name,
        "variables": variables,
        "query": query,
    }
    data = await post_json(
        app,
        KINOPOISK_GRAPHQL_URL,
        headers=kp_graphql_headers(referer),
        payload=payload,
    )
    errors = data.get("errors") or []
    if errors and not data.get("data"):
        message = errors[0].get("message") if isinstance(errors[0], dict) else str(errors[0])
        raise RuntimeError(f"Kinopoisk GraphQL error: {message}")
    return data


async def kinopoisk_graphql_from_body(
    app: Sanic,
    body: dict[str, Any],
    *,
    referer: str = "https://www.kinopoisk.ru/",
) -> dict[str, Any]:
    operation_name = str(body.get("operationName") or "")
    if not operation_name:
        raise RuntimeError("GraphQL operationName is missing")
    data = await post_json(
        app,
        f"{KINOPOISK_GRAPHQL_URL}/?operationName={operation_name}",
        headers=kp_graphql_headers(referer),
        payload=body,
    )
    errors = data.get("errors") or []
    if errors and not data.get("data"):
        message = errors[0].get("message") if isinstance(errors[0], dict) else str(errors[0])
        raise RuntimeError(f"Kinopoisk GraphQL error: {message}")
    return data


async def fetch_text(
    app: Sanic,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    ssl: bool | None = None,
) -> str:
    session: ClientSession = app.ctx.http
    try:
        async with session.get(url, headers=headers, params=params, ssl=ssl) as response:
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
        if use_kinopoisk_graphql(app.ctx.settings):
            return await kinopoisk_graphql_search(app, term)

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
        if use_kinopoisk_graphql(app.ctx.settings):
            return await kinopoisk_graphql_film(app, kp_id)

        ensure_provider_token(app.ctx.settings.kinopoisk_token, "Kinopoisk token is missing")
        payload = await fetch_json(
            app,
            f"{KINOPOISK_API_BASE}/api/v2.2/films/{kp_id}",
            headers={"X-API-KEY": app.ctx.settings.kinopoisk_token},
        )
        return normalize_film_payload(payload)

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def kinopoisk_graphql_search(app: Sanic, term: str) -> list[dict[str, Any]]:
    body = load_kinopapi_body("search", "SuggestSearch.json")
    body["variables"].update({"keyword": term, "yandexCityId": 0, "limit": 10})
    data = await kinopoisk_graphql_from_body(app, body)
    top = (((data.get("data") or {}).get("suggest") or {}).get("top") or {})
    results: list[dict[str, Any]] = []

    top_result = ((top.get("topResult") or {}).get("global") or {})
    if top_result.get("__typename") in {"Film", "TvSeries", "Movie", "MiniSeries", "TvShow", "Video"}:
        results.append(normalize_gql_search_movie(top_result))

    for item in top.get("movies") or []:
        movie = item.get("movie") or {}
        if movie.get("id"):
            normalized = normalize_gql_search_movie(movie)
            if all(str(existing.get("kp_id")) != str(normalized.get("kp_id")) for existing in results):
                results.append(normalized)
    return results


async def kinopoisk_graphql_film(app: Sanic, kp_id: str) -> dict[str, Any]:
    try:
        film_response, imdb_id = await asyncio.gather(
            fetch_graphql_film(int(kp_id), app.ctx.http),
            get_imdb_id_by_kp(app, kp_id),
        )
    except BackendGraphQLError as exc:
        raise RuntimeError(str(exc)) from exc

    payload = film_response.model_dump(mode="json")
    payload["imdb_id"] = imdb_id
    return payload


async def get_imdb_id_by_kp(app: Sanic, kp_id: str) -> str | None:
    kp_id = clean_digits(kp_id)
    if not kp_id:
        return None
    cache_key = f"kp_to_imdb:{kp_id}"

    async def factory() -> str | None:
        query = f'SELECT ?imdb WHERE {{ ?item wdt:P2603 "{kp_id}"; wdt:P345 ?imdb. }} LIMIT 1'
        try:
            payload = await fetch_json(
                app,
                WIKIDATA_SPARQL_URL,
                headers={
                    "Accept": "application/sparql-results+json",
                    "User-Agent": generic_user_agent(),
                },
                params={"query": query, "format": "json"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wikidata IMDb lookup failed for kp_id=%s: %s", kp_id, exc)
            return None
        bindings = ((payload.get("results") or {}).get("bindings") or [])
        if not bindings:
            return None
        imdb = ((bindings[0].get("imdb") or {}).get("value") or "").strip()
        return imdb or None

    return await app.ctx.cache.get_or_set(cache_key, MOVIE_CACHE_TTL_SECONDS, factory)


async def kinopoisk_graphql_similars(app: Sanic, kp_id: str) -> list[dict[str, Any]]:
    try:
        body = load_kinopapi_body("film", "FilmSimilarMovies.json")
        body["variables"].update({"filmId": int(kp_id), "similarMoviesLimit": 10, "withUserData": False})
        data = await kinopoisk_graphql_from_body(
            app,
            body,
            referer=f"https://www.kinopoisk.ru/film/{kp_id}/",
        )
        items = (
            (((data.get("data") or {}).get("film") or {}).get("userRecommendations") or {}).get("items")
            or []
        )
        return [normalize_gql_movie_card(item.get("movie") or {}) for item in items if (item.get("movie") or {}).get("id")]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kinopoisk GraphQL similars failed for kp_id=%s: %s", kp_id, exc)
        return []


async def kinopoisk_graphql_trailers(app: Sanic, kp_id: str) -> list[dict[str, Any]]:
    try:
        body = load_kinopapi_body("movie", "MovieTrailersWithOrder.json")
        body["variables"].update({"movieId": int(kp_id), "trailersLimit": 10, "orderBy": "MAKE_DATE_DESC"})
        data = await kinopoisk_graphql_from_body(
            app,
            body,
            referer=f"https://www.kinopoisk.ru/film/{kp_id}/",
        )
        items = ((((data.get("data") or {}).get("movie") or {}).get("trailers") or {}).get("items") or [])
        videos = []
        for item in items:
            videos.append(
                {
                    "id": item.get("id"),
                    "name": item.get("title") or "",
                    "title": item.get("title") or "",
                    "url": item.get("streamUrl") or item.get("sourceVideoUrl") or "",
                    "site": "KINOPOISK",
                    "preview_url": kp_image_url(((item.get("preview") or {}).get("avatarsUrl")), "576x"),
                    "previewUrl": kp_image_url(((item.get("preview") or {}).get("avatarsUrl")), "576x"),
                    "duration": item.get("duration"),
                    "created_at": item.get("createdAt"),
                    "createdAt": item.get("createdAt"),
                }
            )
        return videos
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kinopoisk GraphQL trailers failed for kp_id=%s: %s", kp_id, exc)
        return []


async def kinopoisk_graphql_reviews_total(app: Sanic, kp_id: str) -> int | None:
    try:
        body = load_kinopapi_body("movie", "MovieUsersReviews.json")
        body["variables"].update(
            {
                "movieId": int(kp_id),
                "userReviewsOrderBy": "TOP_USEFULNESS_THEN_CREATED_AT_DESC",
                "userReviewsLimit": 1,
                "withUserData": False,
            }
        )
        data = await kinopoisk_graphql_from_body(
            app,
            body,
            referer=f"https://www.kinopoisk.ru/film/{kp_id}/",
        )
        reviews = (((data.get("data") or {}).get("movie") or {}).get("usersReviewsPaginatedList") or {})
        total = reviews.get("total")
        return int(total) if total is not None else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kinopoisk GraphQL reviews failed for kp_id=%s: %s", kp_id, exc)
        return None


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
    kp_id = clean_digits(kp_id)
    if not kp_id:
        return {}
    cache_key = f"players_kp:{kp_id}"

    async def factory() -> dict[str, Any]:
        tasks = [
            get_collaps_players(app, kp_id),
            get_alloha_players(app, kp_id),
            get_befriend_players(app, kp_id),
            get_kp_embed_players(app, kp_id),
            get_turbo_players(app, kp_id),
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
    cache_key = f"players_shiki:{shiki_id}"

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
    if not app.ctx.settings.kodik_token:
        return {}
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


async def get_bazon_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.bazon_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://bazon.cc/api/search",
            params={"token": token, "kp": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Bazon provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload.get("results") or [], start=1):
        iframe = str(item.get("link") or "").strip()
        if not iframe:
            continue
        players[f"BAZON>{index}"] = build_player_entry(
            "bazon",
            iframe,
            item.get("translation") or item.get("quality") or f"Базон {index}",
            str(item.get("quality") or ""),
        )
    return players


async def get_collaps_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.collaps_token
    if not token:
        return {}
    provider_results: list[dict[str, Any]] = []
    endpoints = [
        "https://apicollaps.cc/list",
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


async def get_videocdn_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.videocdn_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://videocdn.tv/api/short",
            params={"api_token": token, "kinopoisk_id": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("VideoCDN provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload.get("data") or [], start=1):
        iframe = str(item.get("iframe_src") or "").strip()
        if not iframe:
            continue
        players[f"VIDEOCDN>{index}"] = build_player_entry(
            "videocdn",
            iframe,
            item.get("translation") or item.get("translator") or f"Видеосдн {index}",
            str(item.get("quality") or ""),
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
            "https://api.alloha.tv/",
            params={"token": token, "kp": kp_id},
            ssl=False,
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


async def get_befriend_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.befriend_token
    if not token:
        return {}
    iframe = f"https://befriend.stloadi.live/?token={token}&kp={kp_id}"
    if not await probe_embed_player(app, iframe):
        return {}
    return {"BEFRIEND>1": build_player_entry("befriend", iframe, "ALLOHA (fallback)")}


async def get_hdvb_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    token = app.ctx.settings.hdvb_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            "https://apivb.info/api/videos.json",
            params={"token": token, "id_kp": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("HDVB provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    items = payload if isinstance(payload, list) else payload.get("results") or payload.get("data") or []
    for index, item in enumerate(items or [], start=1):
        iframe = str(item.get("iframe_url") or "").strip()
        if not iframe:
            continue
        players[f"HDVB>{index}"] = build_player_entry(
            "hdvb",
            iframe,
            item.get("translation") or f"HDVB {index}",
        )
    return players


async def get_iframe_video_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    try:
        payload = await fetch_json(
            app,
            "https://iframe.video/api/v2/search",
            params={"kp": kp_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("iframe.video provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload.get("results") or [], start=1):
        path = str(item.get("path") or "").strip()
        if not path:
            continue
        iframe = path if path.startswith("http") else f"https://iframe.video{path if path.startswith('/') else '/' + path}"
        players[f"IFRAME>{index}"] = build_player_entry(
            "iframe.video",
            iframe,
            item.get("translation") or item.get("title") or f"Ифрейм {index}",
            str(item.get("quality") or ""),
        )
    return players


async def get_pleer_video_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    try:
        payload = await fetch_json(app, f"https://pleer.video/{kp_id}.json")
    except Exception as exc:  # noqa: BLE001
        logger.warning("pleer.video provider failed for kp_id=%s: %s", kp_id, exc)
        return {}

    players: dict[str, Any] = {}
    for index, item in enumerate(payload.get("embeds") or [], start=1):
        iframe = str(item.get("iframe") or "").strip()
        if not iframe:
            continue
        players[f"PLEER>{index}"] = build_player_entry(
            "pleer.video",
            iframe,
            item.get("translation") or item.get("title") or f"Иви {index}",
            str(item.get("quality") or ""),
        )
    return players


def normalize_youtube_video(video_id: str, title: str = "") -> dict[str, Any]:
    if not video_id:
        return {}
    return {
        "translate": title or "Трейлер",
        "iframe": f"https://www.youtube.com/embed/{video_id}",
        "quality": "",
        "warning": False,
        "source": "youtube",
        "preview": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
    }


async def get_tmdb_trailer(app: Sanic, media_type: str, tmdb_id: str) -> dict[str, Any]:
    token = app.ctx.settings.tmdb_token
    if not token:
        return {}
    try:
        payload = await fetch_json(
            app,
            f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}",
            params={
                "language": "ru",
                "append_to_response": "videos",
                "api_key": token,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("TMDb trailer provider failed for %s/%s: %s", media_type, tmdb_id, exc)
        return {}

    videos = ((payload.get("videos") or {}).get("results") or [])
    preferred = None
    for item in videos:
        if item.get("site") == "YouTube" and item.get("type") in {"Trailer", "Teaser"}:
            preferred = item
            break
    if preferred is None and videos:
        preferred = videos[0]
    if not preferred:
        return {}
    return normalize_youtube_video(str(preferred.get("key") or ""), preferred.get("name") or "Трейлер (TMDb)")


async def get_youtube_trailer(app: Sanic, title: str, year: str = "") -> dict[str, Any]:
    token = app.ctx.settings.youtube_token
    if not token:
        return {}
    query = f"{title} {year} трейлер".strip()
    try:
        payload = await fetch_json(
            app,
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "id,snippet",
                "maxResults": 1,
                "key": token,
                "q": query,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("YouTube trailer provider failed for query=%s: %s", query, exc)
        return {}

    item = (payload.get("items") or [{}])[0]
    video_id = ((item.get("id") or {}).get("videoId") or "")
    title_text = ((item.get("snippet") or {}).get("title") or "Трейлер (YouTube)")
    return normalize_youtube_video(str(video_id), title_text)


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


async def probe_embed_player(app: Sanic, url: str) -> bool:
    session: ClientSession = app.ctx.http
    try:
        async with session.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
                ),
                "Referer": "https://www.kinopoisk.ru/",
            },
            allow_redirects=True,
            timeout=ClientTimeout(total=5, connect=2, sock_connect=2, sock_read=4),
        ) as response:
            if response.status >= 400 or "text/html" not in response.headers.get("content-type", ""):
                return False
            sample = (await response.content.read(32768)).decode("utf-8", errors="ignore").lower()
            if any(marker in sample for marker in ("<title>not found", "сериал не найден", "фильм не найден")):
                return False
            return any(marker in sample for marker in ("player", "m3u8", "hls", "<video"))
    except (ClientError, asyncio.TimeoutError):
        return False


async def get_kp_embed_players(app: Sanic, kp_id: str) -> dict[str, Any]:
    sources = app.ctx.settings.kp_embed_sources
    preferred = getattr(app.ctx, "preferred_kp_embed_source", None)

    def player(template: str, index: int) -> dict[str, Any]:
        url = template.format(kp_id=kp_id)
        host = (url.split("/", 3)[2].split(":", 1)[0]).removeprefix("api.")
        label = host.split(".", 1)[0].upper()
        return {
            "KPMIRROR>1": build_player_entry(
                "kp_embed",
                url,
                f"{label} (mirror {index})",
            )
        }

    if preferred in sources:
        preferred_index = sources.index(preferred) + 1
        if await probe_embed_player(app, preferred.format(kp_id=kp_id)):
            return player(preferred, preferred_index)
        app.ctx.preferred_kp_embed_source = None

    candidates = [
        (index, template, template.format(kp_id=kp_id))
        for index, template in enumerate(sources, start=1)
        if template != preferred
    ]

    async def check(index: int, template: str, url: str) -> tuple[int, str, bool]:
        return index, template, await probe_embed_player(app, url)

    tasks = [asyncio.create_task(check(index, template, url)) for index, template, url in candidates]
    try:
        for completed in asyncio.as_completed(tasks):
            index, template, available = await completed
            if not available:
                continue
            app.ctx.preferred_kp_embed_source = template
            return player(template, index)
        return {}
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


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
    iframe = app.ctx.settings.obrut_embed_url.format(kp_id=kp_id)
    if not iframe or not await probe_embed_player(app, iframe):
        return {}
    return {"OBRUT>1": build_player_entry("obrut", iframe, "OBRUT")}


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
