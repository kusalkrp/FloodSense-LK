"""Shared pytest fixtures for FloodSense LK tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_redis():
    """Patch redis_client with a no-op in-memory mock."""
    store: dict = {}

    async def mock_get(key):
        return store.get(key)

    async def mock_set(key, value, ttl):
        store[key] = value

    async def mock_set_no_ttl(key, value):
        store[key] = value

    async def mock_set_nx(key, value, ttl):
        if key in store:
            return False
        store[key] = value
        return True

    async def mock_delete(key):
        store.pop(key, None)

    with patch("floodsense_lk.db.redis_client.get", side_effect=mock_get), \
         patch("floodsense_lk.db.redis_client.set", side_effect=mock_set), \
         patch("floodsense_lk.db.redis_client.set_no_ttl", side_effect=mock_set_no_ttl), \
         patch("floodsense_lk.db.redis_client.set_nx", side_effect=mock_set_nx), \
         patch("floodsense_lk.db.redis_client.delete", side_effect=mock_delete), \
         patch("floodsense_lk.db.redis_client.redis_available", True):
        yield store


@pytest.fixture
def mock_db():
    """Patch timescale pool with async mocks."""
    with patch("floodsense_lk.db.timescale.fetchrow", new_callable=AsyncMock) as mock_fetchrow, \
         patch("floodsense_lk.db.timescale.fetch", new_callable=AsyncMock) as mock_fetch, \
         patch("floodsense_lk.db.timescale.execute", new_callable=AsyncMock) as mock_execute:
        yield {
            "fetchrow": mock_fetchrow,
            "fetch": mock_fetch,
            "execute": mock_execute,
        }


@pytest.fixture
def mock_mcp():
    """Patch MCP client call_tool with configurable return values."""
    with patch("floodsense_lk.mcp.client.call_tool", new_callable=AsyncMock) as mock_call:
        yield mock_call
