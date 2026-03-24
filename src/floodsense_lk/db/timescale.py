"""asyncpg connection pool with startup retry."""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg
import structlog

from floodsense_lk.core.exceptions import DatabaseError

logger = structlog.get_logger(__name__)

_pool: asyncpg.Pool | None = None

_MAX_RETRIES = 10
_RETRY_DELAY_S = 3


async def create_pool(dsn: str) -> None:
    """Create the global asyncpg pool. Retries up to _MAX_RETRIES times."""
    global _pool
    # asyncpg uses plain postgresql:// — strip SQLAlchemy-style driver suffix
    asyncpg_dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            _pool = await asyncpg.create_pool(
                dsn=asyncpg_dsn,
                min_size=2,
                max_size=10,
                max_inactive_connection_lifetime=300.0,
            )
            logger.info("timescaledb_connected", attempt=attempt)
            return
        except (OSError, asyncpg.PostgresError) as exc:
            logger.warning("timescaledb_connect_failed", attempt=attempt, error=str(exc))
            if attempt == _MAX_RETRIES:
                raise DatabaseError("TimescaleDB unreachable after max retries") from exc
            await asyncio.sleep(_RETRY_DELAY_S)


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("timescaledb_pool_closed")


@asynccontextmanager
async def acquire() -> AsyncGenerator[asyncpg.Connection, None]:
    if _pool is None:
        raise DatabaseError("TimescaleDB pool not initialised")
    async with _pool.acquire() as conn:
        yield conn


async def fetchrow(query: str, *args) -> asyncpg.Record | None:
    async with acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch(query: str, *args) -> list[asyncpg.Record]:
    async with acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args) -> None:
    async with acquire() as conn:
        await conn.execute(query, *args)
