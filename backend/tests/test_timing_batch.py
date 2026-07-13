from __future__ import annotations

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.db import Base
from backend.models import TimingSubmission, TimingVote, User
from backend.routes_social import timing_payloads


@pytest.mark.asyncio
async def test_timing_payloads_use_constant_query_count(tmp_path):
    database_url = f"sqlite+aiosqlite:///{(tmp_path / 'timings.db').as_posix()}"
    engine = create_async_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        owner = User(telegram_id=2001, name="Owner")
        voter = User(telegram_id=2002, name="Voter")
        session.add_all([owner, voter])
        await session.flush()
        timings = [
            TimingSubmission(
                kp_id=str(400 + index),
                user_id=owner.id,
                timing_text="00:10:20-00:11:05",
                status="approved" if index < 2 else "pending",
            )
            for index in range(3)
        ]
        session.add_all(timings)
        await session.flush()
        session.add_all(
            [
                TimingVote(timing_id=timings[0].id, user_id=voter.id, vote_type="upvote"),
                TimingVote(timing_id=timings[1].id, user_id=voter.id, vote_type="downvote"),
            ]
        )
        await session.commit()

    selects = []

    def count_selects(_conn, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", count_selects)
    try:
        async with factory() as session:
            payloads = await timing_payloads(session, timings, voter.id)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", count_selects)
        await engine.dispose()

    assert len(payloads) == 3
    assert {item["user_timing_count"] for item in payloads} == {2}
    assert [item["userVote"] for item in payloads[:2]] == ["upvote", "downvote"]
    assert len(selects) == 4
