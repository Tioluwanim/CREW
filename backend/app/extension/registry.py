from datetime import timedelta
from typing import Any

from app.config import get_settings
from app.extension.interfaces import AgentRuntime, CashflowForecaster


class BaselineForecaster:
    """Deterministic: replays the engine's known inflows/outflows. Not a learned model."""
    name = "baseline-deterministic"

    def forecast(self, history: list[dict[str, Any]], horizon_days: int, context: dict[str, Any]) -> dict[str, Any]:
        points = context.get("points", [])
        return {"model": self.name, "learned": False, "horizonDays": horizon_days, "points": points, "historyRows": len(history)}


class NullAgent:
    """Grounded, template-only replies from engine numbers. Replace with the real agent."""
    name = "null"

    def chat(self, user_id: str, message: str, project_id: str | None, grounding: dict[str, Any]) -> dict[str, Any]:
        m = message.lower()
        g = grounding
        if not g:
            text = "Open a project and I can answer with its numbers."
        elif "gap" in m or "short" in m:
            text = f"Upfront exposure is ₦{g['upfrontExposure']:,}." + (f" Cash first dips below zero around {g['gapDate']}." if g["gapDate"] else " No cash gap on the current plan.")
        elif "profit" in m or "margin" in m:
            text = f"Expected profit is ₦{g['expectedProfit']:,} ({g['profitMarginPct']}% margin)."
        elif "paid" in m or "when" in m:
            text = f"Expected client payment window: {g.get('paymentWindow', {}).get('expected', 'not enough data')}."
        elif "deposit" in m:
            recs = [r for r in g.get("recommendations", []) if r["type"] == "INCREASE_DEPOSIT"]
            text = recs[0]["message"] if recs else f"Your {g['depositPct']}% deposit already covers the gap."
        else:
            text = "I can answer questions about cash gap, profit, deposit and payment timing."
        return {"text": text, "actions": [], "agent": self.name, "grounded": bool(g)}

    def act_for_client_link(self, project_id: str) -> dict[str, Any]:
        return {"status": "not_implemented", "agent": self.name}


_forecasters: dict[str, CashflowForecaster] = {"baseline": BaselineForecaster()}
_agents: dict[str, AgentRuntime] = {"null": NullAgent()}


def register_forecaster(key: str, impl: CashflowForecaster) -> None:
    _forecasters[key] = impl


def register_agent(key: str, impl: AgentRuntime) -> None:
    _agents[key] = impl


def get_forecaster() -> CashflowForecaster:
    return _forecasters.get(get_settings().forecaster, _forecasters["baseline"])


def get_agent() -> AgentRuntime:
    return _agents.get(get_settings().agent, _agents["null"])
