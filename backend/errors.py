from __future__ import annotations

from typing import Any

from sanic import Request, Sanic
from sanic.exceptions import SanicException
from sanic.response import json


class APIError(Exception):
    def __init__(
        self, code: str, message: str, status: int = 400, details: Any | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


def error_payload(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


def register_error_handlers(app: Sanic) -> None:
    @app.exception(APIError)
    async def handle_api_error(_: Request, exc: APIError):
        return json(error_payload(exc.code, exc.message, exc.details), status=exc.status)

    @app.exception(SanicException)
    async def handle_sanic_error(_: Request, exc: SanicException):
        status = int(getattr(exc, "status_code", 500))
        code = "NOT_FOUND" if status == 404 else "METHOD_NOT_ALLOWED" if status == 405 else "HTTP_ERROR"
        return json(error_payload(code, str(exc)), status=status)
