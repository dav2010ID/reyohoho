import pytest

from backend.services import shikimori


ANIME = {
    "id": "40221",
    "name": "Kami no Tou",
    "russian": "Башня Бога",
    "kind": "tv",
    "rating": "pg_13",
    "score": 7.56,
    "status": "released",
    "episodes": 13,
    "episodesAired": 13,
    "duration": 23,
    "airedOn": {"year": 2020},
    "releasedOn": {"year": 2020},
    "poster": {"originalUrl": "https://example.test/poster.jpg"},
    "genres": [{"name": "Action", "russian": "Экшен"}],
    "studios": [{"name": "Telecom Animation Film"}],
    "externalLinks": [
        {"kind": "kinopoisk", "url": "https://www.kinopoisk.ru/series/1363114/"}
    ],
    "related": [],
}


def test_normalize_anime_extracts_kinopoisk_and_metadata():
    result = shikimori.normalize_anime(ANIME)

    assert result["kinopoisk_id"] == 1363114
    assert result["production_status"] == "RELEASED"
    assert result["film_length"] == 23
    assert result["rating_age_limits"] == "age13"
    assert result["episodes_count"] == 13
    assert result["genres"] == [{"genre": "Экшен"}]


@pytest.mark.asyncio
async def test_enrichment_aggregates_multiple_anime_entries(monkeypatch):
    second = {**ANIME, "id": "52635", "episodes": 13, "episodesAired": 12}

    async def matches(_app, _kp_id, _search):
        return [ANIME, second]

    monkeypatch.setattr(shikimori, "anime_by_kinopoisk", matches)
    movie = {"name_original": "Kami no Tou", "seasons_count": 2}

    result = await shikimori.enrich_kinopoisk_anime(object(), "1363114", movie)

    assert result["shikimori_ids"] == ["40221", "52635"]
    assert result["episodes_count"] == 26
    assert result["episodes_aired"] == 25
    assert result["film_length"] == 23
    assert result["production_status"] == "RELEASED"
    assert result["seasons_count"] == 2


@pytest.mark.asyncio
async def test_enrichment_uses_search_fallback_for_related_kinopoisk(monkeypatch):
    related = {
        "id": "52635",
        "name": "Kami no Tou: Ouji no Kikan",
        "russian": "Башня Бога: Возвращение принца",
        "score": 7.4,
        "poster": {"mainUrl": "https://example.test/next.jpg"},
        "externalLinks": [
            {"kind": "kinopoisk", "url": "https://www.kinopoisk.ru/series/1363114/"}
        ],
    }
    fallback = {
        **ANIME,
        "id": "99999",
        "externalLinks": [],
        "related": [{"relationKind": "sequel", "anime": related}],
    }

    async def no_exact_matches(_app, _kp_id, _search):
        return []

    async def search_matches(_app, _search):
        return [fallback]

    monkeypatch.setattr(shikimori, "anime_by_kinopoisk", no_exact_matches)
    monkeypatch.setattr(shikimori, "search_anime", search_matches)
    movie = {
        "name_original": "Kami no Tou: Workshop Battle",
        "genres": [{"genre": "аниме"}],
        "sequels_and_prequels": [],
    }

    result = await shikimori.enrich_kinopoisk_anime(object(), "35652085", movie)

    assert result["shikimori_id"] == "99999"
    assert result["sequels_and_prequels"][0]["film_id"] == 1363114
    assert result["sequels_and_prequels"][0]["relation_type"] == "SEQUEL"


@pytest.mark.asyncio
async def test_enrichment_does_not_search_shikimori_for_non_anime_movie(monkeypatch):
    async def no_exact_matches(_app, _kp_id, _search):
        return []

    async def unexpected_search(_app, _search):
        raise AssertionError("Shikimori title fallback should not run for non-anime movies")

    monkeypatch.setattr(shikimori, "anime_by_kinopoisk", no_exact_matches)
    monkeypatch.setattr(shikimori, "search_anime", unexpected_search)
    movie = {"name_original": "Real Steel", "genres": [{"genre": "фантастика"}]}

    result = await shikimori.enrich_kinopoisk_anime(object(), "88198", movie)

    assert result == movie


def test_related_movies_are_convertible_and_unique():
    related = {
        "id": "999",
        "name": "Next Anime",
        "russian": "Следующее аниме",
        "score": 8.2,
        "poster": {"mainUrl": "https://example.test/next.jpg"},
        "externalLinks": [
            {"kind": "kinopoisk", "url": "https://www.kinopoisk.ru/film/777/"}
        ],
    }
    anime = {
        **ANIME,
        "related": [
            {"relationKind": "sequel", "anime": related},
            {"relationKind": "sequel", "anime": related},
            {"relationKind": "adaptation", "anime": related},
            {"relationKind": "prequel", "anime": ANIME},
        ],
    }

    result = shikimori.related_kinopoisk_movies(
        [anime], current_kp_id="1363114", existing=[{"film_id": 555}]
    )

    assert [item["film_id"] for item in result] == [555, 777]
    assert result[1]["relation_type"] == "SEQUEL"
    assert result[1]["rating_shikimori"] == 8.2
