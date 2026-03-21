# FloodSense LK
## Agentic Flood Early Warning System for Sri Lanka

---

| Field | Value |
|---|---|
| Project | FloodSense LK |
| Type | LangGraph Agentic System — Autonomous Flood Monitoring & Alert Delivery |
| Depends On | mcp-lk-river-intel (must be running in SSE mode) |
| Data Source | mcp-lk-river-intel MCP tools — no direct ArcGIS access |
| Stations Monitored | 40 unique river gauging stations across Sri Lanka |
| Alert Channels | WhatsApp, SMS, Email, Webhook |
| LLM | Gemini 2.5 Flash (all agents — single model) |
| Stack | Python, LangGraph, Gemini 2.5 Flash, FastAPI, TimescaleDB, Redis, APScheduler, Docker Compose |
| Version | v1.0.0 — Initial Design |

---

## Table of Contents

1. Project Overview
2. System Architecture
3. LangGraph Agent Pipeline
4. Agent Specifications
5. Anomaly Detection Logic
6. Alert Delivery System
7. Storage Schema
8. MCP Integration
9. API Layer
10. Dashboard
11. Project Structure
12. Docker Compose Setup
13. Environment Configuration
14. Implementation Plan
15. Local Development Guide
16. Production Considerations

---

## 1. Project Overview

FloodSense LK is an autonomous agentic system that continuously monitors Sri Lanka's 40 river gauging stations, detects anomalous water level behaviour, and delivers early flood warnings to subscribers — all without requiring a human to ask a question.

The system is built entirely on top of `mcp-lk-river-intel`. It does not access the ArcGIS endpoint or TimescaleDB directly — it calls MCP tools exclusively. This separation of concerns means FloodSense can be developed, tested, and deployed independently of the data layer.

### 1.1 What the MCP Cannot Do Alone

The MCP server is passive and reactive — it only responds when called. It cannot:

- Watch stations autonomously on a schedule
- Compare current conditions against seasonal historical baselines
- Detect anomalous behaviour before official alert thresholds are crossed
- Push notifications to humans proactively
- Correlate upstream rises with predicted downstream flood timing
- Maintain a record of past anomaly events and alert history

FloodSense provides all of these.

### 1.2 Core Value Proposition

The Irrigation Department's official alert levels are reactive — they fire when water has already reached a dangerous threshold. FloodSense detects early signals before that:

- A station rising at 3x its historical rate for this time of year
- An upstream spike predicting a downstream flood 3-5 hours ahead
- A level statistically anomalous even if still below the official alert threshold
- Multiple stations in the same basin rising simultaneously — compound risk

### 1.3 Target Users

- Farmers near flood-prone rivers — Kelani, Kalu, Nilwala basins
- Road transport operators near river crossings
- Tourism operators — Kitulgala white-water rafting sits on Kelani Ganga at Kithulgala station
- Local government disaster management officers

Primary delivery channel: **WhatsApp** — near-universal penetration in Sri Lanka even in rural areas.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FloodSense LK                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              APScheduler (every 30 min)                 │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │         LangGraph Agent Pipeline                        │   │
│  │   All agents: Gemini 2.5 Flash                         │   │
│  │                                                         │   │
│  │  Supervisor → Monitor → Anomaly → Risk → Alert/Report  │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              Service Layer                              │   │
│  │  AnomalyService │ AlertService │ BaselineService        │   │
│  └──────┬───────────────────────────────────┬─────────────┘   │
│         │                                   │                  │
│  ┌──────▼──────────┐             ┌──────────▼──────────────┐  │
│  │  Redis Cache    │             │  TimescaleDB            │  │
│  │  (run state,    │             │  (anomaly_events,       │  │
│  │   dedup keys)   │             │   alert_history,        │  │
│  └─────────────────┘             │   station_baselines,    │  │
│                                  │   subscribers)          │  │
│                                  └─────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FastAPI — /subscribe  /alerts  /status  /admin        │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │  SSE / HTTP — MCP tool calls
┌──────────────────────────────▼──────────────────────────────────┐
│                   mcp-lk-river-intel                            │
│              (running on localhost:8001 in SSE mode)           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 LLM Strategy

