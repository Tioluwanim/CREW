"""Regression tests for bugs fixed in the hand-written engine while wiring it to the API."""
from intelligence.cost_buffer import BufferEngine
from intelligence.dates import project_future_date
from intelligence.financial_engine import FinancialEngine
from intelligence.interfaces import CostDTO, ProjectDTO
from intelligence.simulation import SimulationEngine
from datetime import date


def test_dynamic_contingency_uses_category_rates():
    costs = [CostDTO("a", "transport", 100_000, "creator", 0), CostDTO("b", "software", 10_000, "creator", 0)]
    assert BufferEngine.calculate_dynamic_contingency(costs) == (100_000 * 2500 // 10000 + 10_000 * 500 // 10000) * 100


def test_stress_test_does_not_mutate_and_does_not_crash_on_frozen_dtos():
    p = ProjectDTO("p", 480_000, 40, [CostDTO("a", "materials", 325_000, "creator", 0)])
    score = SimulationEngine.stress_test_project(p, 18)
    assert 0 <= score <= 100 and p.costs[0].amount == 325_000


def test_project_future_date():
    assert project_future_date(date(2026, 9, 29), 3) == date(2026, 10, 2)


def test_engine_timeline_deepest_point():
    p = ProjectDTO("p", 480_000, 40, [CostDTO("a", "materials", 325_000, "creator", 0)])
    risk = FinancialEngine.calculate_risk_metrics(FinancialEngine.build_timeline(p, 18))
    assert risk["upfront_exposure"] == 133_000 and risk["cash_gap_day"] == 0
