from __future__ import annotations

import asyncio
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import requests
from aiohttp import ClientError, ClientSession
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
OPERATIONS_DIRS = (
    BASE_DIR / "clean_graphql" / "queries" / "query",
    BASE_DIR.parent / "graphql_extracted" / "clean_graphql" / "queries" / "query",
)
GRAPHQL_URL = "https://graphql.kinopoisk.ru/graphql/"
REQUEST_HEADERS = {"service-id": "25"}
logger = logging.getLogger(__name__)


class FilmResponse(BaseModel):
    kinopoisk_id: int
    imdb_id: str | None = None
    name_ru: str | None = None
    name_en: str | None = None
    name_original: str | None = None
    poster_url: str | None = None
    poster_url_preview: str | None = None
    reviews_count: int = 0
    rating_good_review: float | None = None
    rating_good_review_vote_count: int = 0
    rating_kinopoisk: float | None = None
    rating_kinopoisk_vote_count: int = 0
    rating_imdb: float | None = None
    rating_imdb_vote_count: int = 0
    rating_film_critics: float | None = None
    rating_film_critics_vote_count: int = 0
    rating_await: float | None = None
    rating_await_count: int = 0
    rating_rf_critics: float | None = None
    rating_rf_critics_vote_count: int = 0
    year: int | None = None
    film_length: int | None = None
    total_duration: int | None = None
    seasons_count: int = 0
    episodes_count: int = 0
    is_tickets_available: bool = False
    production_status: str | None = None
    type: str | None = None
    has_imax: bool = False
    has_3_d: bool = False
    countries: list[dict[str, Any]] = Field(default_factory=list)
    genres: list[dict[str, Any]] = Field(default_factory=list)
    start_year: int | None = None
    end_year: int | None = None
    cover_url: str | None = None
    logo_url: str | None = None
    web_url: str | None = None
    slogan: str | None = None
    description: str | None = None
    short_description: str | None = None
    editor_annotation: str | None = None
    rating_mpaa: str | None = None
    rating_age_limits: str | None = None
    last_sync: str
    serial: bool = False
    short_film: bool = False
    completed: bool = False
    sequels_and_prequels: list[dict[str, Any]] = Field(default_factory=list)
    similars: list[dict[str, Any]] = Field(default_factory=list)
    videos: list[dict[str, Any]] = Field(default_factory=list)
    staff: list[dict[str, Any]] = Field(default_factory=list)
    nudity_timings: list[dict[str, Any]] = Field(default_factory=list)
    lists: dict[str, bool] = Field(default_factory=dict)


class GraphQLError(RuntimeError):
    pass


def operation_path(operation_name: str) -> Path:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", operation_name):
        raise RuntimeError(f"invalid GraphQL operation name: {operation_name!r}")
    for operations_dir in OPERATIONS_DIRS:
        candidate = operations_dir / f"{operation_name}.graphql"
        if candidate.is_file():
            return candidate
    searched = ", ".join(str(path) for path in OPERATIONS_DIRS)
    raise RuntimeError(f"operation {operation_name!r} not found in: {searched}")


@lru_cache(maxsize=64)
def operation_document(operation_name: str) -> str:
    return operation_path(operation_name).read_text(encoding="utf-8")


def operation_payload(operation_name: str, variables: dict[str, Any]) -> dict[str, Any]:
    return {
        "operationName": operation_name,
        "variables": variables,
        "query": operation_document(operation_name),
    }


def parse_operation_response(operation_name: str, status: int, body: dict[str, Any]) -> dict[str, Any]:
    data = body.get("data") or {}
    entity = data.get("movie") or data.get("film") or data.get("tvSeries") or {}
    if status != 200 or (body.get("errors") and not entity):
        raise GraphQLError(f"{operation_name}: status={status}, errors={body.get('errors')}")
    return entity


