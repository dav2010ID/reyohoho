from __future__ import annotations

from typing import Any


def extend_openapi_schema(schema: dict[str, Any]) -> dict[str, Any]:
    ok = {"200": {"description": "Успешный ответ"}}
    auth_ok = {"security": [{"BearerAuth": []}], "responses": ok}
    paths = schema.setdefault("paths", {})
    paths.update(
        {
            "/auth/telegram-login-token": {"get": {"summary": "Создать одноразовую Telegram login-сессию", "responses": ok}},
            "/auth/check-telegram-auth": {"get": {"summary": "Проверить Telegram login-сессию", "responses": ok}},
            "/user": {"get": {"summary": "Текущий пользователь", **auth_ok}},
            "/user/name": {"put": {"summary": "Изменить имя", **auth_ok}},
            "/rating/{kpId}": {
                "get": {"summary": "Агрегированный рейтинг", "responses": ok},
                "post": {"summary": "Установить или удалить оценку", **auth_ok},
            },
            "/comments/{id}": {
                "get": {"summary": "Комментарии фильма", "responses": ok},
                "post": {"summary": "Создать комментарий", **auth_ok},
                "put": {"summary": "Изменить комментарий", **auth_ok},
                "delete": {"summary": "Удалить комментарий", **auth_ok},
            },
            "/comments/{commentId}/rate": {"post": {"summary": "Оценить комментарий", **auth_ok}},
            "/timings/{id}": {
                "post": {"summary": "Создать тайминг", **auth_ok},
                "put": {"summary": "Изменить тайминг", **auth_ok},
                "delete": {"summary": "Удалить тайминг", **auth_ok},
            },
            "/timings/{timingId}/vote": {
                "get": {"summary": "Голоса тайминга", "responses": ok},
                "post": {"summary": "Проголосовать за тайминг", **auth_ok},
            },
            "/timings/top": {"get": {"summary": "Лучшие авторы таймингов", "responses": ok}},
            "/timings/all": {"get": {"summary": "Очередь модерации", **auth_ok}},
            "/movies/{kpId}/note": {
                "get": {"summary": "Личная заметка", **auth_ok},
                "post": {"summary": "Сохранить заметку", **auth_ok},
                "delete": {"summary": "Удалить заметку", **auth_ok},
            },
            "/list/{type}": {
                "get": {"summary": "Список пользователя", **auth_ok},
                "delete": {"summary": "Очистить список", **auth_ok},
            },
            "/list/{type}/{id}": {
                "put": {"summary": "Добавить в список", **auth_ok},
                "delete": {"summary": "Удалить из списка", **auth_ok},
            },
            "/discussed/{type}": {"get": {"summary": "Активно обсуждаемые фильмы", "responses": ok}},
            "/imdb_parental_guide/{imdbId}": {"get": {"summary": "IMDb Parents Guide", "responses": ok}},
            "/twitch/{username}": {"get": {"summary": "Пользователь и стрим Twitch", "responses": ok}},
        }
    )
    components = schema.setdefault("components", {})
    components["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    components["schemas"] = {
        "Error": {
            "type": "object",
            "required": ["error"],
            "properties": {
                "error": {
                    "type": "object",
                    "required": ["code", "message"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "details": {},
                    },
                }
            },
        },
        "Rating": {
            "type": "object",
            "properties": {
                "user_rating": {"type": ["integer", "null"]},
                "average_rating": {"type": ["number", "null"]},
                "vote_count": {"type": "integer"},
            },
        },
        "User": {
            "type": "object",
            "required": ["id", "telegram_id", "name", "role"],
            "properties": {
                "id": {"type": "integer"},
                "telegram_id": {"type": "integer"},
                "name": {"type": "string"},
                "photo": {"type": ["string", "null"]},
                "role": {"type": "string"},
            },
        },
        "TimingVote": {
            "type": "object",
            "properties": {
                "upvotes": {"type": "integer"},
                "downvotes": {"type": "integer"},
                "vote_score": {"type": "integer"},
                "user_vote": {"type": ["string", "null"]},
            },
        },
    }
    return schema
