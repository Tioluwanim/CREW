"""Wires DB history into the hand-written intelligence layer (backend/intelligence).
The deterministic engines are the source of truth; nothing here uses ML."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.services import finance
from intelligence.dates import today_lagos
from intelligence.financial_engine import FinancialEngine
from intelligence.forecast import ForecastEngine
from intelligence.genome import GenomeEngine
from intelligence.priors import PriorResolver
from intelligence.recommendation import RecommendationEngine
from intelligence.simulation import SimulationEngine
from intelligence.deposit_analysis import DepositAnalysisEngine, DepositConstraintConfig
from intelligence.stats import bayesian_shrinkage
from intelligence.cost_buffer import BufferEngine
from intelligence.interfaces import CostDTO

import dataclasses
from datetime import timedelta


def payment_delay_days(project: models.Project) -> int | None:
    """Days the client took past the expected payment date to fully pay; None if not fully paid."""
    verified = sorted((p for p in project.payments if p.status == "verified"), key=lambda p: p.verified_at)
    cum = 0
    for p in verified:
        cum += p.amount_kobo
        if cum >= project.revenue_kobo:
            due = project.start_date + timedelta(days=project.expected_payment_days)
            return max(0, (p.verified_at.date() - due).days)
    return None


def _history(db: Session, owner_id: str, client_id: str | None = None):
    q = select(models.Project).where(models.Project.owner_id == owner_id, models.Project.stage.in_(["released", "closed"]))
    projs = db.scalars(q).all()
    margins, delays, client_delays = [], [], []
    for p in projs:
        _, m = FinancialEngine.calculate_profit(finance.to_dto(p))
        margins.append(m)
        d = payment_delay_days(p)
        if d is not None:
            delays.append(d)
            if client_id and p.client_id == client_id:
                client_delays.append(d)
    return margins, delays, client_delays


def material_overrun_pct(db: Session, owner_id: str) -> float:
    """Mean % by which material costs exceeded their original estimate, across the owner's projects (0 if no data)."""
    costs = db.scalars(select(models.Cost).join(models.Project).where(
        models.Project.owner_id == owner_id, models.Cost.category == "materials",
        models.Cost.estimated_amount_kobo.is_not(None), models.Cost.estimated_amount_kobo > 0)).all()
    if not costs:
        return 0.0
    return round(sum((c.amount_kobo - c.estimated_amount_kobo) * 100 / c.estimated_amount_kobo for c in costs) / len(costs), 1)


def project_intelligence(db: Session, p: models.Project) -> dict:
    dto = finance.to_dto(p)
    timeline = FinancialEngine.build_timeline(dto, p.expected_payment_days)
    risk = FinancialEngine.calculate_risk_metrics(timeline)
    profit_kobo, margin_bp = FinancialEngine.calculate_profit(dto)
    margins, delays, client_delays = _history(db, p.owner_id, p.client_id)
    profile = db.scalars(select(models.CreativeProfile).where(models.CreativeProfile.user_id == p.owner_id)).first()
    prior = PriorResolver.get_creator_baseline_delay(delays, (profile.craft if profile else "") or "")
    predicted = bayesian_shrinkage(client_delays, prior)
    due = p.start_date + timedelta(days=p.expected_payment_days)
    windows = ForecastEngine.predict_completion_timeline(due, predicted)
    recs = []
    dep = RecommendationEngine.evaluate_deposit(dto, risk["upfront_exposure"])
    if dep:
        recs.append(dep)
    overrun = max(material_overrun_pct(db, p.owner_id), 0.0) or 10.0  # fall back to a 10% prior until history exists
    mr = RecommendationEngine.evaluate_margin(margin_bp, overrun)
    if mr:
        recs.append(mr)
    return {
        "projectId": p.id,
        "currency": p.currency,
        "profit": {"profit": finance.naira(profit_kobo, p.currency), "marginBp": margin_bp},
        "risk": {"hasCashGap": risk["has_cash_gap"], "cashGapDay": risk["cash_gap_day"], "upfrontExposure": risk["upfront_exposure"]},
        "resilienceScore": SimulationEngine.stress_test_project(dto, p.expected_payment_days),
        "contingencyBuffer": finance.naira(BufferEngine.calculate_dynamic_contingency(dto.costs, p.currency), p.currency),
        "predictedClientDelayDays": round(predicted, 1),
        "paymentWindow": {k: v.isoformat() for k, v in windows.items()},
        "recommendations": [dataclasses.asdict(r) for r in recs],
        "engine": "deterministic-v1",
    }