**Single model: Gemini 2.5 Flash for all agents.**

Gemini 2.5 Flash's reasoning capability handles all tasks — anomaly classification, risk scoring, alert message generation — without needing a heavier model. One model keeps cost predictable, configuration simple, and latency consistent.

```python
# config/settings.py
class Settings(BaseSettings):
    gemini_model: str = "gemini-2.5-flash-preview-04-17"
    gemini_temperature: float = 0.1   # Low — deterministic reasoning
    gemini_max_tokens: int = 1024
    # Used by every agent — no per-agent override
```

### 2.3 State Management

LangGraph state is a typed dict passed between agents. Nothing is stored in memory between pipeline runs — all persistence goes to TimescaleDB or Redis.

```python
class FloodSenseState(TypedDict):
    run_id: str
    triggered_at: str
    monitoring_intensity: str           # STANDARD | ELEVATED | HIGH_ALERT
    station_snapshots: list[dict]
    rising_stations: list[dict]
    alert_stations: list[dict]
    anomalies_detected: list[dict]
    risk_assessments: list[dict]
    alerts_to_send: list[dict]
    alerts_sent: list[dict]
    report_summary: str
    errors: list[str]
```

---

## 3. LangGraph Agent Pipeline

### 3.1 Graph

```
              START
                │
         ┌──────▼──────┐
         │  Supervisor │  sets monitoring intensity
         └──────┬───────┘
                │
         ┌──────▼──────┐
         │   Monitor   │  fetches all stations via MCP
         └──────┬───────┘
                │
     ┌──────────▼────────────┐
     │ Rising or alert        │
     │ stations found?        │
     └──────┬──────────┬──────┘
           YES          NO
            │           │
     ┌──────▼──────┐  ┌─▼──────────────┐
     │   Anomaly   │  │  Report Agent  │
     │   Agent     │  │  (log only)    │
     └──────┬───────┘  └────────────────┘
            │
     ┌──────▼──────┐
     │ Risk Scorer │
     └──────┬───────┘
            │
   ┌────────▼──────────┐
   │  Score >= 61?      │
   └──────┬────────┬───┘
         YES        NO
          │          │
   ┌──────▼───┐  ┌───▼────────────┐
   │  Alert   │  │  Report Agent  │
   │  Agent   │  └────────────────┘
   └──────┬───┘
          │
   ┌──────▼──────┐
   │Report Agent │
   └──────┬───────┘
          │
         END
```

### 3.2 Conditional Routing

```python
def after_monitor_router(state: FloodSenseState) -> str:
    if not state["rising_stations"] and not state["alert_stations"]:
        return "report_only"
    return "run_anomaly"

def after_risk_router(state: FloodSenseState) -> str:
    high_risk = [r for r in state["risk_assessments"] if r["risk_score"] >= 61]
    return "run_alerts" if high_risk else "report_only"
```

On a calm day with no rising stations the pipeline skips Anomaly and Alert agents entirely — fast, minimal LLM calls.

---

## 4. Agent Specifications

### 4.1 Supervisor Agent

**Model**: Gemini 2.5 Flash

```python
SUPERVISOR_PROMPT = """
You are the supervisor for FloodSense LK, a flood early warning system for Sri Lanka.

Current time: {current_time} (Sri Lanka time UTC+5:30)
Current season: {season}
Previous run summary: {previous_summary}
Recent anomaly count last 24 hrs: {recent_anomaly_count}

Set monitoring intensity:
- STANDARD: No recent anomalies, dry season
- ELEVATED: Monsoon active or 1-2 anomalies in last 24 hrs
- HIGH_ALERT: 3+ anomalies in last 24 hrs or active HIGH/CRITICAL alert

Return JSON only:
{{
  "intensity": "STANDARD|ELEVATED|HIGH_ALERT",
  "reason": "one sentence",
  "focus_basins": []
}}
"""
```

### 4.2 Monitor Agent

**Model**: Gemini 2.5 Flash (structured extraction only — mostly deterministic)

