"""Cash-flow forecaster driven by learned payment timing.

What is learned: how late this creator's clients pay (see services/dl.estimate_payment_delay: a GRU when one has
been trained and beats its baseline, otherwise the creator's own history shrunk toward a craft prior).
What is not: amounts. Money still comes from the deterministic engine; this layer only moves *when* the final
balance lands and reports the spread.

Bands are timing scenarios, not statistical confidence intervals:
  high  clients pay on the agreed date
  mid   clients pay `expectedDays` late (the estimate)
  low   clients pay max(1.5x the estimate, estimate + 5) days late
`learned` is True only when a trained model produced the delay; otherwise the response says where it came from.
"""
from __future__ import annotations

from typing import Any

from app.extension.registry_baseline import BaselineForecaster


class LearnedForecaster:
    name = "learned-payment-timing"

    def __init__(self) -> None:
        self._baseline = BaselineForecaster()

    def forecast(self, history: list[dict[str, Any]], horizon_days: int, context: dict[str, Any]) -> dict[str, Any]:
        scenarios = context.get("scenarios")
        delay = context.get("delay")
        if not scenarios or not delay:  # not enough context to model timing: say so, return the deterministic path
            return self._baseline.forecast(history, horizon_days, context)
        points = []
        for mid, fast, slow in zip(scenarios["expected"], scenarios["optimistic"], scenarios["pessimistic"], strict=True):
            points.append({**mid, "low": min(slow["projectedBalance"], mid["projectedBalance"]),
                           "high": max(fast["projectedBalance"], mid["projectedBalance"])})
        return {
            "model": self.name,
            "learned": bool(delay.get("learned")),
            "horizonDays": horizon_days,
            "points": points,
            "historyRows": len(history),
            "delay": delay,
            "bandMethod": "timing-scenarios",
        }


def scenario_delays(expected_days: float) -> dict[str, int]:
    d = max(0, round(expected_days))
    return {"optimisticDays": 0, "expectedDays": d, "pessimisticDays": max(round(d * 1.5), d + 5)}