def execute_operation(operation_name: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = operation_payload(operation_name, variables)
    try:
        response = requests.post(
            GRAPHQL_URL,
            params={"operationName": operation_name},
            headers=REQUEST_HEADERS,
            json=payload,
            timeout=30,
        )
    except requests.RequestException as error:
        raise GraphQLError(f"{operation_name}: request failed: {error}") from error
    try:
        body = response.json()
    except ValueError as error:
        raise GraphQLError(
            f"{operation_name}: upstream returned non-JSON status {response.status_code}"
        ) from error
    return parse_operation_response(operation_name, response.status_code, body)


async def execute_operation_async(
    session: ClientSession,
    operation_name: str,
    variables: dict[str, Any],
) -> dict[str, Any]:
    try:
        async with session.post(
            GRAPHQL_URL,
            params={"operationName": operation_name},
            headers=REQUEST_HEADERS,
            json=operation_payload(operation_name, variables),
        ) as response:
            try:
                body = await response.json(content_type=None)
            except (json.JSONDecodeError, ValueError) as error:
                raise GraphQLError(
                    f"{operation_name}: upstream returned non-JSON status {response.status}"
                ) from error
            return parse_operation_response(operation_name, response.status, body)
    except (ClientError, asyncio.TimeoutError) as error:
        raise GraphQLError(f"{operation_name}: request failed: {error}") from error


def image_url(value: str | None, size: str = "orig") -> str | None:
    if not value:
        return None
    if value.startswith("//"):
        value = "https:" + value
    if "avatars.mds.yandex.net" in value:
        value = re.sub(r"/(?:orig|\d+x(?:\d+)?)$", "", value.rstrip("/"))
        value = f"{value}/{size}"
    return value


def clean_named_items(
    items: list[dict[str, Any]] | None, output_key: str
) -> list[dict[str, Any]]:
    return [
        {output_key: item.get("name")}
        for item in items or []
        if item.get("name")
    ]


def rating_value(rating: dict[str, Any], key: str) -> tuple[float | None, int]:
    value = rating.get(key) or {}
    return value.get("value"), value.get("count") or 0


def map_videos(trailers: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for item in ((trailers.get("trailers") or {}).get("items") or []):
        result.append(
            {
                "url": item.get("streamUrl"),
                "name": item.get("title"),
                "site": "KINOPOISK",
                "type": "TRAILER",
                "duration": item.get("duration"),
                "preview_url": image_url((item.get("preview") or {}).get("avatarsUrl")),
            }
        )
    return result


def map_staff(crew: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[Any, Any]] = set()
    for group_name, group in crew.items():
        if not isinstance(group, dict) or not isinstance(group.get("items"), list):
            continue
        for member in group["items"]:
            person = member.get("person") or {}
            role = member.get("roleInfo") or {}
            role_slug = role.get("slug") or group_name.upper()
            key = (person.get("id"), role_slug)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "staff_id": person.get("id"),
                    "name_ru": person.get("name"),
                    "name_en": person.get("originalName"),
                    "description": member.get("roleDetails"),
                    "poster_url": image_url((person.get("poster") or {}).get("avatarsUrl")),
                    "profession_text": ((role.get("title") or {}).get("russian")),
                    "profession_key": role_slug,
                }
            )
    return result


def map_related_movies(base: dict[str, Any]) -> list[dict[str, Any]]:
    relation_names = {"AFTER": "SEQUEL", "BEFORE": "PREQUEL", "REMAKE": "REMAKE"}
    result = []
    for relation in ((base.get("sequelsPrequels") or {}).get("items") or []):
        movie = relation.get("movie") or {}
        title = movie.get("title") or {}
        poster = image_url((movie.get("poster") or {}).get("avatarsUrl"))
        result.append(
            {
                "film_id": movie.get("id"),
                "name_ru": title.get("russian") or title.get("localized"),
                "name_en": title.get("original"),
                "name_original": title.get("original"),
                "poster_url": poster,
                "poster_url_preview": image_url(
                    (movie.get("poster") or {}).get("avatarsUrl"), "300x450"
                ),
                "relation_type": relation_names.get(
                    relation.get("relationType"), relation.get("relationType")
                ),
            }
        )
    return result


