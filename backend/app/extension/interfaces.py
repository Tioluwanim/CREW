"""EXTENSION POINTS for the agent + deep-learning work (owned by Antigravity).

Nothing here is ML. The backend ships deterministic baselines behind these Protocols so the
API contract is stable; register a real implementation and set FORECASTER / AGENT_RUNTIME.

Data pipeline the DL side should read from:
    payments / costs  ->  DB  ->  `transactions` (normalized, kobo, Lagos dates)  ->  GET /api/data/normalized
"""
from typing import Any, Protocol


class CashflowForecaster(Protocol):
    name: str

    def forecast(self, history: list[dict[str, Any]], horizon_days: int, context: dict[str, Any]) -> dict[str, Any]:
        """history = normalized transaction rows. Return {"model", "points": [{"day","balance","low","high"}], ...}."""


class AgentTool(Protocol):
    name: str
    description: str
    mutates: bool  # mutating tools must require explicit user confirmation upstream


class AgentRuntime(Protocol):
    name: str

    def chat(self, user_id: str, message: str, project_id: str | None, grounding: dict[str, Any]) -> dict[str, Any]:
        """Return {"text": str, "actions": [...], "agent": name}. `grounding` holds engine-computed facts only."""

    def act_for_client_link(self, project_id: str) -> dict[str, Any]:
        """Hook for the execution agent that keeps the shareable client link up to date (reminders, summaries)."""
