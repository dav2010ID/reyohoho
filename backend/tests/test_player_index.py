from backend.kinoserver import merge_player_maps, normalize_player_index_payload


def test_player_index_keeps_provider_level_entries_including_flixcdn():
    payload = {
        "data": [
            {
                "type": "Flixcdn",
                "iframeUrl": "https://tarantino.factorios.live/show/kinopoisk/301",
                "translations": [{"name": "Dub"}, {"name": "Original"}],
            }
        ]
    }

    result = normalize_player_index_payload(payload, source="ddbb", source_label="DDBB")

    assert list(result) == ["DDBB>Flixcdn"]
    assert result["DDBB>Flixcdn"]["translate"] == "Flixcdn"
    assert result["DDBB>Flixcdn"]["iframe"] == "https://tarantino.factorios.live/show/kinopoisk/301"


def test_backend_merge_prefers_named_players_over_local_mirrors():
    result = merge_player_maps(
        {
            "DDBB>Collaps": {
                "iframe": "https://api.ortified.ws/embed/movie/1",
                "translate": "Collaps",
            },
            "DDBB>Turbo": {
                "iframe": "https://one.obrut.show/embed/1",
                "translate": "Turbo",
            },
        },
        {
            "KPMIRROR>1": {
                "iframe": "https://namy.ws/embed/kp/1",
                "source": "kp_embed",
            },
            "OBRUT>1": {
                "iframe": "https://two.obrut.show/embed/1",
                "source": "obrut",
            },
        },
    )

    assert list(result) == ["DDBB>Collaps", "DDBB>Turbo"]