**MCP tools called**:
- `get_all_current_levels()`
- `get_rising_stations(min_rate=0.05)`
- `get_alert_stations()`
- `get_kelani_corridor()`
- `get_all_basins_summary()`

Fetches current state of all 40 stations, filters rising and alert stations, flags stale data.

### 4.3 Anomaly Agent

**Model**: Gemini 2.5 Flash

**MCP tools called** (only for flagged stations):
- `get_station_history(station_name, hours=48)`
- `get_historical_comparison(station_name, days_ago=365)`
- `get_flood_risk_score(station_name)`

```python
ANOMALY_PROMPT = """
You are an anomaly detection agent for Sri Lanka river flood monitoring.

Station: {station_name} | Basin: {basin_name}
Current level: {current_level_m}m
Current rate of rise: {rate_of_rise} m/hr
Historical baseline week {week_of_year}: avg={baseline_avg}m stddev={baseline_stddev}m
Historical baseline rate: {baseline_rate} m/hr
Last 48 hrs trend: {history_summary}
Upstream status: {upstream_status}

Return JSON only:
{{
  "anomaly_detected": true|false,
  "anomaly_type": "RATE_SPIKE|LEVEL_ANOMALY|SEASONAL_DEVIATION|UPSTREAM_PROPAGATION|NONE",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "z_score": float,
  "rate_spike_ratio": float,
  "upstream_propagation_eta_hrs": float|null,
  "explanation": "one sentence plain English",
  "confidence": float
}}
"""
```

### 4.4 Risk Scorer

**Model**: Gemini 2.5 Flash
**No MCP calls** — works on state only

```python
RISK_SCORER_PROMPT = """
You are a flood risk scorer for Sri Lanka.

Anomaly: {anomaly_data}
Basin compound context: {basin_context}
Season: {season} | Intensity: {intensity}

Score 0-100 using:
- Z-score:         0-40 pts  (z=2→20, z=3→35, z=4+→40)
- Rate spike:      0-30 pts  (2x→15, 3x→25, 5x+→30)
- Upstream prop:   0-20 pts  (ETA<2hr→20, <4hr→10)
- Compound basin:  0-10 pts  (2 rising→5, 3+→10)

Multipliers:
- Season (MONSOON): x1.2
- Intensity (HIGH_ALERT): x1.1, ELEVATED: x1.05

Thresholds: 0-30 LOW, 31-60 MEDIUM, 61-80 HIGH, 81-100 CRITICAL

Return JSON only:
{{
  "station": "{station_name}",
  "risk_score": int,
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "score_breakdown": {{}},
  "should_alert": true|false,
  "recommendation": "one sentence action"
}}
"""
```

### 4.5 Alert Agent

**Model**: Gemini 2.5 Flash

```python
ALERT_MESSAGE_PROMPT = """
Compose a flood warning WhatsApp message for Sri Lanka.

Station: {station_name} | Basin: {basin_name}
Risk: {risk_level} ({risk_score}/100)
Level: {current_level_m}m | Normal threshold: {alert_threshold_m}m
Rising: {rate_of_rise} m/hr ({rate_spike_ratio}x above normal)
Action: {recommendation}
Language: {language}  (en=English, si=Sinhala)

Write a clear, calm, actionable message. No panic. Focus on what to do.

Return JSON only:
{{
  "whatsapp_message": "max 500 chars with emoji",
  "sms_message": "max 300 chars plain text fallback"
}}
"""
```

### 4.6 Report Agent

**Model**: Gemini 2.5 Flash
**MCP tools called**: `get_system_status()`

Writes pipeline run summary to TimescaleDB and updates Redis dashboard cache.

---

## 5. Anomaly Detection Logic

### 5.1 Z-Score Level Anomaly

```python
async def compute_z_score(station_name, current_level_m, week_of_year) -> float:
    baseline = await db.get_baseline(station_name, week_of_year)
    if not baseline or baseline.stddev_level_m == 0:
        return 0.0
    return round((current_level_m - baseline.avg_level_m) / baseline.stddev_level_m, 3)

# z > 2.0 → LOW | z > 2.5 → MEDIUM | z > 3.0 → HIGH | z > 4.0 → CRITICAL
```

