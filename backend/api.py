from __future__ import annotations

from sanic import Sanic

from .auth import register_auth_middleware
from .db import register_database
from .errors import register_error_handlers
from .routes_core import bp as core_blueprint
from .routes_external import bp as external_blueprint
from .routes_social import bp as social_blueprint


def configure_persistent_api(app: Sanic) -> None:
    app.config.FALLBACK_ERROR_FORMAT = "json"
    register_database(app)
    register_auth_middleware(app)
    register_error_handlers(app)
    app.blueprint(core_blueprint)
    app.blueprint(social_blueprint)
    app.blueprint(external_blueprint)
