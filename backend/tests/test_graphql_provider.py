from pathlib import Path
from types import SimpleNamespace

import pytest

from backend import backend as graphql_backend
from backend import kinoserver
from backend.backend import GraphQLError, fetch_film_async, operation_document, operation_path


@pytest.mark.asyncio
async def test_kinopoisk_routes_use_graphql_without_tech_token(monkeypatch):
    async def search(_app, term):
        assert term == "Matrix"
        return [{"kp_id": "301"}]

    async def film(_app, kp_id):
        assert kp_id == "301"
        return {"kinopoisk_id": 301}

    monkeypatch.setattr(kinoserver, "kinopoisk_graphql_search", search)
    monkeypatch.setattr(kinoserver, "kinopoisk_graphql_film", film)
    app = SimpleNamespace(ctx=SimpleNamespace(cache=kinoserver.TTLCache()))
    assert await kinoserver.kinopoisk_search(app, "Matrix") == [{"kp_id": "301"}]
    assert await kinoserver.kinopoisk_film(app, "301") == {"kinopoisk_id": 301}


@pytest.mark.asyncio
async def test_top_uses_kinopoisk_movie_list(monkeypatch):
    async def execute(_app, operation_name, query, variables):
        assert operation_name == "MovieTouchListPage"
        assert "query MovieTouchListPage" in query
        assert variables["slug"] == "popular-films"
        return {"data": {"movieListBySlug": {"movies": {"items": [
            {"movie": {"id": 301, "__typename": "Film", "title": {"russian": "Матрица"},
                       "productionYear": 1999, "gallery": {"posters": {"vertical": {
                           "avatarsUrl": "//avatars.mds.yandex.net/get-kinopoisk-image/example"}}}}}
        ]}}}}

    monkeypatch.setattr(kinoserver, "kinopoisk_graphql", execute)
    app = SimpleNamespace(ctx=SimpleNamespace(cache=kinoserver.TTLCache()))
    movies = await kinoserver.get_top_movies(app, "week", limit=5)
    assert movies[0]["kp_id"] == "301"
    assert movies[0]["poster"].startswith("https://avatars.mds.yandex.net/")


@pytest.mark.asyncio
async def test_imdb_mapping_uses_wikidata(monkeypatch):
    async def fetch(_app, url, *, params, **_kwargs):
        assert url == kinoserver.WIKIDATA_SPARQL_URL
        assert 'wdt:P345 "tt0133093"' in params["query"]
        return {"results": {"bindings": [{"kp": {"value": "301"}}]}}

    monkeypatch.setattr(kinoserver, "fetch_json", fetch)
    app = SimpleNamespace(ctx=SimpleNamespace(cache=kinoserver.TTLCache()))
    assert await kinoserver.imdb_to_kp_id(app, "tt0133093") == "301"


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