### 5.2 Rate-of-Rise Spike

```python
async def detect_rate_spike(station_name, current_rate, week_of_year):
    baseline = await db.get_baseline(station_name, week_of_year)
    if not baseline or baseline.avg_rate_m_per_hr == 0:
        return None
    ratio = current_rate / baseline.avg_rate_m_per_hr
    if ratio < 2.0:
        return None
    severity = "MEDIUM" if ratio < 3 else "HIGH" if ratio < 5 else "CRITICAL"
    return AnomalySignal(type="RATE_SPIKE", severity=severity, ratio=round(ratio, 2))
```

### 5.3 Kelani Corridor Upstream Propagation

```python
KELANI_CORRIDOR = [
    ("Norwood",           5.0),   # hours to propagate to Colombo
    ("Kithulgala",        4.0),
    ("Deraniyagala",      3.0),
    ("Glencourse",        2.5),
    ("Holombuwa",         2.0),
    ("Hanwella",          1.0),
    ("Nagalagam Street",  0.0),
]

async def detect_upstream_propagation(corridor_status) -> list:
    warnings = []
    for i, (station, eta) in enumerate(KELANI_CORRIDOR[:-1]):
        upstream = corridor_status.get(station, {})
        if upstream.get("rate_of_rise", 0) > 0.15:
            for downstream, d_eta in KELANI_CORRIDOR[i+1:]:
                warnings.append({
                    "source": station,
                    "affected": downstream,
                    "eta_hours": eta - d_eta,
                    "upstream_rate": upstream["rate_of_rise"]
                })
    return warnings
```

### 5.4 Compound Basin Risk

```python
def compute_basin_compound_score(basin_name, rising_stations) -> float:
    basin_rising = [s for s in rising_stations if s["basin"] == basin_name]
    n = len(basin_rising)
    if n == 0: return 0.0
    multiplier = 1.0 if n < 2 else 1.5 if n < 3 else 2.0
    avg_rate = sum(s["rate_of_rise"] for s in basin_rising) / n
    return min(avg_rate * multiplier * 10, 10.0)
```

### 5.5 Baseline Computation

Pre-computed weekly from historical TimescaleDB data, refreshed every Sunday.

```python
async def compute_station_baseline(station_name, week_of_year):
    result = await db.fetch_one("""
        SELECT
            AVG(water_level_m)    AS avg_level_m,
            STDDEV(water_level_m) AS stddev_level_m,
            AVG(rate_of_rise)     AS avg_rate_m_per_hr,
            STDDEV(rate_of_rise)  AS stddev_rate,
            COUNT(*)              AS sample_count
        FROM measurements
        WHERE station_name = :station
          AND EXTRACT(WEEK FROM measured_at) = :week
          AND measured_at < NOW() - INTERVAL '7 days'
    """, {"station": station_name, "week": week_of_year})

    if result["sample_count"] < 50:
        return None  # Insufficient data — skip
    await db.upsert_baseline(station_name, week_of_year, result)
```

---

## 6. Alert Delivery System

### 6.1 Deduplication

```python
async def should_send_alert(station_name, anomaly_type, severity) -> bool:
    key = f"alert:cooldown:{station_name}:{anomaly_type}"
    if await redis.get(key):
        return False
    cooldown = {"LOW": 14400, "MEDIUM": 7200, "HIGH": 3600, "CRITICAL": 1800}[severity]
    await redis.setex(key, cooldown, "1")
    return True
```

### 6.2 Delivery Chain

```python
async def deliver_alert(alert, subscriber):
    result = await send_whatsapp(subscriber.phone_hash, alert.whatsapp_message, alert.id)
    if not result.success:
        await send_sms(subscriber.phone_hash, alert.sms_message, alert.id)
```

### 6.3 Alert Fatigue Prevention

- Max 3 alerts per subscriber per 24 hours (CRITICAL overrides)
- Multiple rising stations in same basin consolidated into one message
- Weekly email digest for LOW/MEDIUM anomalies

### 6.4 Subscriber Preferences