def forecast_report(db: Session, p: models.Project, horizon_days: int = 30) -> dict:
    """Return an auditable, currency-scoped deterministic forecast."""
    margins, delays, client_delays = _history(db, p.owner_id, p.client_id)
    profile = db.scalars(
        select(models.CreativeProfile).where(models.CreativeProfile.user_id == p.owner_id)
    ).first()
    prior = PriorResolver.get_creator_baseline_delay(delays, (profile.craft if profile else "") or "")
    predicted = bayesian_shrinkage(client_delays, prior)
    due = p.start_date + timedelta(days=p.expected_payment_days)
    windows = ForecastEngine.predict_completion_timeline(due, predicted)
    points = finance.projection(p)
    return {
        "projectId": p.id,
        "currency": p.currency,
        "p20": windows["optimistic"].isoformat(),
        "p50": windows["expected"].isoformat(),
        "p80": windows["pessimistic"].isoformat(),
        "projectedCashCurve": points,
        "projectedCashGap": max((max(0, -point["projectedBalance"]) for point in points), default=0),
        "assumptions": {"expectedPaymentDays": p.expected_payment_days, "horizonDays": horizon_days},
        "evidence": {"completedProjects": len(margins), "clientPaymentObservations": len(client_delays)},
        "confidence": min(0.95, 0.35 + 0.1 * len(client_delays)),
        "paymentDelayDays": round(predicted, 1),
    }


def deposit_analysis(db: Session, p: models.Project) -> dict:
    return DepositAnalysisEngine.analyze_deposit_scenarios(
        finance.to_dto(p),
        p.expected_payment_days,
        constraints=DepositConstraintConfig(),
    ).to_dict()


def cost_buffer_analysis(db: Session, p: models.Project) -> dict:
    dto = finance.to_dto(p)
    buffer_minor = BufferEngine.calculate_dynamic_contingency(dto.costs, p.currency)
    return {
        "projectId": p.id,
        "currency": p.currency,
        "plannedCost": sum(cost.amount for cost in dto.costs),
        "recommendedBuffer": finance.naira(buffer_minor, p.currency),
        "evidence": {"ownerMaterialOverrunPct": material_overrun_pct(db, p.owner_id)},
        "confidence": 0.35 if not p.costs else 0.6,
        "engine": "deterministic-cost-buffer-v1",
    }


def copilot_context(db: Session, p: models.Project) -> dict:
    """Structured facts only; a Copilot runtime must not calculate finances."""
    return {
        "project": {
            "id": p.id,
            "name": p.name,
            "stage": p.stage,
            "currency": p.currency,
            "client": {"id": p.client.id, "name": p.client.name, "country": p.client.country},
        },
        "financials": finance.snapshot(p),
        "intelligence": project_intelligence(db, p),
        "forecast": forecast_report(db, p),
        "depositAnalysis": deposit_analysis(db, p),
        "costBuffer": cost_buffer_analysis(db, p),
        "provenance": {"deterministicEngine": "v1", "asOf": models.utcnow().isoformat()},
    }


def creator_genome(db: Session, user_id: str) -> dict:
    margins, delays, _ = _history(db, user_id)
    projs = db.scalars(select(models.Project).where(models.Project.owner_id == user_id, models.Project.stage.in_(["released", "closed"]))).all()
    no_gap = sum(1 for p in projs if not FinancialEngine.calculate_risk_metrics(
        FinancialEngine.build_timeline(finance.to_dto(p), p.expected_payment_days))["has_cash_gap"])
    n = len(projs)
    return {
        "scopeDiscipline": GenomeEngine.calculate_scope_discipline(margins),
        "clientQuality": GenomeEngine.calculate_client_quality(delays),
        # Provisional heuristics (GenomeEngine has no method for these yet) - owned by the intelligence layer.
        "pricingPower": int(100 * sum(1 for m in margins if m >= 5000) / n) if n else 50,
        "cashflowHealth": int(100 * no_gap / n) if n else 50,
        "projectsAnalysed": n,
        "provisional": ["pricingPower", "cashflowHealth"],
    }
