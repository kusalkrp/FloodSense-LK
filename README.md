# FloodSense LK

> Autonomous agentic flood early warning system for Sri Lanka — open source, public, no login required.

FloodSense LK monitors all 40 of Sri Lanka's river gauging stations every 30 minutes using a LangGraph multi-agent pipeline. It detects anomalous water level behaviour **before official thresholds are crossed**, scores flood risk, and surfaces the results through a live React dashboard.

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [System Architecture](#system-architecture)
- [Agent Pipeline](#agent-pipeline)
- [Anomaly Detection](#anomaly-detection)
- [Data Flow](#data-flow)
- [Dashboard](#dashboard)
- [API Reference](#api-reference)
- [Quickstart](#quickstart)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Sri Lanka Seasonal Calendar](#sri-lanka-seasonal-calendar)
- [Contributing](#contributing)

---

## Why This Exists

Sri Lanka experiences severe flooding every monsoon season — primarily along the Kelani, Kalu, Nilwala, and Mahaweli river basins. Official flood warnings typically rely on water levels crossing fixed thresholds. By the time a threshold is crossed, communities downstream have little time to respond.

FloodSense LK aims to close that gap by:

- Detecting **rate-of-rise anomalies** hours before threshold crossings
- Tracking **upstream propagation** along the Kelani corridor (Norwood → Colombo, ~5.5h travel time)
- Maintaining **per-station seasonal baselines** (52-week × 40 stations) to distinguish genuine anomalies from normal monsoon rises
- Exposing all of this through a **fully public dashboard** — no login, no account, no PII

---

## System Architecture

```mermaid
graph TB
    subgraph External["External Systems"]
        ARC[ArcGIS Telemetry<br/>40 gauging stations]
        GEM[Gemini 2.5 Flash<br/>Google AI]
    end

    subgraph MCP["mcp-lk-river-intel (separate service)"]
        direction TB
        MCPDB[(TimescaleDB<br/>port 5432)]
        MCPRED[(Redis<br/>port 6379)]
        MCPAPI[MCP SSE Server<br/>port 8765]
        ARC -->|every 15 min| MCPDB
        MCPDB --- MCPAPI
        MCPRED --- MCPAPI
    end

    subgraph FloodSense["FloodSense LK (this repo)"]
        direction TB
        SCHED[APScheduler<br/>every 30 min]
        GRAPH[LangGraph Pipeline]
        FSDB[(TimescaleDB<br/>port 5433)]
        FSRED[(Redis<br/>port 6380)]
        API[FastAPI<br/>port 8002]
        REACT[React Dashboard<br/>served as SPA]

        SCHED -->|triggers| GRAPH
        GRAPH -->|writes anomalies| FSDB
        GRAPH -->|writes dashboard cache| FSRED
        API -->|reads| FSDB
        API -->|reads| FSRED
        API -->|serves| REACT
    end

    MCPAPI -->|SSE tool calls| GRAPH
    GEM -->|LLM reasoning| GRAPH
```

> **Key design rule:** FloodSense LK never connects directly to the MCP server's database or Redis. All data access goes through MCP tool calls over SSE via `mcp/client.py`.

---

## Agent Pipeline

```mermaid
flowchart TD
    START([Pipeline triggered<br/>every 30 min]) --> SUP

    SUP["🧠 Supervisor Agent<br/><br/>Reads recent anomaly count + season<br/>Sets monitoring intensity:<br/>STANDARD / ELEVATED / HIGH_ALERT"]

    SUP --> MON

    MON["📡 Monitor Agent<br/><br/>Calls 5 MCP tools in parallel:<br/>• get_all_current_levels<br/>• get_rising_stations<br/>• get_alert_stations<br/>• get_kelani_corridor<br/>• get_all_basins_summary<br/><br/>Flags stale gauges (no update &gt; 70 min)"]

    MON --> CALM{Rising or<br/>alert stations?}
    CALM -->|No — calm day fast path| REP
    CALM -->|Yes| ANO

    ANO["🔬 Anomaly Agent<br/><br/>Per flagged station:<br/>• get_station_history (48h)<br/>• get_historical_comparison<br/>• get_flood_risk_score<br/><br/>Runs: Z-score, rate spike,<br/>Kelani propagation, compound basin<br/>Gemini classifies + explains<br/>Persists to anomaly_events table"]

    ANO --> RSK

    RSK["⚖️ Risk Scorer Agent<br/><br/>4-component score (0–100):<br/>Z-score × rate spike × season × intensity<br/>Deterministic — no LLM calls"]

    RSK --> REP

    REP["📝 Report Agent<br/><br/>• Inserts pipeline_runs row<br/>• Updates Redis dashboard cache<br/>• Writes risk scores to anomaly_events<br/>• Logs run summary"]

    REP --> END_([Pipeline complete])

    style CALM fill:#1a2035,stroke:#334155
    style START fill:#1e1b4b,stroke:#6366f1,color:#a5b4fc
    style END_ fill:#1e1b4b,stroke:#6366f1,color:#a5b4fc
```

### Monitoring Intensity

| Intensity | Trigger | Effect |
|---|---|---|
| `STANDARD` | Quiet period, no recent anomalies | Normal thresholds |
| `ELEVATED` | Active monsoon season OR 2+ recent anomalies | 1.2× risk score multiplier |
| `HIGH_ALERT` | 5+ anomalies in last 6h OR critical station active | 1.5× risk score multiplier |

---

## Anomaly Detection

```mermaid
flowchart LR
    subgraph Signals["Detection Signals"]
        ZS["Z-score Level<br/>z = (level - baseline_avg) / stddev<br/>z &gt; 2.0 → LOW<br/>z &gt; 3.0 → MEDIUM<br/>z &gt; 4.0 → CRITICAL"]
        RS["Rate Spike<br/>ratio = current_rate / baseline_rate<br/>≥ 2× → MEDIUM<br/>≥ 3× → HIGH<br/>≥ 5× → CRITICAL"]
        UP["Upstream Propagation<br/>Kelani corridor: if Norwood/Kithulgala<br/>rising &gt; 0.15 m/hr → ETA computed<br/>downstream to Colombo (~5.5h)"]
        CB["Compound Basin<br/>3+ stations rising in same basin<br/>simultaneously → score multiplier"]
    end

    subgraph Baseline["Per-Station Baselines"]
        BL["52 weeks × 40 stations<br/>avg_level_m + stddev_level_m<br/>avg_rate_m_per_hr<br/>Computed from 7-day MCP history<br/>Min 50 samples required<br/>Recomputed every Sunday"]
    end

    Baseline --> ZS
    Baseline --> RS
```

### Signal Thresholds

| Signal | Trigger | Min Severity | Max Severity |
|---|---|---|---|
| Z-score | z > 2.0 | LOW | CRITICAL (z > 4.0) |
| Rate spike | ratio ≥ 2× baseline | MEDIUM | CRITICAL (≥ 5×) |
| Upstream propagation | Kelani upstream rate > 0.15 m/hr | HIGH | CRITICAL |
| Compound basin | ≥ 3 stations rising in basin | MEDIUM | HIGH |

### Anomaly Deduplication

The same `(station, anomaly_type)` combination is suppressed for 2 hours after first detection, preventing alert spam during sustained flood events. `COMPOUND_BASIN` requires a compound score threshold ≥ 3.0 to filter out noise from single slow-rising stations.

---

## Data Flow

```mermaid
sequenceDiagram
    participant ArcGIS
    participant MCP as mcp-lk-river-intel
    participant FS as FloodSense LK
    participant DB as TimescaleDB (5433)
    participant Cache as Redis (6380)
    participant UI as React Dashboard

    ArcGIS->>MCP: Telemetry every 15 min
    MCP->>MCP: Ingest + normalise to TimescaleDB

    loop Every 30 minutes
        FS->>MCP: SSE tool call: get_all_current_levels
        MCP-->>FS: 40 station snapshots
        FS->>MCP: SSE tool calls (rising/alert/corridor/basins)
        MCP-->>FS: Aggregated data

        alt Rising or alert stations found
            FS->>MCP: get_station_history (48h) per flagged station
            MCP-->>FS: Historical readings
            FS->>FS: Z-score + rate spike + propagation detection
            FS->>DB: INSERT anomaly_events
        end

        FS->>DB: INSERT pipeline_runs
        FS->>Cache: SET floodsense:dashboard:current (TTL 35 min)
        FS->>Cache: SET floodsense:stations:current (TTL 35 min)
    end

    UI->>FS: GET /api/v1/status (every 30s)
    FS->>Cache: GET floodsense:dashboard:current
    Cache-->>FS: Dashboard snapshot
    FS-->>UI: JSON response

    UI->>FS: GET /api/v1/stations/current (every 60s)
    UI->>FS: GET /api/v1/alerts (every 60s)
    FS->>DB: SELECT anomaly_events
    FS-->>UI: Anomaly event list
```

---

## Dashboard

The React dashboard is served as a SPA at `http://localhost:8002`. No login required.

### Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Live map, stat cards, water level charts, basin radar, full station table |
| Anomaly Events | `/alerts` | Filterable table of all detected anomalies with Z-score, rate ratio, risk score |
| System Health | `/system` | Monitoring intensity, offline gauges, pipeline run history chart |

### Dashboard Component Map

```mermaid
graph TD
    DASH[Dashboard Page]

    DASH --> MAP["🗺️ Station Map<br/>Leaflet dark tiles<br/>40 colour-coded circle markers<br/>Click marker → 48h detail modal"]
    DASH --> STAT["📊 Stat Cards<br/>Stations / Rising / Alert / Active Anomalies"]
    DASH --> LEVEL["📈 Top Stations by Level<br/>Recharts AreaChart — top 5 live stations"]
    DASH --> RATE["📉 Rate of Rise<br/>Recharts BarChart — top 12, green/red coded"]
    DASH --> KELANI["🌊 Kelani Corridor<br/>LineChart: Norwood → Colombo<br/>Shows upstream propagation wave"]
    DASH --> BASIN["🏔️ Basin Averages<br/>Horizontal BarChart by basin"]
    DASH --> RADAR["🕸️ Basin Risk Radar<br/>RadarChart: top 6 basins × 5 risk dimensions<br/>(level, rising, alert, offline, station count)"]
    DASH --> TABLE["📋 All 40 Stations Table<br/>Sorted by level, threshold progress bars<br/>Click row → 48h detail modal"]

    TABLE -->|click| MODAL
    MAP -->|click marker| MODAL

    MODAL["🔍 Station Detail Modal<br/><br/>Current level · Rate · 6h forecast<br/>48h time-series (Recharts ComposedChart)<br/>Seasonal baseline band (avg ±2σ, current ISO week)<br/>Dashed amber: 6h linear projection<br/>Data from: GET /api/v1/stations/{name}/history"]
```

### System Page

```mermaid
graph TD
    SYS[System Page]
    SYS --> INT[Monitoring Intensity card]
    SYS --> ANO[Active Anomalies card]
    SYS --> OFF[Offline Gauges card + chip list]
    SYS --> PHC["📊 Pipeline Health Chart<br/>ComposedChart: bars=anomalies found<br/>line=run duration (seconds)<br/>Last 24 pipeline runs"]
    SYS --> SUM[Last Run Summary text]
```

---

## API Reference

All read endpoints are public. Admin endpoints require `X-Admin-Key` header.

### Status & Stations

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/api/v1/status` | — | Dashboard snapshot + last run summary from Redis |
| `GET` | `/api/v1/stations/current` | — | All 40 stations — level, rate, alert level, stale flag |
| `GET` | `/api/v1/stations/{name}/history` | `hours=48` | 48h time-series for one station + current-week baseline |
| `GET` | `/api/v1/basins` | — | Basin-level aggregation (count, max/avg level, rising/alert/stale) |
| `GET` | `/api/v1/baselines/{station}` | — | Per-station per-week baselines (up to 52 rows) |
| `GET` | `/api/v1/pipeline/runs` | `limit=20` | Recent pipeline run summaries — public stats |
| `GET` | `/api/v1/ready` | — | Readiness probe — 200 if DB is reachable |

### Anomaly Events

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/api/v1/alerts` | `hours=24`, `severity=HIGH`, `basin=Kelani`, `limit=50` | Anomaly events with filters |
| `GET` | `/api/v1/alerts/active` | — | Unresolved anomalies from the last 6 hours |

### Admin (requires `X-Admin-Key` header)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/run` | Trigger an immediate pipeline run |
| `POST` | `/api/v1/admin/false-positive/{id}` | Mark an anomaly as a false positive |
| `POST` | `/api/v1/admin/bootstrap-baselines` | One-time baseline bootstrap from 7-day MCP history |
| `GET` | `/api/v1/admin/runs` | Full pipeline run history (includes error messages) |

### Example: Station History

**`GET /api/v1/stations/Hanwella/history?hours=48`**
```json
{
  "station_name": "Hanwella",
  "hours": 48,
  "readings": [
    { "timestamp": "2026-03-20T10:00:00+05:30", "level_m": 2.41, "rate": 0.012 },
    { "timestamp": "2026-03-20T10:15:00+05:30", "level_m": 2.45, "rate": 0.016 }
  ],
  "baseline": {
    "avg_level_m": 2.21,
    "stddev_level_m": 0.38,
    "avg_rate_m_per_hr": 0.008
  }
}
```

### Example: Status

**`GET /api/v1/status`**
```json
{
  "dashboard": {
    "run_id": "a3f8c2d1",
    "updated_at": "2026-03-22T08:00:00+05:30",
    "monitoring_intensity": "ELEVATED",
    "stations_total": 40,
    "stations_rising": 7,
    "stations_alert": 2,
    "anomalies_active": 3,
    "errors": ["stale_data: ['Thanthirimale', 'Yaka Wewa']"]
  },
  "last_run_summary": "Run a3f8c2d1 | intensity=ELEVATED | Stations: 40 | Rising: 7 | Alert: 2 | Anomalies: 3"
}
```

---

## Quickstart

### Prerequisites

- Docker + Docker Compose
- [`mcp-lk-river-intel`](https://github.com/kusal-viraj/mcp-lk-river-intel) running in SSE mode on port 8765
- A Gemini API key ([Google AI Studio](https://aistudio.google.com) — free tier sufficient)

### 1. Start the MCP server

```bash
# In the mcp-lk-river-intel directory
MCP_TRANSPORT=sse docker compose up
# MCP server now listening at http://localhost:8765/sse
```

### 2. Clone and configure

```bash
git clone https://github.com/kusal-viraj/floodsense-lk.git
cd floodsense-lk
cp .env.example .env.local
```

Edit `.env.local` — minimum required:

```bash
GEMINI_API_KEY=your_key_here
ADMIN_API_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
```

### 3. Start the full stack

```bash
docker compose up --build
```

Starts three containers:
- `timescaledb` — PostgreSQL 15 + TimescaleDB on port **5433**
- `redis` — Redis 7 on port **6380**
- `floodsense` — FastAPI + React SPA on port **8002**

On first boot, all SQL migrations run automatically and baselines are bootstrapped from 7-day MCP history.

### 4. Open the dashboard

```
http://localhost:8002
```

### 5. Trigger a manual pipeline run

```bash
curl -X POST http://localhost:8002/api/v1/admin/run \
  -H "X-Admin-Key: your_admin_key_here"
```

### Local frontend development

```bash
cd frontend
npm install
npm run dev
# Vite dev server at http://localhost:5173
# API calls proxied automatically to http://localhost:8002
```

### Run tests

```bash
PYTHONPATH=src pytest tests/ -v
# 55 tests — all use in-memory mocks, no real DB or MCP needed
```

---

## Project Structure

```
floodsense-lk/
├── FLOODSENSE_SYSTEM_DESIGN.md      # Full architecture spec — source of truth
├── CLAUDE.md                        # AI assistant instructions
├── .env.example                     # Safe to commit — placeholders only
├── docker-compose.yml
├── Dockerfile                       # Multi-stage: Node 20 builds frontend, Python 3.11 serves
├── requirements.txt                 # All deps pinned with ~=
│
├── src/floodsense_lk/
│   ├── main.py                      # FastAPI app + lifespan startup sequence
│   │
│   ├── agents/
│   │   ├── graph.py                 # LangGraph graph wiring + conditional routing
│   │   ├── state.py                 # FloodSenseState TypedDict
│   │   ├── supervisor.py            # Sets STANDARD / ELEVATED / HIGH_ALERT intensity
│   │   ├── monitor.py               # 5 parallel MCP tool calls
│   │   ├── anomaly.py               # Z-score + rate spike + Gemini classification
│   │   ├── risk_scorer.py           # Deterministic 4-component 0–100 scoring
│   │   └── report_agent.py          # Persists run + updates Redis cache
│   │
│   ├── services/
│   │   ├── anomaly_service.py       # Pure detection functions (Z-score, rate spike, propagation)
│   │   ├── baseline_service.py      # Per-station per-week baseline CRUD + bootstrap
│   │   └── scheduler_service.py     # APScheduler setup + Redis pipeline lock
│   │
│   ├── mcp/
│   │   └── client.py                # Only file that may call MCP tools — circuit breaker + retry
│   │
│   ├── api/routes/
│   │   ├── alerts.py                # GET /alerts, /alerts/active
│   │   ├── status.py                # GET /status, /stations/*, /basins, /pipeline/runs
│   │   ├── admin.py                 # POST /admin/* (admin key required)
│   │   └── dashboard.py             # Jinja2 HTML fallback routes
│   │
│   ├── db/
│   │   ├── timescale.py             # asyncpg connection pool
│   │   ├── redis_client.py          # async Redis client
│   │   └── migrations/              # 001–008 SQL — applied on startup
│   │
│   ├── core/
│   │   ├── logging.py               # structlog setup — never logs PII
│   │   ├── exceptions.py            # AppBaseError hierarchy
│   │   └── security.py              # Admin key verification (constant-time compare)
│   │
│   └── config/settings.py           # pydantic-settings BaseSettings from .env.local
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # Map + charts + station table + detail modal
│   │   │   ├── AlertsPage.tsx       # Filterable anomaly events table
│   │   │   └── SystemPage.tsx       # Health cards + pipeline history chart
│   │   ├── components/
│   │   │   ├── StationMap.tsx       # Leaflet dark map, 40 hardcoded coords
│   │   │   ├── StationDetailModal.tsx # 48h chart + baseline band + forecast
│   │   │   ├── LevelChart.tsx       # AreaChart top 5 stations
│   │   │   ├── RateChart.tsx        # BarChart top 12 by rate
│   │   │   ├── KelaniCorridor.tsx   # LineChart Kelani Ganga corridor
│   │   │   ├── BasinChart.tsx       # Horizontal BarChart
│   │   │   ├── BasinRadarChart.tsx  # RadarChart 6 basins × 5 dimensions
│   │   │   ├── PipelineHealthChart.tsx # ComposedChart run anomalies + duration
│   │   │   ├── StationsTable.tsx    # Full table with threshold progress bars
│   │   │   ├── StatCard.tsx         # Metric card with icon + glow
│   │   │   ├── AlertBadge.tsx       # Severity/alert level chip
│   │   │   └── Layout.tsx           # Sidebar + AppBar
│   │   ├── services/api.ts          # Typed fetch client + all TypeScript interfaces
│   │   └── theme.ts                 # Dark glassmorphism MUI theme + color constants
│   └── vite.config.ts               # Dev proxy → localhost:8002
│
└── tests/
    ├── conftest.py                  # mock_redis, mock_db, mock_mcp shared fixtures
    ├── fixtures/sample_data.py      # Shared test data constants
    ├── test_agents/
    │   ├── test_graph_routing.py    # after_monitor_router conditional logic
    │   ├── test_supervisor.py       # LLM success + fallback paths
    │   ├── test_monitor.py          # State population, stale detection
    │   └── test_risk_scorer.py      # Scoring, multipliers, cap at 100
    └── test_services/
        ├── test_anomaly_service.py  # Z-score, rate spike, corridor, compound (15 tests)
        └── test_baseline_service.py # CRUD, low_confidence flag, empty history
```

---

## Tech Stack

### Backend

| Component | Technology | Notes |
|---|---|---|
| Agent framework | LangGraph 0.2 | Stateful graph, conditional routing |
| LLM | Gemini 2.5 Flash | Single model for all agents, temperature=0.1 |
| API | FastAPI + Uvicorn | Thin route handlers, Pydantic schemas |
| Scheduler | APScheduler 3.x | 30-min interval, Redis pipeline lock prevents overlap |
| Time-series DB | TimescaleDB (PostgreSQL 15) | Port 5433 |
| Cache / State | Redis 7 | Port 6380, 35-min TTL on dashboard keys |
| MCP client | `mcp` SDK, SSE transport | Circuit breaker + 3-retry backoff |
| Validation | Pydantic v2 + pydantic-settings | |
| Logging | structlog | Structured JSON logs, no PII |
| HTTP client | httpx async | |
| Rate limiting | slowapi | 30 req/min per IP |

### Frontend

| Component | Technology |
|---|---|
| Framework | React 18 + Vite 5 + TypeScript |
| UI library | Material UI v5 (dark glassmorphism theme) |
| Charts | Recharts (Area, Bar, Line, Radar, Composed) |
| Maps | Leaflet.js (CartoDB dark tiles) |
| Server state | TanStack Query v5 |
| Routing | React Router v6 |

---

## Database Schema

```mermaid
erDiagram
    anomaly_events {
        bigserial id PK
        text station_name
        text basin_name
        timestamptz detected_at
        text anomaly_type
        text severity
        decimal z_score
        decimal current_level_m
        decimal baseline_level_m
        decimal rate_spike_ratio
        decimal risk_score
        decimal upstream_propagation_eta_hrs
        text explanation
        decimal confidence
        timestamptz resolved_at
        boolean false_positive
        text run_id
    }

    station_baselines {
        text station_name PK
        int week_of_year PK
        decimal avg_level_m
        decimal stddev_level_m
        decimal avg_rate_m_per_hr
        decimal stddev_rate
        int sample_count
        boolean low_confidence
        timestamptz computed_at
    }

    pipeline_runs {
        bigserial id PK
        text run_id UK
        timestamptz started_at
        timestamptz completed_at
        int duration_ms
        text status
        text monitoring_intensity
        text routing_decision
        int stations_checked
        int rising_count
        int anomalies_found
        text error_message
    }

    anomaly_events }o--|| pipeline_runs : "run_id"
    anomaly_events }o--|| station_baselines : "station_name (baseline lookup)"
```

### Redis Key Schema

| Key | Value | TTL |
|---|---|---|
| `floodsense:dashboard:current` | JSON dashboard snapshot | 35 min |
| `floodsense:stations:current` | JSON array of all 40 station states | 35 min |
| `floodsense:anomalies:active` | JSON array of unresolved anomalies | 35 min |
| `floodsense:run:last_summary` | Plain text run summary | None |
| `floodsense:run:active` | Pipeline lock (SET NX) | 10 min |

---

## Environment Variables

```bash
# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_DSN=postgresql+asyncpg://floodsense_user:password@localhost:5433/floodsense_lk

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6380

# ── MCP Server ────────────────────────────────────────────────────────────────
# mcp-lk-river-intel must be running in SSE mode
MCP_SERVER_URL=http://localhost:8765

# ── LLM — single model for all agents ────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key          # Required — free tier works
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
GEMINI_TEMPERATURE=0.1
GEMINI_MAX_TOKENS=4096

# ── Security ──────────────────────────────────────────────────────────────────
# Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
ADMIN_API_KEY=replace_with_random_32_char_key

# ── Pipeline ──────────────────────────────────────────────────────────────────
PIPELINE_INTERVAL_SECONDS=1800              # 30 minutes
BASELINE_RECOMPUTE_DAY=sunday

# ── App ───────────────────────────────────────────────────────────────────────
APP_PORT=8002
LOG_LEVEL=INFO
```

---

## Sri Lanka Seasonal Calendar

The Supervisor agent uses the Sri Lanka monsoon calendar to set monitoring intensity at startup and after each pipeline run.

| Season | Months | High-Risk Basins | Default Intensity |
|---|---|---|---|
| Southwest Monsoon | May – September | Kelani, Kalu, Nilwala, Gin | ELEVATED |
| Northeast Monsoon | October – January | Mahaweli, Kirindi, Malwathu | ELEVATED |
| Inter-monsoon | Feb – Mar, April | All basins | STANDARD |

---

## Kelani River Corridor

The Kelani Ganga is Sri Lanka's most flood-prone river, draining directly into Colombo. FloodSense models upstream-to-downstream propagation:

```
Norwood         (headwaters, ~5.5h to Colombo)
  ↓  ~1.5h
Kithulgala
  ↓  ~0.8h
Deraniyagala
  ↓  ~0.7h
Glencourse
  ↓  ~0.6h
Holombuwa
  ↓  ~0.5h
Hanwella
  ↓  ~0.5h
Nagalagam St.   (Colombo, 0h)
```

If Norwood or Kithulgala shows a rate > 0.15 m/hr, the Anomaly Agent computes a downstream ETA and flags it as `UPSTREAM_PROPAGATION` with the hours-to-Colombo estimate.

---

## MCP Tool Calls by Agent

```mermaid
graph LR
    subgraph Monitor["Monitor Agent (5 parallel calls)"]
        M1[get_all_current_levels]
        M2[get_rising_stations]
        M3[get_alert_stations]
        M4[get_kelani_corridor]
        M5[get_all_basins_summary]
    end

    subgraph Anomaly["Anomaly Agent (3 calls per flagged station)"]
        A1[get_station_history]
        A2[get_historical_comparison]
        A3[get_flood_risk_score]
    end

    subgraph Report["Report Agent"]
        R1[get_system_status]
    end

    MCP["mcp-lk-river-intel<br/>SSE @ :8765<br/><br/>Circuit breaker opens<br/>after 3 failures (5 min reset)<br/>Retry backoff: 1s → 2s → 4s"]

    M1 & M2 & M3 & M4 & M5 --> MCP
    A1 & A2 & A3 --> MCP
    R1 --> MCP
```

---

## Architecture Rules

These constraints are enforced throughout the codebase and must not be violated:

| Rule | Reason |
|---|---|
| `core/` never imports from `api/`, `db/`, or `services/` | Keeps domain logic framework-independent |
| All MCP calls go through `mcp/client.py` | Single place for circuit breaker, retry, and logging |
| Agent nodes are pure functions: `(state) -> state` | Testable without graph execution |
| No LLM calls outside agent nodes | Prompts as module-level constants, no inline f-strings |
| No f-string SQL — parameterized asyncpg only | Injection prevention |
| No PII ever stored or logged | Fully public project, no user accounts |

---

## Contributing

FloodSense LK is open source. Contributions are welcome — especially improvements to anomaly detection accuracy, new basin support, and dashboard visualisations.

```bash
# Fork, clone, then:
cp .env.example .env.local
# Set GEMINI_API_KEY at minimum

docker compose up --build        # Full stack
PYTHONPATH=src pytest tests/ -v  # Tests (no real DB needed)

cd frontend && npm install && npm run dev  # Frontend with hot reload
```

Please open an issue before submitting large PRs. Keep pull requests focused on a single concern.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by Kusal Punchihewa. River telemetry sourced from Sri Lanka's Department of Irrigation via ArcGIS, ingested by [mcp-lk-river-intel](https://github.com/kusal-viraj/mcp-lk-river-intel).*