```python
class SubscriberPreferences(BaseModel):
    phone: str                           # stored hashed
    email: str | None = None             # stored hashed
    basins: list[str]
    stations: list[str] = []
    min_severity: str = "HIGH"
    channels: list[str] = ["WHATSAPP", "SMS"]
    language: str = "en"                 # en | si
    active: bool = True
```

---

## 7. Storage Schema

```sql
-- Detected anomalies
CREATE TABLE anomaly_events (
    id                  BIGSERIAL PRIMARY KEY,
    station_name        TEXT        NOT NULL,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anomaly_type        TEXT        NOT NULL,
    severity            TEXT        NOT NULL,
    z_score             DECIMAL(8,4),
    current_level_m     DECIMAL(8,4),
    baseline_level_m    DECIMAL(8,4),
    current_rate        DECIMAL(8,4),
    baseline_rate       DECIMAL(8,4),
    rate_spike_ratio    DECIMAL(8,4),
    risk_score          INT,
    upstream_context    TEXT,
    explanation         TEXT,
    confidence          DECIMAL(4,3),
    resolved_at         TIMESTAMPTZ,
    false_positive      BOOLEAN     DEFAULT FALSE,
    run_id              TEXT        NOT NULL
);
CREATE INDEX idx_anomaly_station_time ON anomaly_events (station_name, detected_at DESC);
CREATE INDEX idx_anomaly_severity ON anomaly_events (severity, detected_at DESC)
    WHERE false_positive = FALSE;

-- Alert delivery log — no raw personal data ever stored
CREATE TABLE alert_history (
    id                  BIGSERIAL PRIMARY KEY,
    anomaly_event_id    BIGINT      REFERENCES anomaly_events(id),
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel             TEXT        NOT NULL,
    recipient_hash      TEXT        NOT NULL,   -- SHA256(phone + salt)
    status              TEXT        NOT NULL,
    provider_id         TEXT,
    error_message       TEXT,
    language            TEXT        DEFAULT 'en'
);

-- Per-station per-week baselines
CREATE TABLE station_baselines (
    station_name        TEXT        NOT NULL,
    week_of_year        INT         NOT NULL,
    avg_level_m         DECIMAL(8,4),
    stddev_level_m      DECIMAL(8,4),
    avg_rate_m_per_hr   DECIMAL(8,4),
    stddev_rate         DECIMAL(8,4),
    sample_count        INT,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (station_name, week_of_year)
);

-- Subscribers
CREATE TABLE subscribers (
    id                  BIGSERIAL PRIMARY KEY,
    phone_hash          TEXT        UNIQUE,
    email_hash          TEXT        UNIQUE,
    basins              TEXT[],
    stations            TEXT[],
    min_severity        TEXT        NOT NULL DEFAULT 'HIGH',
    channels            TEXT[]      NOT NULL DEFAULT '{WHATSAPP,SMS}',
    language            TEXT        NOT NULL DEFAULT 'en',
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_alert_at       TIMESTAMPTZ
);

-- Pipeline run log
CREATE TABLE pipeline_runs (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              TEXT        UNIQUE NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    duration_ms         INT,
    status              TEXT,
    routing_decision    TEXT,
    stations_checked    INT,
    anomalies_found     INT,
    alerts_sent         INT,
    error_message       TEXT
);
```

### Redis Keys

| Key | Value | TTL |
|---|---|---|
| `floodsense:run:active` | run_id | 10 min |
| `floodsense:run:last_summary` | JSON | No TTL |
| `alert:cooldown:{station}:{type}` | "1" | Severity-based |
| `floodsense:dashboard:current` | JSON | 35 min |
| `floodsense:anomalies:active` | JSON array | 35 min |

---

## 8. MCP Integration

```python
# src/floodsense_lk/mcp/client.py
from mcp import ClientSession
from mcp.client.sse import sse_client

class RiverMCPClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def call_tool(self, tool_name: str, **kwargs) -> dict:
        async with sse_client(f"{self.base_url}/sse") as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, kwargs)
                return result.content[0].text

async def safe_mcp_call(tool_name: str, **kwargs) -> dict | None:
    try:
        return await mcp_client.call_tool(tool_name, **kwargs)
    except Exception as e:
        logger.error(f"MCP call failed tool={tool_name} error={e}")
        return None  # Log and skip — never crash the pipeline
```

