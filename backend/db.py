from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sanic import Request, Sanic
from sqlalchemy import delete
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

    @app.after_server_start
    async def start_retention(app_: Sanic) -> None:
        async def prune_views():
            from .models import ViewEvent
            while True:
                try:
                    async with app_.ctx.db_session() as session:
                        await session.execute(delete(ViewEvent).where(
                            ViewEvent.created_at < datetime.now(timezone.utc) - timedelta(days=90)
                        ))
                        await session.commit()
                except Exception:
                    from sanic.log import logger
                    logger.exception('View retention failed')
                await asyncio.sleep(3600)
        app_.ctx.view_retention_task = asyncio.create_task(prune_views())

    @app.before_server_stop
    async def stop_retention(app_: Sanic) -> None:
        task = getattr(app_.ctx, 'view_retention_task', None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

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
