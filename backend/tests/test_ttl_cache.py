import asyncio

import pytest

from backend.kinoserver import TTLCache


@pytest.mark.asyncio
async def test_cache_returns_stale_value_while_refreshing_in_background():
    cache = TTLCache()
    cache.set("key", "old", ttl_seconds=0, stale_seconds=60)
    refresh_started = asyncio.Event()
    allow_refresh = asyncio.Event()

    async def factory():
        refresh_started.set()
        await allow_refresh.wait()
        return "new"

    result = await cache.get_or_set("key", 60, factory, stale_seconds=60)

    assert result == "old"
    await asyncio.wait_for(refresh_started.wait(), timeout=1)
    assert cache.get_stale("key") == "old"
    allow_refresh.set()
    await asyncio.sleep(0)
    assert cache.get("key") == "new"


@pytest.mark.asyncio
async def test_cache_waits_for_factory_when_no_stale_value_exists():
    cache = TTLCache()

    async def factory():
        return "fresh"

    result = await cache.get_or_set("key", 60, factory, stale_seconds=60)

    assert result == "fresh"
    assert cache.get("key") == "fresh"


@pytest.mark.asyncio
async def test_cache_deduplicates_concurrent_background_refreshes():
    cache = TTLCache()
    cache.set("key", "old", ttl_seconds=0, stale_seconds=60)
    allow_refresh = asyncio.Event()
    calls = 0

    async def factory():
        nonlocal calls
        calls += 1
        await allow_refresh.wait()
        return "new"

    first = await cache.get_or_set("key", 60, factory, stale_seconds=60)
    second = await cache.get_or_set("key", 60, factory, stale_seconds=60)
    await asyncio.sleep(0)

    assert first == second == "old"
    assert calls == 1

    allow_refresh.set()
    await asyncio.sleep(0)
    assert cache.get("key") == "new"