def map_similar_movies(response: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for item in ((response.get("userRecommendations") or {}).get("items") or []):
        movie = item.get("movie") or {}
        title = movie.get("title") or {}
        posters = ((movie.get("gallery") or {}).get("posters") or {})
        poster_source = posters.get("vertical") or posters.get("verticalWithRightholderLogo") or {}
        result.append(
            {
                "film_id": movie.get("id"),
                "name_ru": title.get("localized"),
                "name_en": title.get("original"),
                "name_original": title.get("original"),
                "poster_url": image_url(poster_source.get("avatarsUrl")),
                "poster_url_preview": image_url(
                    poster_source.get("avatarsUrl"), "300x450"
                ),
                "relation_type": "SIMILAR",
            }
        )
    return result


def local_tagline(film_id: int) -> str | None:
    """Use the local reference JSON only for fields absent from GraphQL operations."""
    path = BASE_DIR / "rh.json"
    if not path.exists():
        return None
    try:
        reference = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if reference.get("kinopoisk_id") != film_id:
        return None
    return reference.get("slogan") or reference.get("tagline")


def film_operations(film_id: int) -> dict[str, tuple[str, dict[str, Any]]]:
    operations = {
        "base": (
            "FilmBaseInfo",
            {
                "filmId": film_id,
                "isAuthorized": False,
                "clientContext": {},
                "checkSilentInvoiceAvailability": False,
                "withPurchaseOptions": False,
                "actorsLimit": 30,
                "voiceOverActorsLimit": 30,
                "relatedMoviesLimit": 20,
                "watchabilityLimit": 20,
                "includeSocialArgumentTypes": [],
                "socialArgumentLimit": 20,
            },
        ),
        "general": (
            "MovieDetailsMobileGeneralMeta",
            {
                "movieId": film_id,
                "includeKpValues": True,
                "isOnlyOnlineSeasonsCount": False,
                "includeMovieTop250": True,
            },
        ),
        "series_base": (
            "TvSeriesBaseInfo",
            {
                "tvSeriesId": film_id,
                "isAuthorized": False,
                "clientContext": {},
                "checkSilentInvoiceAvailability": False,
                "withPurchaseOptions": False,
                "actorsLimit": 30,
                "voiceOverActorsLimit": 30,
                "relatedMoviesLimit": 20,
                "watchabilityLimit": 20,
                "includeSocialArgumentTypes": [],
                "socialArgumentLimit": 20,
            },
        ),
        "ratings": ("MovieDetailsMobileRatingExtended", {"movieId": film_id}),
        "ratings_base": (
            "MovieDetailsMobileRatingBase",
            {"movieId": film_id, "includePlannedToWatch": True},
        ),
        "recommendations": (
            "MovieMobileDetailsRecommendedMovies",
            {
                "movieId": film_id,
                "offset": 0,
                "limit": 20,
                "includeMovieTops": False,
                "includeMovieRating": True,
                "includeSeriesSeasonsCount": False,
                "includeFilmDuration": False,
                "includeMovieHorizontalCover": False,
                "includeMovieHorizontalLogo": False,
                "includeMovieRightholderForPoster": False,
                "includeMovieUserVote": False,
                "includeMovieUserPlannedToWatch": False,
                "includeMovieUserFolders": False,
                "includeMovieUserWatched": False,
                "includeMovieUserNotInterested": False,
                "includeMovieContentFeatures": False,
                "includeMovieOnlyClientSupportedContentFeatures": False,
                "includeMovieViewOption": False,
                "includeMovieTop250": False,
                "includePlannedToWatchRating": False,
                "purchaseOptionsContext": {},
                "includeMoviePurchaseOptions": False,
                "includeTrialCutInfo": False,
                "includeTicketOption": False,
                "includeMovieReleaseDate": False,
            },
        ),
        "trailers": (
            "MovieDetailsMobileTrailers",
            {"movieId": film_id, "offset": 0, "limit": 20, "includeMainTrailer": True},
        ),
        "crew": (
            "MovieDetailsMobileMainCrewMembers",
            {
                "movieId": film_id,
                "actorsRoles": ["ACTOR"],
                "actorsLimit": 30,
                "includeCreators": True,
                "creatorsEachRoleLimit": 10,
                "creatorsOtherRoles": ["EDITOR"],
            },
        ),
    }
    return operations


def fetch_film(film_id: int) -> FilmResponse:
    operations = film_operations(film_id)
    responses: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=len(operations)) as executor:
        futures = {
            executor.submit(execute_operation, operation, variables): key
            for key, (operation, variables) in operations.items()
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                responses[key] = future.result()
            except GraphQLError:
                if key in {"base", "series_base"}:
                    logger.info("GraphQL %s variant unavailable for film_id=%s", key, film_id)
                else:
                    logger.warning("GraphQL operation %s failed", key, exc_info=True)
                responses[key] = {}

    if not responses.get("base") and not responses.get("general"):
        raise GraphQLError(f"No Kinopoisk movie found for id {film_id}")

    return build_film_response(film_id, responses)


async def fetch_film_async(film_id: int, session: ClientSession) -> FilmResponse:
    operations = film_operations(film_id)

    async def execute(key: str, operation: str, variables: dict[str, Any]):
        try:
            return key, await execute_operation_async(session, operation, variables)
        except GraphQLError:
            if key in {"base", "series_base"}:
                logger.info("GraphQL %s variant unavailable for film_id=%s", key, film_id)
            else:
                logger.warning("GraphQL operation %s failed", key, exc_info=True)
            return key, {}

    results = await asyncio.gather(
        *(execute(key, operation, variables) for key, (operation, variables) in operations.items())
    )
    responses = dict(results)
    if not responses.get("base") and not responses.get("general"):
        raise GraphQLError(f"No Kinopoisk movie found for id {film_id}")
    return build_film_response(film_id, responses)


def build_film_response(film_id: int, responses: dict[str, dict[str, Any]]) -> FilmResponse:

    base = responses.get("base") or {}
    general = responses.get("general") or {}
    series_base = responses.get("series_base") or {}
    extended = ((responses.get("ratings") or {}).get("rating") or {})
    modern_base_rating = ((responses.get("ratings_base") or {}).get("rating") or {})
    base_rating = base.get("rating") or {}
    kp_rating = base_rating.get("kinopoisk") or modern_base_rating.get("kinopoisk") or {}
    title = base.get("title") or general.get("title") or {}
    base_gallery = base.get("gallery") or {}
    general_gallery = general.get("gallery") or {}
    posters = base_gallery.get("posters") or general_gallery.get("posters") or {}
    covers = base_gallery.get("covers") or general_gallery.get("covers") or {}
    logos = general_gallery.get("logos") or base_gallery.get("logos") or {}
    restriction = base.get("restriction") or general.get("restriction") or {}
    imdb_rating, imdb_count = rating_value(extended, "imdb")
    good_rating, good_count = rating_value(extended, "positiveReviewRate")
    critics_rating, critics_count = rating_value(extended, "worldwideCritics")
    rf_rating, rf_count = rating_value(extended, "russianCritics")
    _, reviews_count = rating_value(extended, "reviewCount")
    typename = base.get("__typename") or general.get("__typename")
    original_title = title.get("original")
    release_options = base.get("releaseOptions") or {}
    ticket_option = base.get("ticketOption") or {}
    planned_rating = base_rating.get("plannedToWatch") or modern_base_rating.get("plannedToWatch") or {}
    release_years = (
        base.get("releaseYears")
        or series_base.get("releaseYears")
        or general.get("releaseYears")
        or []
    )
    if isinstance(release_years, list):
        release_year = release_years[0] if release_years else {}
    elif isinstance(release_years, dict):
        release_year = release_years
    else:
        release_year = {}
    production_status = base.get("productionStatus") or series_base.get("productionStatus")
    is_series = typename in {"Series", "TvSeries", "MiniSeries", "TvShow"}

    return FilmResponse(
        kinopoisk_id=base.get("id") or general.get("id") or film_id,
        name_ru=title.get("russian") or title.get("localized"),
        name_en=original_title,
        name_original=original_title,
        poster_url=image_url((posters.get("kpVertical") or posters.get("vertical") or {}).get("avatarsUrl")),
        poster_url_preview=image_url(
            (posters.get("kpVertical") or posters.get("vertical") or {}).get("avatarsUrl"),
            "300x450",
        ),
        reviews_count=reviews_count,
        rating_good_review=float(round(good_rating)) if good_rating is not None else None,
        rating_good_review_vote_count=good_count,
        rating_kinopoisk=kp_rating.get("value"),
        rating_kinopoisk_vote_count=kp_rating.get("count") or 0,
        rating_imdb=imdb_rating,
        rating_imdb_vote_count=imdb_count,
        rating_film_critics=critics_rating,
        rating_film_critics_vote_count=critics_count,
        rating_await=planned_rating.get("value"),
        rating_await_count=planned_rating.get("count") or 0,
        rating_rf_critics=rf_rating,
        rating_rf_critics_vote_count=rf_count,
        year=(
            base.get("productionYear")
            or general.get("kpYear")
            or general.get("productionYear")
            or general.get("fallbackYear")
            or release_year.get("start")
        ),
        film_length=(
            base.get("duration")
            or series_base.get("seriesDuration")
            or general.get("kpDuration")
            or (((general.get("ott") or {}).get("preview") or {}).get("duration"))
        ),
        total_duration=series_base.get("totalDuration"),
        seasons_count=(
            ((general.get("seasons") or {}).get("total"))
            or ((series_base.get("seasons") or {}).get("total"))
            or 0
        ),
        episodes_count=((general.get("episodes") or {}).get("total")) or 0,
        is_tickets_available=bool(ticket_option.get("purchasable")),
        production_status=production_status,
        type=typename.upper() if isinstance(typename, str) else None,
        has_imax=bool(release_options.get("isImax")),
        has_3_d=bool(release_options.get("is3d")),
        countries=clean_named_items(
            base.get("countries") or general.get("countries"), "country"
        ),
        genres=clean_named_items(base.get("genres") or general.get("genres"), "genre"),
        start_year=release_year.get("start"),
        end_year=release_year.get("end"),
        cover_url=image_url(
            ((covers.get("square") or covers.get("horizontal") or {}).get("avatarsUrl"))
        ),
        logo_url=image_url(((logos.get("horizontal") or {}).get("avatarsUrl"))),
        web_url=f"https://www.kinopoisk.ru/film/{film_id}/",
        slogan=base.get("tagline") or local_tagline(film_id),
        description=base.get("synopsis") or general.get("kpSynopsis") or general.get("synopsis"),
        short_description=base.get("shortDescription") or general.get("shortDescription"),
        editor_annotation=base.get("editorAnnotation") or general.get("editorAnnotation"),
        rating_mpaa=restriction.get("mpaa"),
        rating_age_limits=restriction.get("age"),
        last_sync=datetime.now(timezone.utc).isoformat(),
        serial=is_series,
        short_film=typename == "ShortFilm",
        completed=production_status == "COMPLETED",
        sequels_and_prequels=map_related_movies(base),
        similars=map_similar_movies(responses.get("recommendations") or {}),
        videos=map_videos(responses.get("trailers") or {}),
        staff=map_staff(responses.get("crew") or {}),
        lists={
            "isFavorite": False,
            "isHistory": False,
            "isLater": False,
            "isCompleted": False,
            "isAbandoned": False,
            "isWatching": False,
            "isRated": False,
        },
    )


app = FastAPI(title="Kinopoisk GraphQL adapter", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/films/{film_id}")
def film(film_id: int) -> FilmResponse:
    try:
        return fetch_film(film_id)
    except GraphQLError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
