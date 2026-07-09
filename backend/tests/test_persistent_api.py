from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend import models  # noqa: F401
from backend.auth import issue_access_token
from backend.config import SETTINGS
from backend.db import Base
from backend.kinoserver import app
from backend.models import Movie, User, ViewEvent
from backend.routes_social import validate_timing_text


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def api(tmp_path):
    database_url = f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}"
    object.__setattr__(SETTINGS, "database_url", database_url)
    engine = create_async_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        owner = User(telegram_id=1001, name="Owner")
        stranger = User(telegram_id=1002, name="Stranger")
        moderator = User(telegram_id=1003, name="Moderator", role="moderator")
        session.add_all([owner, stranger, moderator])
        await session.commit()
        for user in (owner, stranger, moderator):
            await session.refresh(user)
        tokens = {
            "owner": issue_access_token(owner.id),
            "stranger": issue_access_token(stranger.id),
            "moderator": issue_access_token(moderator.id),
        }
    yield tokens
    await engine.dispose()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_auth_ratings_lists_and_private_notes(api):
    _, response = await app.asgi_client.get("/user")
    assert response.status == 401
    assert response.json["error"]["code"] == "AUTH_REQUIRED"

    headers = bearer(api["owner"])
    _, response = await app.asgi_client.post("/rating/301", headers=headers, json={"rating": 8})
    assert response.status == 200
    assert response.json == {"user_rating": 8, "average_rating": 8.0, "vote_count": 1}
    _, response = await app.asgi_client.post("/rating/301", headers=headers, json={"rating": None})
    assert response.json["vote_count"] == 0

    for _ in range(2):
        _, response = await app.asgi_client.put("/list/favorite/301", headers=headers)
        assert response.status == 200
    _, response = await app.asgi_client.get("/list/favorite", headers=headers)
    assert [item["id"] for item in response.json] == ["301"]

    _, response = await app.asgi_client.put(
        "/list/history/2022",
        headers=headers,
        json={
            "metadata": {
                "title": "Test Movie",
                "poster": "https://example.test/poster.jpg",
                "year": 2024,
                "rating_kinopoisk": 7.8,
            }
        },
    )
    assert response.status == 200
    _, response = await app.asgi_client.get("/list/history", headers=headers)
    assert response.json[0]["title"] == "Test Movie"
    assert response.json[0]["poster"] == "https://example.test/poster.jpg"
    assert response.json[0]["rating_kinopoisk"] == 7.8
    assert response.json[0]["addedAt"]

    _, response = await app.asgi_client.put("/list/history/301", headers=headers)
    assert response.status == 200
    await asyncio.sleep(0.01)
    _, response = await app.asgi_client.put("/list/history/2022", headers=headers)
    assert response.status == 200
    _, response = await app.asgi_client.get("/list/history", headers=headers)
    assert [item["id"] for item in response.json[:2]] == ["2022", "301"]

    _, response = await app.asgi_client.post(
        "/movies/301/note", headers=headers, json={"note_text": "private"}
    )
    assert response.status == 200
    _, response = await app.asgi_client.get(
        "/movies/301/note", headers=bearer(api["stranger"])
    )
    assert response.json == {"note": None}


async def test_comments_permissions_soft_delete_and_vote_toggle(api):
    owner_headers = bearer(api["owner"])
    _, response = await app.asgi_client.post(
        "/comments/301", headers=owner_headers, json={"content": "Hello", "parent_id": None}
    )
    assert response.status == 201
    comment_id = response.json["id"]

    _, response = await app.asgi_client.put(
        f"/comments/{comment_id}", headers=bearer(api["stranger"]), json={"content": "No"}
    )
    assert response.status == 403

    for expected in (1, 0):
        _, response = await app.asgi_client.post(
            f"/comments/{comment_id}/rate", headers=owner_headers, json={"rating": 1}
        )
        assert response.json["user_rating"] == expected

    _, response = await app.asgi_client.delete(f"/comments/{comment_id}", headers=owner_headers)
    assert response.status == 200
    _, response = await app.asgi_client.get("/comments/301")
    assert response.json[0]["is_deleted"] is True
    assert response.json[0]["content"] == ""


async def test_timing_validation_voting_and_moderation_state_machine(api):
    validate_timing_text("00:10:20-00:11:05")
    with pytest.raises(Exception):
        validate_timing_text("00:11:05-00:10:20")

    _, response = await app.asgi_client.post(
        "/timings/301",
        headers=bearer(api["owner"]),
        json={"timing_text": "00:10:20-00:11:05"},
    )
    assert response.status == 201
    timing_id = response.json["id"]

    _, response = await app.asgi_client.post(
        f"/timings/{timing_id}/vote",
        headers=bearer(api["stranger"]),
        json={"vote_type": "upvote"},
    )
    assert response.json["vote_score"] == 1

    _, response = await app.asgi_client.post(
        f"/timings/submission/{timing_id}/approve", headers=bearer(api["owner"])
    )
    assert response.status == 403
    _, response = await app.asgi_client.post(
        f"/timings/submission/{timing_id}/approve", headers=bearer(api["moderator"])
    )
    assert response.status == 200
    assert response.json["status"] == "approved"
    _, response = await app.asgi_client.post(
        f"/timings/submission/{timing_id}/reject", headers=bearer(api["moderator"])
    )
    assert response.status == 409


async def test_validation_errors_are_normalized(api):
    _, response = await app.asgi_client.post(
        "/rating/301", headers=bearer(api["owner"]), json={"rating": 11}
    )
    assert response.status == 422
    assert response.json["error"]["code"] == "INVALID_RATING"
    _, response = await app.asgi_client.get("/route-that-does-not-exist")
    assert response.status == 404
    assert response.json["error"]["code"] == "NOT_FOUND"


async def test_top_type_filter_is_applied_before_pagination(api):
    _, response = await app.asgi_client.get("/health")
    assert response.status == 200

    async with app.ctx.db_session() as session:
        session.add_all(
            [
                Movie(kp_id="9001", type="series", metadata_json={"title": "Series"}),
                Movie(kp_id="9002", type="movie", metadata_json={"title": "Movie"}),
                ViewEvent(kp_id="9001"),
                ViewEvent(kp_id="9001"),
                ViewEvent(kp_id="9002"),
            ]
        )
        await session.commit()

    _, response = await app.asgi_client.get("/top/all", params={"type": "movie", "limit": 1})

    assert response.status == 200
    assert [item["kp_id"] for item in response.json] == ["9002"]


async def test_telegram_login_is_one_time(api):
    object.__setattr__(SETTINGS, "telegram_bot_username", "test_bot")
    object.__setattr__(SETTINGS, "telegram_webhook_secret", "webhook-test-secret")
    _, response = await app.asgi_client.get("/auth/telegram-login-token")
    assert response.status == 200
    login_token = response.json["token"]
    assert login_token in response.json["telegram_link"]

    _, response = await app.asgi_client.post(
        "/auth/telegram-webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "webhook-test-secret"},
        json={"message": {"text": f"/start {login_token}", "from": {"id": 9001, "first_name": "Telegram"}}},
    )
    assert response.status == 200
    _, response = await app.asgi_client.get(
        "/auth/check-telegram-auth", params={"token": login_token}
    )
    assert response.status == 200
    assert response.json["authenticated"] is True
    assert response.json["token"]
    _, response = await app.asgi_client.get(
        "/auth/check-telegram-auth", params={"token": login_token}
    )
    assert response.status == 404
