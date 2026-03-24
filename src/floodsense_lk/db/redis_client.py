"""Async Redis client with graceful fallback when unavailable."""

import asyncio
from typing import Optional

import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger(__name__)

_client: aioredis.Redis | None = None
redis_available: bool = False

_MAX_RETRIES = 5
_RETRY_DELAY_S = 2


async def create_client(url: str) -> None:
    global _client, redis_available
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            _client = aioredis.from_url(url, decode_responses=True, max_connections=50)
            await _client.ping()
            redis_available = True
            logger.info("redis_connected", attempt=attempt)
            return
        except Exception as exc:
            logger.warning("redis_connect_failed", attempt=attempt, error=str(exc))
            if attempt == _MAX_RETRIES:
                logger.error("redis_unavailable_continuing_without_cache")
                redis_available = False
                return
            await asyncio.sleep(_RETRY_DELAY_S)


async def close_client() -> None:
    global _client, redis_available
    if _client:
        await _client.aclose()
        _client = None
        redis_available = False
        logger.info("redis_client_closed")


async def get(key: str) -> Optional[str]:
    if not redis_available or _client is None:
        return None
    try:
        return await _client.get(key)
    except Exception as exc:
        logger.warning("redis_get_failed", key=key, error=str(exc))
        return None


async def set(key: str, value: str, ttl: int) -> None:
    if not redis_available or _client is None:
        return
    try:
        await _client.setex(key, ttl, value)
    except Exception as exc:
        logger.warning("redis_set_failed", key=key, error=str(exc))


async def set_no_ttl(key: str, value: str) -> None:
    if not redis_available or _client is None:
        return
    try:
        await _client.set(key, value)
    except Exception as exc:
        logger.warning("redis_set_no_ttl_failed", key=key, error=str(exc))


async def set_nx(key: str, value: str, ttl: int) -> bool:
    """SET key value NX EX ttl. Returns True if key was set (lock acquired)."""
    if not redis_available or _client is None:
        return True  # No Redis → allow pipeline to run
    try:
        result = await _client.set(key, value, nx=True, ex=ttl)
        return result is not None
    except Exception as exc:
        logger.warning("redis_set_nx_failed", key=key, error=str(exc))
        return True


async def delete(key: str) -> None:
    if not redis_available or _client is None:
        return
    try:
        await _client.delete(key)
    except Exception as exc:
        logger.warning("redis_delete_failed", key=key, error=str(exc))
