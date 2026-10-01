from pathlib import Path

import pytest

from backend import backend as graphql_backend
from backend import kinoserver
from backend.backend import GraphQLError, fetch_film_async, operation_document, operation_path


@pytest.mark.parametrize(
    "operation_name",
    [
        "FilmBaseInfo",
        "MovieDetailsMobileGeneralMeta",
        "TvSeriesBaseInfo",
        "MovieDetailsMobileRatingExtended",
        "MovieDetailsMobileRatingBase",
        "MovieMobileDetailsRecommendedMovies",
        "MovieDetailsMobileTrailers",
        "MovieDetailsMobileMainCrewMembers",
    ],
)
def test_required_graphql_operations_are_resolvable(operation_name):
    path = operation_path(operation_name)

    assert path == Path(path)
    assert path.name == f"{operation_name}.graphql"
    assert f"query {operation_name}" in operation_document(operation_name)


def test_operation_name_rejects_path_traversal():
    with pytest.raises(RuntimeError, match="invalid GraphQL operation name"):
        operation_path("../FilmBaseInfo")


@pytest.mark.asyncio
async def test_graphql_search_uses_bundled_query(monkeypatch):
    async def execute(_app, operation_name, query, variables):
        assert operation_name == "SuggestSearch"
        assert "query SuggestSearch" in query
        assert variables == {"keyword": "Matrix", "yandexCityId": 0, "limit": 10}
        return {
            "data": {
                "suggest": {
                    "top": {"movies": [{"movie": {"id": 301, "title": {"russian": "Матрица"}}}]}
                }
            }
        }

    monkeypatch.setattr(kinoserver, "kinopoisk_graphql", execute)
    results = await kinoserver.kinopoisk_graphql_search(object(), "Matrix")
    assert results[0]["kp_id"] == "301"


@pytest.mark.asyncio
async def test_graphql_movie_extras_use_bundled_queries(monkeypatch):
    async def execute(_app, operation_name, query, variables, **_kwargs):
        assert f"query {operation_name}" in query
        assert variables["movieId" if operation_name != "FilmSimilarMovies" else "filmId"] == 301
        if operation_name == "FilmSimilarMovies":
            movie = {"id": 447301, "title": {"russian": "Начало"}}
            return {"data": {"film": {"userRecommendations": {"items": [{"movie": movie}]}}}}
        if operation_name == "MovieMobileDetailsTrailers":
            return {"data": {"movie": {"trailers": {"items": [
                {"id": 1, "title": "Трейлер", "streamUrl": "https://example.test/video"}
            ]}}}}
        return {"data": {"movie": {"usersReviewsPaginatedList": {"total": 318}}}}

    monkeypatch.setattr(kinoserver, "kinopoisk_graphql", execute)
    similar = await kinoserver.kinopoisk_graphql_similars(object(), "301")
    trailers = await kinoserver.kinopoisk_graphql_trailers(object(), "301")
    reviews = await kinoserver.kinopoisk_graphql_reviews_total(object(), "301")
    assert similar[0]["film_id"] == 447301
    assert trailers[0]["url"] == "https://example.test/video"
    assert reviews == 318


@pytest.mark.asyncio
async def test_modern_movie_operation_can_replace_missing_legacy_film(monkeypatch):
    async def execute(_session, operation_name, _variables):
        if operation_name == "FilmBaseInfo":
            raise GraphQLError("legacy film not found")
        if operation_name == "MovieDetailsMobileGeneralMeta":
            return {
                "id": 1363114,
                "__typename": "TvSeries",
                "title": {"russian": "Тестовый сериал", "original": "Test Series"},
                "fallbackYear": 2026,
                "releaseYears": [{"start": 2026, "end": None}],
                "seasons": {"total": 2},
                "episodes": {"total": 39},
            }
        if operation_name == "MovieDetailsMobileRatingBase":
            return {"rating": {"kinopoisk": {"value": 8.1, "count": 100}}}
        if operation_name == "TvSeriesBaseInfo":
            return {
                "seriesDuration": 25,
                "totalDuration": 975,
                "seasons": {"total": 2},
                "releaseYears": [{"start": 2026, "end": None}],
            }
        return {}

    monkeypatch.setattr(graphql_backend, "execute_operation_async", execute)

    result = await fetch_film_async(1363114, object())

    assert result.kinopoisk_id == 1363114
    assert result.name_ru == "Тестовый сериал"
    assert result.serial is True
    assert result.year == 2026
    assert result.start_year == 2026
    assert result.rating_kinopoisk == 8.1
    assert result.film_length == 25
    assert result.total_duration == 975
    assert result.seasons_count == 2
    assert result.episodes_count == 39
    assert result.production_status is None
