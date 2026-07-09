from pathlib import Path

import pytest

from backend import backend as graphql_backend
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
