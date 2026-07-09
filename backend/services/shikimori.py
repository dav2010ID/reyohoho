from __future__ import annotations

import asyncio
import re
from typing import Any

from aiohttp import ClientError
from sanic import Sanic


SHIKIMORI_GRAPHQL_URL = "https://shikimori.io/api/graphql"
SHIKIMORI_CACHE_TTL_SECONDS = 21_600
ANIME_FIELDS = """
  id malId name russian licenseNameRu english japanese synonyms
  kind rating score status episodes episodesAired duration
  airedOn { year month day date }
  releasedOn { year month day date }
  poster { originalUrl mainUrl }
  genres { id name russian kind }
  studios { id name imageUrl }
  description
  externalLinks { kind url }
  related {
    relationKind relationText
    anime {
      id name russian english japanese score
      poster { originalUrl mainUrl }
      externalLinks { kind url }
    }
  }
"""


def shikimori_headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ReYohoho/1.0 (https://github.com/dav2010id/reyohoho)",
    }


async def shikimori_graphql(app: Sanic, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    try:
        async with app.ctx.http.post(
            SHIKIMORI_GRAPHQL_URL,
            headers=shikimori_headers(),
            json={"query": query, "variables": variables},
        ) as response:
            payload = await response.json(content_type=None)
            if response.status >= 400 or payload.get("errors"):
                raise RuntimeError(f"Shikimori GraphQL error: {payload.get('errors') or response.status}")
            return payload.get("data") or {}
    except (ClientError, asyncio.TimeoutError) as exc:
        raise RuntimeError(f"Shikimori request failed: {exc}") from exc


async def anime_by_id(app: Sanic, shiki_id: str) -> dict[str, Any] | None:
    cache_key = f"shikimori:anime:{shiki_id}"

    async def factory():
        query = f"query($ids: String!) {{ animes(ids: $ids, limit: 1) {{ {ANIME_FIELDS} }} }}"
        data = await shikimori_graphql(app, query, {"ids": str(shiki_id)})
        return (data.get("animes") or [None])[0]

    return await app.ctx.cache.get_or_set(cache_key, SHIKIMORI_CACHE_TTL_SECONDS, factory)


def kinopoisk_id_from_anime(anime: dict[str, Any]) -> str | None:
    for link in anime.get("externalLinks") or []:
        if link.get("kind") != "kinopoisk":
            continue
        match = re.search(r"kinopoisk\.ru/(?:film|series)/(\d+)", str(link.get("url") or ""))
        if match:
            return match.group(1)
    return None


async def anime_by_kinopoisk(
    app: Sanic, kp_id: str, search: str
) -> list[dict[str, Any]]:
    cache_key = f"shikimori:kp:{kp_id}:{search.casefold()}"

    async def factory():
        return [
            anime
            for anime in await search_anime(app, search)
            if kinopoisk_id_from_anime(anime) == str(kp_id)
        ]

    return await app.ctx.cache.get_or_set(cache_key, SHIKIMORI_CACHE_TTL_SECONDS, factory)


async def search_anime(app: Sanic, search: str) -> list[dict[str, Any]]:
    search = str(search or "").strip()
    if not search:
        return []
    cache_key = f"shikimori:search:{search.casefold()}"

    async def factory():
        query = f"query($search: String!) {{ animes(search: $search, limit: 20) {{ {ANIME_FIELDS} }} }}"
        data = await shikimori_graphql(app, query, {"search": search})
        return data.get("animes") or []

    return await app.ctx.cache.get_or_set(cache_key, SHIKIMORI_CACHE_TTL_SECONDS, factory)


def map_status(status: str | None) -> str | None:
    return {
        "anons": "ANNOUNCED",
        "ongoing": "ONGOING",
        "released": "RELEASED",
    }.get(str(status or "").lower())


def map_age_rating(rating: str | None) -> str | None:
    return {
        "g": "age0",
        "pg": "age6",
        "pg_13": "age13",
        "r": "age17",
        "r_plus": "age18",
        "rx": "age18",
    }.get(str(rating or "").lower())


def is_anime_search_fallback_allowed(movie: dict[str, Any]) -> bool:
    genre_names = {
        str(item.get("genre") or item.get("name") or "").strip().casefold()
        for item in movie.get("genres") or []
        if isinstance(item, dict)
    }
    return bool(genre_names & {"аниме", "anime", "мультфильм", "animation"})


def related_kinopoisk_movies(
    animes: list[dict[str, Any]],
    current_kp_id: str | None = None,
    existing: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    relation_types = {"sequel": "SEQUEL", "prequel": "PREQUEL"}
    result = list(existing or [])
    seen = {
        str(item.get("film_id"))
        for item in result
        if item.get("film_id") is not None
    }
    if current_kp_id:
        seen.add(str(current_kp_id))

    for source in animes:
        for relation in source.get("related") or []:
            relation_type = relation_types.get(str(relation.get("relationKind") or "").lower())
            anime = relation.get("anime") or {}
            kp_id = kinopoisk_id_from_anime(anime)
            if not relation_type or not kp_id or kp_id in seen:
                continue
            poster = anime.get("poster") or {}
            result.append(
                {
                    "film_id": int(kp_id),
                    "name_ru": anime.get("russian") or anime.get("name"),
                    "name_en": anime.get("english") or anime.get("name"),
                    "name_original": anime.get("japanese") or anime.get("name"),
                    "poster_url": poster.get("originalUrl") or poster.get("mainUrl"),
                    "poster_url_preview": poster.get("mainUrl") or poster.get("originalUrl"),
                    "relation_type": relation_type,
                    "rating_shikimori": anime.get("score"),
                    "shikimori_id": str(anime.get("id") or ""),
                }
            )
            seen.add(kp_id)
    return result


def normalize_anime(anime: dict[str, Any]) -> dict[str, Any]:
    aired = anime.get("airedOn") or {}
    released = anime.get("releasedOn") or {}
    poster = anime.get("poster") or {}
    kp_id = kinopoisk_id_from_anime(anime)
    return {
        "shikimori_id": str(anime.get("id") or ""),
        "kinopoisk_id": int(kp_id) if kp_id else None,
        "name_ru": anime.get("russian") or anime.get("licenseNameRu") or anime.get("name") or "",
        "name_en": anime.get("english") or anime.get("name"),
        "name_original": anime.get("japanese") or anime.get("name") or "",
        "year": aired.get("year"),
        "start_year": aired.get("year"),
        "end_year": released.get("year"),
        "poster_url": poster.get("originalUrl") or poster.get("mainUrl") or "",
        "poster_url_preview": poster.get("mainUrl") or poster.get("originalUrl") or "",
        "description": anime.get("description"),
        "type": "TV_SERIES" if anime.get("kind") in {"tv", "ova", "ona"} else "FILM",
        "serial": anime.get("kind") in {"tv", "ova", "ona"},
        "film_length": anime.get("duration"),
        "episodes_count": anime.get("episodes") or 0,
        "episodes_aired": anime.get("episodesAired") or 0,
        "seasons_count": 1 if anime.get("kind") == "tv" else 0,
        "production_status": map_status(anime.get("status")),
        "rating_age_limits": map_age_rating(anime.get("rating")),
        "rating_shikimori": anime.get("score"),
        "genres": [
            {"genre": item.get("russian") or item.get("name")}
            for item in anime.get("genres") or []
            if item.get("russian") or item.get("name")
        ],
        "studios": [item.get("name") for item in anime.get("studios") or [] if item.get("name")],
        "screenshots": [],
        "videos": [],
        "staff": [],
        "sequels_and_prequels": related_kinopoisk_movies(
            [anime], current_kp_id=kp_id
        ),
        "similars": [],
        "lists": {},
        "nudity_timings": [],
    }


async def enrich_kinopoisk_anime(app: Sanic, kp_id: str, movie: dict[str, Any]) -> dict[str, Any]:
    search = str(movie.get("name_original") or movie.get("name_en") or movie.get("name_ru") or "").strip()
    if not search:
        return movie
    matches = await anime_by_kinopoisk(app, kp_id, search)
    fallback_matches: list[dict[str, Any]] = []
    if not matches:
        if not is_anime_search_fallback_allowed(movie):
            return movie
        fallback_matches = (await search_anime(app, search))[:1]
        if not fallback_matches:
            return movie
        normalized = [normalize_anime(item) for item in fallback_matches]
        movie.update(
            {
                "shikimori_id": movie.get("shikimori_id") or normalized[0]["shikimori_id"],
                "shikimori_ids": movie.get("shikimori_ids") or [item["shikimori_id"] for item in normalized],
                "rating_shikimori": movie.get("rating_shikimori") or normalized[0].get("rating_shikimori"),
            }
        )
        movie["sequels_and_prequels"] = related_kinopoisk_movies(
            fallback_matches,
            current_kp_id=str(kp_id),
            existing=movie.get("sequels_and_prequels") or [],
        )
        if not movie.get("genres"):
            movie["genres"] = normalized[0]["genres"]
        return movie
    normalized = [normalize_anime(item) for item in matches]
    statuses = {item.get("production_status") for item in normalized if item.get("production_status")}
    status = "ONGOING" if "ONGOING" in statuses else "ANNOUNCED" if "ANNOUNCED" in statuses else "RELEASED"
    durations = [int(item["film_length"]) for item in normalized if item.get("film_length")]
    movie.update(
        {
            "shikimori_id": normalized[0]["shikimori_id"],
            "shikimori_ids": [item["shikimori_id"] for item in normalized],
            "film_length": durations[0] if durations else movie.get("film_length"),
            "episodes_count": sum(int(item.get("episodes_count") or 0) for item in normalized)
            or movie.get("episodes_count", 0),
            "episodes_aired": sum(int(item.get("episodes_aired") or 0) for item in normalized),
            "production_status": status,
            "rating_age_limits": movie.get("rating_age_limits")
            or normalized[0].get("rating_age_limits"),
            "rating_shikimori": normalized[0].get("rating_shikimori"),
        }
    )
    movie["sequels_and_prequels"] = related_kinopoisk_movies(
        matches,
        current_kp_id=str(kp_id),
        existing=movie.get("sequels_and_prequels") or [],
    )
    if not movie.get("genres"):
        movie["genres"] = normalized[0]["genres"]
    return movie