### MCP Tools Per Agent

| Agent | Tools Called |
|---|---|
| Monitor | `get_all_current_levels`, `get_rising_stations`, `get_alert_stations`, `get_kelani_corridor`, `get_all_basins_summary` |
| Anomaly | `get_station_history`, `get_historical_comparison`, `get_flood_risk_score` |
| Risk Scorer | None |
| Alert Agent | None |
| Report Agent | `get_system_status` |

---

## 9. API Layer

```
POST   /api/v1/subscribe
DELETE /api/v1/unsubscribe
GET    /api/v1/alerts          ?basin=&severity=&limit=
GET    /api/v1/status
GET    /api/v1/stations
GET    /api/v1/baselines/{station_name}
POST   /api/v1/admin/run           (X-Admin-Key required)
POST   /api/v1/admin/false-positive/{anomaly_id}
GET    /health
GET    /ready
```

Security: 30 req/min rate limit per IP, SMS OTP verification before subscribing, admin key for admin routes, phone/email always SHA256 hashed, no personal data in logs.

---

## 10. Dashboard

FastAPI + Jinja2 templates. No separate frontend framework.

- **Home** — Sri Lanka map with 40 stations colour-coded by alert level, active anomaly banners
- **Alerts** — Recent anomaly events, filterable by basin/severity/date
- **Station Detail** — 48-hour water level chart, current vs baseline comparison
- **System Health** — Pipeline run history, MCP status, stale station flags

Chart.js for charts, Leaflet.js for map, auto-refresh every 5 min.

---

## 11. Project Structure

```
floodsense-lk/
├── SYSTEM_DESIGN.md
├── README.md
├── CLAUDE.md
├── .env.local                           # never committed
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
│
├── src/
│   └── floodsense_lk/
│       ├── __init__.py
│       ├── main.py                      # FastAPI + APScheduler startup
│       │
│       ├── agents/
│       │   ├── graph.py                 # LangGraph graph + routing
│       │   ├── state.py                 # FloodSenseState TypedDict
│       │   ├── supervisor.py
│       │   ├── monitor.py
│       │   ├── anomaly.py
│       │   ├── risk_scorer.py
│       │   ├── alert_agent.py
│       │   └── report_agent.py
│       │
│       ├── services/
│       │   ├── anomaly_service.py
│       │   ├── alert_service.py
│       │   ├── baseline_service.py
│       │   ├── subscriber_service.py
│       │   └── scheduler_service.py
│       │
│       ├── mcp/
│       │   └── client.py
│       │
│       ├── api/
│       │   ├── routes/
│       │   │   ├── subscribe.py
│       │   │   ├── alerts.py
│       │   │   ├── status.py
│       │   │   └── admin.py
│       │   └── middleware.py
│       │
│       ├── db/
│       │   ├── timescale.py
│       │   ├── redis_client.py
│       │   └── migrations/
│       │       ├── 001_anomaly_events.sql
│       │       ├── 002_alert_history.sql
│       │       ├── 003_station_baselines.sql
│       │       ├── 004_subscribers.sql
│       │       └── 005_pipeline_runs.sql
│       │
│       ├── models/
│       │   ├── anomaly.py
│       │   ├── alert.py
│       │   ├── subscriber.py
│       │   └── pipeline.py
│       │
│       ├── templates/
│       │   ├── base.html
│       │   ├── dashboard.html
│       │   ├── alerts.html
│       │   └── station.html
│       │
│       ├── static/
│       │
│       └── core/
│           ├── logging.py
│           ├── exceptions.py
│           └── security.py
│
└── tests/
    ├── conftest.py
    ├── test_agents/
    ├── test_services/
    └── fixtures/
```

---

## 12. Docker Compose Setup

