"""Deterministic financial calculations shared by the backend services."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from intelligence.currency import CurrencyMismatchError, from_minor_unit, to_minor_unit
from intelligence.interfaces import CostDTO, ProjectDTO, VerifiedPaymentEvent


def _currency(costs: list[CostDTO], currency: str) -> str:
    expected = currency.upper()
    currencies = {cost.currency.upper() for cost in costs}
    if currencies - {expected}:
        raise CurrencyMismatchError(
            f"Cost currency {sorted(currencies - {expected})[0]} does not match {expected}"
        )
    return expected


def _amount(value: int | float, currency: str) -> int:
    return to_minor_unit(value, currency)


def _creator_costs(costs: list[CostDTO]) -> list[CostDTO]:
    return [cost for cost in costs if cost.funded_by != "client"]


def sum_costs(costs: list[CostDTO], currency: str = "NGN") -> int | float:
    _currency(costs, currency)
    return from_minor_unit(sum(_amount(cost.amount, currency) for cost in costs), currency)


def sum_creator_funded_costs(costs: list[CostDTO], currency: str = "NGN") -> int | float:
    return sum_costs(_creator_costs(costs), currency)


def calculate_deposit_amount(
    revenue: int | float, deposit_pct: int | float, currency: str = "NGN"
) -> int | float:
    revenue_minor = _amount(revenue, currency)
    deposit_minor = (revenue_minor * deposit_pct + 50) // 100
    return from_minor_unit(deposit_minor, currency)


def _events(
    costs: list[CostDTO],
    revenue: int | float,
    deposit_pct: int | float,
    expected_payment_days: int,
    currency: str,
) -> list[tuple[int, int, int]]:
    """Return (day, ordering, signed minor units); inflows clear first."""
    revenue_minor = _amount(revenue, currency)
    deposit_minor = _amount(calculate_deposit_amount(revenue, deposit_pct, currency), currency)
    events = [(0, 0, deposit_minor), (expected_payment_days, 0, revenue_minor - deposit_minor)]
    events.extend(
        (cost.paid_on_day, 1, -_amount(cost.amount, currency))
        for cost in _creator_costs(costs)
    )
    return sorted(events, key=lambda event: (event[0], event[1]))


def _deepest_balance(events: list[tuple[int, int, int]], opening_minor: int = 0) -> int:
    balance = opening_minor
    deepest = balance
    for _, _, amount in events:
        balance += amount
        deepest = min(deepest, balance)
    return deepest


def calculate_upfront_exposure(
    costs: list[CostDTO],
    revenue: int | float,
    deposit_pct: int | float,
    expected_payment_days: int,
    currency: str = "NGN",
) -> int | float:
    events = _events(costs, revenue, deposit_pct, expected_payment_days, currency)
    return from_minor_unit(max(0, -_deepest_balance(events)), currency)


def calculate_expected_profit(
    costs: list[CostDTO], revenue: int | float, currency: str = "NGN"
) -> int | float:
    revenue_minor = _amount(revenue, currency)
    costs_minor = _amount(sum_creator_funded_costs(costs, currency), currency)
    return from_minor_unit(revenue_minor - costs_minor, currency)


def calculate_profit_margin(
    costs: list[CostDTO], revenue: int | float, currency: str = "NGN"
) -> float:
    revenue_minor = _amount(revenue, currency)
    if revenue_minor == 0:
        return 0.0
    profit_minor = _amount(calculate_expected_profit(costs, revenue, currency), currency)
    return profit_minor * 100 / revenue_minor


def calculate_days_to_cash(expected_payment_days: int) -> dict[str, Any]:
    return {"status": "planned", "days": expected_payment_days}


def calculate_realised_days_to_cash(
    costs: list[CostDTO],
    revenue: int | float,
    verified_payments: list[VerifiedPaymentEvent | dict[str, int | float]],
    today: int,
    currency: str = "NGN",
) -> dict[str, Any]:
    first_cost_day = min((cost.paid_on_day for cost in _creator_costs(costs)), default=0)
    revenue_minor = _amount(revenue, currency)
    cumulative = 0
    for payment in sorted(verified_payments, key=lambda item: item["day"] if isinstance(item, dict) else item.day):
        day = payment["day"] if isinstance(payment, dict) else payment.day
        amount = payment["amount"] if isinstance(payment, dict) else payment.amount
        cumulative += _amount(amount, currency)
        if cumulative >= revenue_minor:
            return {"status": "complete", "days": day - first_cost_day}
    return {"status": "pending", "daysSoFar": max(0, today - first_cost_day)}


def calculate_cash_gap(
    costs: list[CostDTO],
    revenue: int | float,
    deposit_pct: int | float,
    expected_payment_days: int,
    current_cash: int | float,
    currency: str = "NGN",
) -> int | float:
    opening = _amount(current_cash, currency)
    deepest = _deepest_balance(
        _events(costs, revenue, deposit_pct, expected_payment_days, currency), opening
    )
    return from_minor_unit(max(0, -deepest), currency)


def calculate_deposit_impact(
    costs: list[CostDTO],
    revenue: int | float,
    deposit_pct: int | float,
    expected_payment_days: int,
    current_cash: int | float = 0,
    currency: str = "NGN",
) -> dict[str, Any]:
    deposit = calculate_deposit_amount(revenue, deposit_pct, currency)
    total_costs = sum_creator_funded_costs(costs, currency)
    return {
        "depositPct": deposit_pct,
        "depositAmount": deposit,
        "upfrontExposure": calculate_upfront_exposure(costs, revenue, deposit_pct, expected_payment_days, currency),
        "cashGap": calculate_cash_gap(costs, revenue, deposit_pct, expected_payment_days, current_cash, currency),
        "coversFullCosts": _amount(deposit, currency) >= _amount(total_costs, currency),
    }


def recommend_minimum_safe_deposit(
    costs: list[CostDTO], revenue: int | float, currency: str = "NGN"
) -> int | None:
    if _amount(revenue, currency) <= 0:
        return None
    total_costs = _amount(sum_creator_funded_costs(costs, currency), currency)
    for percentage in range(0, 101, 5):
        if _amount(calculate_deposit_amount(revenue, percentage, currency), currency) >= total_costs:
            return percentage
    return None


def build_cash_flow_projection(
    costs: list[CostDTO],
    revenue: int | float,
    deposit_pct: int | float,
    expected_payment_days: int,
    current_cash: int | float,
    currency: str = "NGN",
    today: date | None = None,
) -> list[dict[str, Any]]:
    current = today or date.today()
    points = []
    for offset in (0, 3, 7, 14, 30):
        balance = _amount(current_cash, currency)
        inflow = outflow = 0
        for day, _, amount in _events(costs, revenue, deposit_pct, expected_payment_days, currency):
            if day > offset:
                continue
            balance += amount
            if amount >= 0:
                inflow += amount
            else:
                outflow -= amount
        points.append({
            "label": "Today" if offset == 0 else f"+{offset} days",
            "date": (current + timedelta(days=offset)).isoformat(),
            "projectedBalance": from_minor_unit(balance, currency),
            "inflow": from_minor_unit(inflow, currency),
            "outflow": from_minor_unit(outflow, currency),
        })
    return points


def find_first_cash_gap_date(points: list[dict[str, Any]]) -> str | None:
    return next((point["date"] for point in points if point["projectedBalance"] < 0), None)


class FinancialEngine:
    @staticmethod
    def calculate_profit(project: ProjectDTO) -> tuple[int, int]:
        currency = project.currency
        profit_minor = _amount(project.revenue, currency) - _amount(
            sum_creator_funded_costs(project.costs, currency), currency
        )
        revenue_minor = _amount(project.revenue, currency)
        margin_bp = 0 if revenue_minor == 0 else (profit_minor * 10000) // revenue_minor
        return profit_minor, margin_bp

    @staticmethod
    def build_timeline(project: ProjectDTO, expected_payment_day: int) -> list[dict[str, Any]]:
        timeline = []
        balance = 0
        for day, _, amount in _events(
            project.costs, project.revenue, project.deposit_pct, expected_payment_day, project.currency
        ):
            balance += amount
            timeline.append({
                "day": day,
                "balance": from_minor_unit(balance, project.currency),
                "inflow": from_minor_unit(max(amount, 0), project.currency),
                "outflow": from_minor_unit(max(-amount, 0), project.currency),
            })
        return timeline

    @staticmethod
    def calculate_risk_metrics(timeline: list[dict[str, Any]]) -> dict[str, Any]:
        minimum = min((point["balance"] for point in timeline), default=0)
        gap = next((point["day"] for point in timeline if point["balance"] < 0), None)
        exposure = max(0, -minimum)
        return {
            "upfront_exposure": exposure,
            "has_cash_gap": gap is not None,
            "cash_gap_day": gap,
            "cash_gap_amount": exposure,
        }
