"""FloodSense LK — FastAPI application entry point.

Startup sequence:
  1. Init structlog
  2. Connect TimescaleDB pool (with retry)
  3. Run DB migrations
  4. Connect Redis (with fallback)
  5. Start APScheduler pipeline

Shutdown sequence (reverse):
  1. Stop scheduler
  2. Close Redis
  3. Close DB pool
"""

import pathlib
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from floodsense_lk.api.middleware import limiter
from floodsense_lk.api.routes import admin, alerts, dashboard, status, subscribe
from floodsense_lk.config.settings import settings
from floodsense_lk.core.logging import configure_logging
from floodsense_lk.db import redis_client, timescale
from floodsense_lk.services.scheduler_service import start_scheduler, stop_scheduler

logger = structlog.get_logger(__name__)

_MIGRATIONS_DIR = pathlib.Path(__file__).parent / "db" / "migrations"
_STATIC_DIR = pathlib.Path(__file__).parent / "static"


# ── DB migration runner ────────────────────────────────────────────────────────

async def _run_migrations() -> None:
    for sql_file in sorted(_MIGRATIONS_DIR.glob("*.sql")):
        sql = sql_file.read_text(encoding="utf-8")
        await timescale.execute(sql)
        logger.info("migration_applied", file=sql_file.name)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(log_level=settings.log_level)
    logger.info("floodsense_starting")

    await timescale.create_pool(settings.postgres_dsn)
    await _run_migrations()
    await redis_client.create_client(settings.redis_url)
    await start_scheduler()

    logger.info("floodsense_ready")
    yield

    logger.info("floodsense_shutting_down")
    await stop_scheduler()
    await redis_client.close_client()
    await timescale.close_pool()
    logger.info("floodsense_stopped")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="FloodSense LK",
    description="Autonomous flood early warning for Sri Lanka",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Static files
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

# Routers
app.include_router(subscribe.router)
app.include_router(alerts.router)
app.include_router(status.router)
app.include_router(admin.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "service": "floodsense-lk"}


# Serve React SPA — must be last
_FRONTEND_DIST = pathlib.Path(__file__).parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = "") -> JSONResponse:
        index = _FRONTEND_DIST / "index.html"
        if index.exists():
            from fastapi.responses import FileResponse
            return FileResponse(str(index))
        return JSONResponse({"error": "frontend not built"}, status_code=404)


# ── Entrypoint ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "floodsense_lk.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
        log_config=None,
    )
