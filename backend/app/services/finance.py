"""Adapter between the DB and the hand-written stateless intelligence engine.

Rules (match src/lib/finance.ts):
  * only CREATOR-funded costs reach the engine - client-funded costs never touch exposure or margin;
  * money is integer kobo inside, integer naira at the API boundary;
  * all dates are Africa/Lagos calendar dates.
The engine itself (backend/intelligence/*) is not modified by this module."""
from datetime import date, timedelta

from app import models
from intelligence import money
from intelligence.dates import today_lagos
from intelligence.financial_engine import FinancialEngine
from intelligence.interfaces import CostDTO, ProjectDTO

CHECKPOINTS = (0, 3, 7, 14, 30)


def naira(kobo: int) -> int:
    return money.kobo_to_naira(kobo)


def creator_costs(project: models.Project) -> list[models.Cost]:
    return [c for c in project.costs if c.funded_by != "client"]


def to_dto(project: models.Project) -> ProjectDTO:
    return ProjectDTO(
        id=project.id,
        revenue=naira(project.revenue_kobo),
        deposit_pct=project.deposit_pct,
        costs=[CostDTO(c.id, c.category, naira(c.amount_kobo), "creator", c.paid_on_day) for c in creator_costs(project)],
    )


def deposit_kobo(project: models.Project) -> int:
    return (project.revenue_kobo * money.points_for_percentage(project.deposit_pct)) // 10000


def _events(project: models.Project):
    """(day, signed_kobo) with same-day inflows first, as in finance.ts CashEvent."""
    dep = deposit_kobo(project)
    ev = [(0, 0, dep), (project.expected_payment_days, 0, project.revenue_kobo - dep)]
    ev += [(c.paid_on_day, 1, -c.amount_kobo) for c in creator_costs(project)]
    return sorted(ev, key=lambda e: (e[0], e[1]))


def projection(project: models.Project, opening_kobo: int = 0) -> list[dict]:
    points = []
    for off in CHECKPOINTS:
        cum, inflow, outflow = opening_kobo, 0, 0
        for day, _, amt in _events(project):
            if day > off:
                continue
            cum += amt
            if amt >= 0:
                inflow += amt
            else:
                outflow += -amt
        d = project.start_date + timedelta(days=off)
        points.append({"label": "Today" if off == 0 else f"+{off} days", "date": d.isoformat(),
                       "projectedBalance": naira(cum), "inflow": naira(inflow), "outflow": naira(outflow)})
    return points


def days_to_cash(project: models.Project) -> dict:
    verified = sorted((p for p in project.payments if p.status == "verified"), key=lambda p: p.verified_at)
    if not verified:
        return {"status": "planned", "days": project.expected_payment_days}
    funded = creator_costs(project)
    first_cost_day = min((c.paid_on_day for c in funded), default=0)
    cum = 0
    for p in verified:
        cum += p.amount_kobo
        if cum >= project.revenue_kobo:
            day = (p.verified_at.date() - project.start_date).days
            return {"status": "complete", "days": day - first_cost_day}
    return {"status": "pending", "daysSoFar": max(0, (today_lagos() - project.start_date).days - first_cost_day)}


def snapshot(project: models.Project) -> dict:
    dto = to_dto(project)
    timeline = FinancialEngine.build_timeline(dto, project.expected_payment_days)
    risk = FinancialEngine.calculate_risk_metrics(timeline)
    profit_kobo, margin_bp = FinancialEngine.calculate_profit(dto)
    cash_flow = projection(project)
    gap = next((p["date"] for p in cash_flow if p["projectedBalance"] < 0), None)
    return {
        "depositAmount": naira(deposit_kobo(project)),
        "upfrontExposure": risk["upfront_exposure"],
        "cashGap": risk["cash_gap_amount"],
        "expectedProfit": naira(profit_kobo),
        "profitMarginPct": margin_bp / 100,
        "daysToCash": days_to_cash(project),
        "cashFlow": cash_flow,
        "gapDate": gap,
    }


def received_kobo(project: models.Project) -> int:
    return sum(p.amount_kobo for p in project.payments if p.status == "verified")


def public_status(project: models.Project) -> str:
    """Contract enum: active | awaiting_payment | completed."""
    if project.stage in ("released", "closed"):
        return "completed"
    if project.stage in ("approved", "in_review") or (project.stage == "agreed" and project.deposit_pct > 0):
        return "awaiting_payment"
    return "active"
