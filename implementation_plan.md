# FloodSense LK — Implementation Plan

## Overview
Autonomous LangGraph agent system that monitors Sri Lanka's 40 river gauging stations every 30 min, detects anomalies before official thresholds are crossed, and delivers WhatsApp/SMS flood early warnings. Built entirely on top of `mcp-lk-river-intel` via SSE MCP tools.

---

## Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| LLM | Gemini 2.5 Flash — single model all agents | Cost predictable, latency consistent, spec requirement |
| LLM calls | Async + retry with exponential backoff | Production AI checklist — never sync LLM calls |
| MCP transport | SSE at `http://localhost:8765/sse` | mcp-lk-river-intel port 8765 |
| DB driver | asyncpg (raw, no ORM) | TimescaleDB-specific SQL needed |
| Pipeline lock | Redis NX key, 10-min TTL | Prevents overlapping runs on crash |
| Alert dedup | Redis cooldown keys per station+type | Prevents alert fatigue |
| PII storage | SHA256(value + ALERT_SALT) only | Never store raw phone/email |
| Prompt safety | Anti-injection instruction in all system prompts | Production AI checklist §Input Security |
| Dependency pins | `~=` (compatible release) | Prevents silent major-version upgrades |
| File size | ≤200 lines per file | Global CLAUDE.md rule |

---

## Out of Scope (v1.0)

- Kubernetes / HPA — Docker Compose only
- Email delivery — WhatsApp + SMS only
- Multi-language (Sinhala) — English only in v1, `language` field reserved for v1.1
- Semantic cache for LLM calls — future optimisation
- Web push notifications
- User dashboard login / auth — read-only public dashboard only

---

## Open Questions

- [ ] Twilio WhatsApp sandbox vs approved sender — dev uses sandbox
- [ ] Gemini 2.5 Flash API key quota — confirm before going live
- [ ] Baseline cold-start: first run has no baselines → skip Z-score, use rate-only detection
- [ ] OTP provider for subscriber verification — Twilio Verify or separate?

---

## Phases

### Phase 1 — Foundation
- [x] `CLAUDE.md` written
- [x] `implementation_plan.md` (this file)
- [ ] `.gitignore`
- [ ] `.env.example`
- [ ] `requirements.txt` — all deps pinned with `~=`
- [ ] `Dockerfile` — python:3.11-slim, non-root
- [ ] `docker-compose.yml` — TimescaleDB (5433), Redis (6380), app (8002)
- [ ] `src/floodsense_lk/config/settings.py` — pydantic-settings BaseSettings
- [ ] `src/floodsense_lk/core/exceptions.py` — typed exception hierarchy
- [ ] `src/floodsense_lk/core/logging.py` — structlog, no PII
- [ ] `src/floodsense_lk/core/security.py` — SHA256 hashing, admin key check
- [ ] `src/floodsense_lk/db/timescale.py` — asyncpg pool, startup retry
- [ ] `src/floodsense_lk/db/redis_client.py` — async Redis, graceful fallback
- [ ] `src/floodsense_lk/db/migrations/001_anomaly_events.sql`
- [ ] `src/floodsense_lk/db/migrations/002_alert_history.sql`
- [ ] `src/floodsense_lk/db/migrations/003_station_baselines.sql`
- [ ] `src/floodsense_lk/db/migrations/004_subscribers.sql`
- [ ] `src/floodsense_lk/db/migrations/005_pipeline_runs.sql`
- [ ] `src/floodsense_lk/mcp/client.py` — RiverMCPClient, retry, circuit breaker
- [ ] `src/floodsense_lk/agents/state.py` — FloodSenseState TypedDict
- [ ] `src/floodsense_lk/agents/graph.py` — LangGraph skeleton, stub nodes, routing
- [ ] `src/floodsense_lk/services/scheduler_service.py` — APScheduler + pipeline lock
- [ ] `src/floodsense_lk/main.py` — FastAPI + lifespan
- [ ] All `__init__.py` files
- [ ] Verify Docker stack starts and migrations run

### Phase 2 — Monitor + Anomaly Agents
- [ ] `agents/supervisor.py` — season detection, intensity from recent anomaly count
- [ ] `agents/monitor.py` — 5 MCP tool calls, state population
- [ ] `services/baseline_service.py` — compute_baseline, get_baseline (asyncpg)
- [ ] `services/anomaly_service.py` — z_score, rate_spike, corridor propagation, compound basin
- [ ] `agents/anomaly.py` — Gemini structured output, calls anomaly_service

### Phase 3 — Risk + Alert
- [ ] `agents/risk_scorer.py` — 0-100 score, season multipliers, should_alert >= 61
- [ ] `services/alert_service.py` — cooldown dedup, fatigue cap, delivery chain
- [ ] `agents/alert_agent.py` — Gemini message composition, Twilio WhatsApp/SMS
- [ ] `agents/report_agent.py` — pipeline_runs insert, Redis dashboard cache update

### Phase 4 — API + Dashboard
- [ ] `models/` — Pydantic schemas for all 4 domain entities
- [ ] `api/routes/subscribe.py` — POST /subscribe, DELETE /unsubscribe
- [ ] `api/routes/alerts.py` — GET /alerts with filters
- [ ] `api/routes/status.py` — GET /status, /health, /ready
- [ ] `api/routes/admin.py` — POST /admin/run, false-positive marking
- [ ] `api/middleware.py` — 30 req/min rate limit per IP
- [ ] Jinja2 templates — dashboard, alerts, station detail
- [ ] Leaflet.js map (40 stations colour-coded)
- [ ] Chart.js 48-hr water level chart

### Phase 5 — Testing + Hardening
- [ ] `tests/conftest.py` — mock MCP client, mock DB, mock Redis
- [ ] `tests/test_agents/` — unit test each node with injected state
- [ ] `tests/test_services/` — anomaly logic, baseline compute, alert dedup
- [ ] End-to-end test with injected anomaly bypassing MCP
- [ ] Chaos test: MCP down, DB down, Redis down — graceful handling
- [ ] `pytest.ini` with asyncio_mode = auto
