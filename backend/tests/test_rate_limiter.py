import pytest

from backend.errors import APIError
from backend.routes_core import WindowLimiter


def test_window_limiter_enforces_limit(monkeypatch):
    now = 100.0
    monkeypatch.setattr("backend.routes_core.time.monotonic", lambda: now)
    limiter = WindowLimiter()

    limiter.check("user", limit=2, window=60)
    limiter.check("user", limit=2, window=60)

    with pytest.raises(APIError) as error:
        limiter.check("user", limit=2, window=60)

    assert error.value.code == "RATE_LIMITED"


def test_window_limiter_removes_expired_keys(monkeypatch):
    now = 100.0
    monkeypatch.setattr("backend.routes_core.time.monotonic", lambda: now)
    limiter = WindowLimiter()
    limiter.check("expired", limit=1, window=10)

    now = 170.0
    limiter.check("active", limit=1, window=10)

    assert "expired" not in limiter.events
    assert list(limiter.events) == ["active"]