```yaml
version: "3.9"

services:

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    container_name: floodsense_timescaledb
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./src/floodsense_lk/db/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5433:5432"          # 5433 avoids conflict with MCP server DB on 5432
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: floodsense_redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6380:6379"          # 6380 avoids conflict with MCP server Redis on 6379
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  floodsense:
    build: .
    container_name: floodsense_app
    ports:
      - "8002:8002"
    environment:
      - POSTGRES_DSN=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@timescaledb:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
      - MCP_SERVER_URL=${MCP_SERVER_URL:-http://host.docker.internal:8001}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash-preview-04-17}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - ALERT_SALT=${ALERT_SALT}
      - ADMIN_API_KEY=${ADMIN_API_KEY}
      - PIPELINE_INTERVAL_SECONDS=${PIPELINE_INTERVAL_SECONDS:-1800}
      - ENABLE_WHATSAPP_ALERTS=${ENABLE_WHATSAPP_ALERTS:-false}
      - ENABLE_SMS_ALERTS=${ENABLE_SMS_ALERTS:-false}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    depends_on:
      timescaledb:
        condition: service_healthy
      redis:
        condition: service_healthy
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  timescale_data:
  redis_data:
```

---

## 13. Environment Configuration

```bash
# .env.example — safe to commit
# Copy to .env.local, fill values — never commit .env.local

POSTGRES_DB=floodsense_lk
POSTGRES_USER=floodsense_user
POSTGRES_PASSWORD=changeme_in_local

REDIS_URL=redis://localhost:6380

MCP_SERVER_URL=http://localhost:8001

# LLM — single model for all agents
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-preview-04-17

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

ALERT_SALT=random_32_char_string        # never commit actual value
ADMIN_API_KEY=random_32_char_key        # never commit actual value

PIPELINE_INTERVAL_SECONDS=1800
BASELINE_RECOMPUTE_DAY=sunday

# Disable all alert delivery locally — avoid sending real messages during dev
ENABLE_WHATSAPP_ALERTS=false
ENABLE_SMS_ALERTS=false
ENABLE_EMAIL_ALERTS=false

LOG_LEVEL=DEBUG
```

---

## 14. Implementation Plan

| Phase | Duration | Deliverables | Skills Practiced |
|---|---|---|---|
| Phase 1 — Foundation | 3 days | TimescaleDB schema, baseline computation script, MCP SSE client, Docker Compose, LangGraph skeleton with stub agents | TimescaleDB, MCP SSE transport, LangGraph wiring |
| Phase 2 — Monitor + Anomaly | 4 days | Monitor Agent, Anomaly Agent, Z-score + rate spike + propagation detection | LangGraph state, Gemini 2.5 Flash structured output, time-series analysis |
| Phase 3 — Risk + Alert | 3 days | Risk Scorer, Alert Agent, WhatsApp delivery, cooldown deduplication | Gemini prompting, Twilio, Redis dedup patterns |
| Phase 4 — API + Dashboard | 3 days | FastAPI routes, subscriber management, Jinja2 dashboard, Leaflet map | FastAPI, Jinja2, Leaflet.js, Chart.js |
| Phase 5 — Testing + Hardening | 3 days | Unit tests for all agents and services, end-to-end test with injected anomaly, runbook | pytest-asyncio, LangGraph testing, chaos testing |
| **Total** | **~16 days** | Full autonomous flood warning system | LangGraph, Gemini 2.5 Flash, anomaly detection, alert delivery |

### 14.1 Phase 1 Detailed Tasks

```
Day 1
  ├── Repo setup, Docker Compose, .env.example, CLAUDE.md
  ├── Write all 5 migration SQL files
  └── Verify DB starts and migrations run cleanly

Day 2
  ├── Write MCP SSE client wrapper
  ├── Test all 12 MCP tool calls work from FloodSense
  └── Write and run baseline computation script
      — verify 40 stations x 52 weeks of baselines populated

Day 3
  ├── Write FloodSenseState TypedDict
  ├── Write LangGraph graph skeleton — all nodes wired, stub agents return mock data
  ├── Write APScheduler setup
  └── Verify full pipeline runs end to end with stubs
```

---

## 15. Local Development Guide

### 15.1 Start MCP Server in SSE Mode First

