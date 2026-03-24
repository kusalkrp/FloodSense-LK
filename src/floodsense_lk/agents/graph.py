"""LangGraph pipeline graph — FloodSense LK.

Graph structure:
  START → supervisor → monitor → [anomaly → risk_scorer] → report_agent → END

Conditional routing:
  after_monitor: skip anomaly/risk on calm days (no rising/alert stations)
"""

import structlog

from langgraph.graph import END, START, StateGraph

from floodsense_lk.agents.state import FloodSenseState
from floodsense_lk.agents.supervisor import supervisor_node as _supervisor_node
from floodsense_lk.agents.monitor import monitor_node as _monitor_node
from floodsense_lk.agents.anomaly import anomaly_node as _anomaly_node
from floodsense_lk.agents.risk_scorer import risk_scorer_node as _risk_scorer_node
from floodsense_lk.agents.report_agent import report_agent_node as _report_agent_node

logger = structlog.get_logger(__name__)


# ── Conditional routing ────────────────────────────────────────────────────────


def after_monitor_router(state: FloodSenseState) -> str:
    if not state["rising_stations"] and not state["alert_stations"]:
        logger.info("calm_day_fast_path", run_id=state["run_id"])
        return "report_only"
    return "run_anomaly"


# ── Graph assembly ─────────────────────────────────────────────────────────────


def build_graph() -> StateGraph:
    graph = StateGraph(FloodSenseState)

    graph.add_node("supervisor", _supervisor_node)
    graph.add_node("monitor", _monitor_node)
    graph.add_node("anomaly", _anomaly_node)
    graph.add_node("risk_scorer", _risk_scorer_node)
    graph.add_node("report_agent", _report_agent_node)

    graph.add_edge(START, "supervisor")
    graph.add_edge("supervisor", "monitor")

    graph.add_conditional_edges(
        "monitor",
        after_monitor_router,
        {"run_anomaly": "anomaly", "report_only": "report_agent"},
    )

    graph.add_edge("anomaly", "risk_scorer")
    graph.add_edge("risk_scorer", "report_agent")
    graph.add_edge("report_agent", END)

    return graph


# Compiled graph — import this in scheduler_service.py
compiled_graph = build_graph().compile()
