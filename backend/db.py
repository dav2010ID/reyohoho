from __future__ import annotations

from sanic import Request, Sanic
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import SETTINGS


class Base(DeclarativeBase):
    pass


def register_database(app: Sanic) -> None:
    @app.before_server_start
    async def setup_database(app_: Sanic) -> None:
        engine = create_async_engine(SETTINGS.database_url, pool_pre_ping=True)
        app_.ctx.db_engine = engine
        app_.ctx.db_session = async_sessionmaker(engine, expire_on_commit=False)

    @app.after_server_stop
    async def close_database(app_: Sanic) -> None:
        engine = getattr(app_.ctx, "db_engine", None)
        if engine is not None:
            await engine.dispose()

    @app.on_request(priority=90)
    async def open_session(request: Request) -> None:
        factory: async_sessionmaker[AsyncSession] = request.app.ctx.db_session
        request.ctx.db = factory()

    @app.on_response(priority=-90)
    async def close_session(request: Request, _response) -> None:
        session: AsyncSession | None = getattr(request.ctx, "db", None)
        if session is not None:
            await session.close()
