"""Deterministic baseline forecaster (kept separate so other forecasters can wrap it)."""
from typing import Any


class BaselineForecaster:
    """Deterministic: replays the engine's known inflows/outflows. Not a learned model."""
    name = "baseline-deterministic"

    def forecast(self, history: list[dict[str, Any]], horizon_days: int, context: dict[str, Any]) -> dict[str, Any]:
        points = context.get("points", [])
        return {"model": self.name, "learned": False, "horizonDays": horizon_days, "points": points, "historyRows": len(history)}
