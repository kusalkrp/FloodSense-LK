"""MCP SSE client for mcp-lk-river-intel.

All data access goes through this module — no other file may call MCP tools.
Includes retry with exponential backoff and a simple circuit breaker.
"""

import asyncio
import json
import time
from typing import Any, Optional

import structlog
from mcp import ClientSession
from mcp.client.sse import sse_client

from floodsense_lk.core.exceptions import MCPConnectionError, MCPToolError

logger = structlog.get_logger(__name__)

# ── Circuit breaker state ──────────────────────────────────────────────────────
_failures: int = 0
_open_until: float = 0.0
_MAX_FAILURES = 3
_OPEN_SECONDS = 300  # 5 minutes


def _circuit_open() -> bool:
    if _open_until and time.monotonic() < _open_until:
        return True
    return False


def _record_success() -> None:
    global _failures, _open_until
    _failures = 0
    _open_until = 0.0


def _record_failure() -> None:
    global _failures, _open_until
    _failures += 1
    if _failures >= _MAX_FAILURES:
        _open_until = time.monotonic() + _OPEN_SECONDS
        logger.warning("mcp_circuit_open", open_seconds=_OPEN_SECONDS)


# ── Core call ──────────────────────────────────────────────────────────────────

async def _call_tool(base_url: str, tool_name: str, args: dict) -> Any:
    """Open a fresh SSE session, call one tool, return parsed result."""
    sse_url = f"{base_url}/sse"
    async with sse_client(sse_url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, args)
            raw = result.content[0].text if result.content else "{}"
            return json.loads(raw)


async def call_tool(
    base_url: str,
    tool_name: str,
    args: Optional[dict] = None,
    retries: int = 3,
) -> Any:
    """Call an MCP tool with retry + exponential backoff + circuit breaker.

    Returns parsed dict on success.
    Raises MCPConnectionError if circuit is open or all retries exhausted.
    Raises MCPToolError if the tool returns an error payload.
    """
    if _circuit_open():
        raise MCPConnectionError("MCP circuit breaker is open — skipping call")

    if args is None:
        args = {}

    backoff = [1, 2, 4]
    last_exc: Exception = RuntimeError("No attempts made")

    for attempt, delay in enumerate(backoff[:retries], 1):
        try:
            logger.debug("mcp_tool_call", tool=tool_name, attempt=attempt)
            data = await _call_tool(base_url, tool_name, args)

            if isinstance(data, dict) and "error" in data:
                raise MCPToolError(f"MCP tool {tool_name!r} returned error: {data['error']}")

            _record_success()
            logger.debug("mcp_tool_ok", tool=tool_name)
            return data

        except MCPToolError:
            raise  # Tool errors are not retried
        except Exception as exc:
            last_exc = exc
            logger.warning("mcp_tool_failed", tool=tool_name, attempt=attempt, error=str(exc))
            _record_failure()
            if attempt < retries:
                await asyncio.sleep(delay)

    raise MCPConnectionError(f"MCP tool {tool_name!r} failed after {retries} attempts") from last_exc


# ── Safe wrapper — returns None on failure, never raises ──────────────────────

async def safe_call(base_url: str, tool_name: str, args: Optional[dict] = None) -> Optional[Any]:
    """Call a tool, return None on any error. Use for non-critical data fetches."""
    try:
        return await call_tool(base_url, tool_name, args)
    except (MCPConnectionError, MCPToolError) as exc:
        logger.error("mcp_safe_call_failed", tool=tool_name, error=str(exc))
        return None