```bash
# In mcp-lk-river-intel directory
MCP_TRANSPORT=sse docker compose up
curl http://localhost:8001/health   # verify
```

### 15.2 Start FloodSense

```bash
cd floodsense-lk
cp .env.example .env.local
# Fill in GEMINI_API_KEY — minimum required
# All ENABLE_*_ALERTS stay false locally

docker compose up --build

# Expected:
# [INFO] TimescaleDB connected
# [INFO] Redis connected
# [INFO] MCP server reachable at http://host.docker.internal:8001
# [INFO] Baselines computed: 40 stations x 52 weeks
# [INFO] Scheduler started — pipeline every 30 min
# [INFO] Dashboard: http://localhost:8002
```

### 15.3 Trigger Manual Run

```bash
curl -X POST http://localhost:8002/api/v1/admin/run \
  -H "X-Admin-Key: your_admin_key"
```

### 15.4 Watch Agent Reasoning

```bash
docker compose logs floodsense --follow
# LOG_LEVEL=DEBUG shows each agent's prompt, response, and routing decision
```

---

## 16. Production Considerations

### Pipeline Overlap Prevention

```python
async def run_pipeline(run_id: str):
    acquired = await redis.set(
        "floodsense:run:active", run_id,
        nx=True, ex=600   # auto-expire after 10 min — prevents deadlock on crash
    )
    if not acquired:
        logger.warning("Pipeline already running — skipping cycle")
        return
    try:
        await execute_pipeline(run_id)
    finally:
        await redis.delete("floodsense:run:active")
```

### Baseline Quality Edge Cases

- Stations with < 1 year history → use regional basin average as proxy
- Stations with data gaps → flag baseline as `LOW_CONFIDENCE`, apply wider Z-score threshold
- Climate shift → weight recent 2 years more heavily using exponential decay

### Secure Logging

```python
# Never log
logger.info(f"Alert sent to {phone}")             # raw phone — WRONG
logger.info(f"Subscriber {id} unsubscribed")       # identity — WRONG

# Always log
logger.info(f"Alert delivered channel=WHATSAPP alert_id={alert_id} status=SENT")
logger.info(f"Unsubscribe processed")              # no personal data
```

### Retention

```sql
SELECT add_retention_policy('anomaly_events', INTERVAL '2 years');
-- station_baselines kept indefinitely — small, high value
```

---

## Appendix A — Sri Lanka Seasonal Calendar

| Season | Months | High-Risk Basins | Intensity |
|---|---|---|---|
| Northeast Monsoon | October — January | Mahaweli, Kirindi, Malwathu | ELEVATED |
| Inter-monsoon | February — March | All | STANDARD |
| Southwest Monsoon | May — September | Kelani, Kalu, Nilwala, Gin | ELEVATED |
| Inter-monsoon | April | All | STANDARD |

---

## Appendix B — Dependencies

```
# requirements.txt
langgraph>=0.2.0
langchain-google-genai>=2.0       # Gemini 2.5 Flash
fastapi>=0.111.0
uvicorn>=0.30.0
apscheduler>=3.10.0
asyncpg>=0.29.0
redis[asyncio]>=5.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
httpx>=0.27.0
mcp>=1.0.0
twilio>=9.0.0
jinja2>=3.1.0
structlog>=24.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

---
 For your custom agent system — SSE mode

  In your agent project's .env (or however you configure it):
  MCP_TRANSPORT=sse
  MCP_SSE_PORT=8765

  Start the stack:
  docker compose up --build

  Connect your agent to:
  http://localhost:8765/sse

  For example with the MCP Python SDK:
  from mcp import ClientSession
  from mcp.client.sse import sse_client

  async with sse_client("http://localhost:8765/sse") as (read, write):
      async with ClientSession(read, write) as session:
          await session.initialize()
          result = await session.call_tool("get_flood_risk_score", {"station_name": "Hanwella"})

          
*FloodSense LK — Agentic Flood Early Warning System*
*Built on mcp-lk-river-intel | Model: Gemini 2.5 Flash*
*v1.0.0 — March 2026*
