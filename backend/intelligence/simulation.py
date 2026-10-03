from dataclasses import dataclass
import random

from intelligence.currency import from_minor_unit, to_minor_unit
from intelligence.interfaces import ProjectDTO
from intelligence.financial_engine import FinancialEngine
import dataclasses


@dataclass(frozen=True)
class ScenarioSimulationResult:
    deposit_pct: int
    deposit_amount: int | float
    probability_of_cash_gap: float
    p50_peak_gap: int | float
    p90_peak_gap: int | float
    gap_timing_days: int | None
    recovery_timing_days: int | None
    deterministic_exposure: int | float
    expected_margin: int | float
    weekly_cash_curve: list[dict]
    currency: str


@dataclass(frozen=True)
class MonteCarloSimulationResult:
    project_id: str
    currency: str
    seed: int
    run_count: int
    engine_version: str
    scenarios: list[ScenarioSimulationResult]


class SimulationEngine:
    ENGINE_VERSION = "deterministic-monte-carlo-v1"

    @staticmethod
    def run_monte_carlo(
        project: ProjectDTO,
        expected_payment_day: int,
        deposit_scenarios: list[int],
        seed: int = 42,
        run_count: int = 1000,
        max_run_count: int = 10_000,
    ) -> MonteCarloSimulationResult:
        if run_count < 1 or run_count > max_run_count:
            raise ValueError(f"run_count must be between 1 and {max_run_count}")
        if not deposit_scenarios:
            raise ValueError("deposit_scenarios must not be empty")

        currency = project.currency
        revenue_minor = to_minor_unit(project.revenue, currency)
        base_costs = [to_minor_unit(c.amount, currency) for c in project.costs if c.funded_by != "client"]
        results: list[ScenarioSimulationResult] = []

        for deposit_pct in sorted(set(deposit_scenarios)):
            rng = random.Random(seed + deposit_pct)
            peak_gaps: list[int] = []
            gap_days: list[int] = []
            recovery_days: list[int] = []
            for _ in range(run_count):
                # The shared seed makes each scenario reproducible while the
                # scenario-specific stream keeps repeated runs independent.
                cost_factor = 1.0 + rng.uniform(-0.05, 0.20)
                delay = max(0, int(round(rng.gauss(0, 3))))
                costs = [
                    dataclasses.replace(
                        cost,
                        amount=from_minor_unit(
                            int(round(to_minor_unit(cost.amount, currency) * cost_factor)),
                            currency,
                        ),
                    )
                    for cost in project.costs
                ]
                timeline = FinancialEngine.build_timeline(
                    dataclasses.replace(project, deposit_pct=deposit_pct, costs=costs),
                    expected_payment_day + delay,
                )
                risk = FinancialEngine.calculate_risk_metrics(timeline)
                peak_gaps.append(int(round(to_minor_unit(risk["upfront_exposure"], currency))))
                if risk["has_cash_gap"]:
                    gap_days.append(risk["cash_gap_day"])
                    recovery_days.append(expected_payment_day + delay)

            peak_gaps.sort()
            p50 = peak_gaps[len(peak_gaps) // 2]
            p90 = peak_gaps[min(len(peak_gaps) - 1, int(len(peak_gaps) * 0.90))]
            deterministic = FinancialEngine.calculate_risk_metrics(
                FinancialEngine.build_timeline(
                    dataclasses.replace(project, deposit_pct=deposit_pct),
                    expected_payment_day,
                )
            )["upfront_exposure"]
            results.append(
                ScenarioSimulationResult(
                    deposit_pct=deposit_pct,
                    deposit_amount=from_minor_unit(
                        (revenue_minor * deposit_pct + 50) // 100, currency
                    ),
                    probability_of_cash_gap=len(gap_days) / run_count,
                    p50_peak_gap=from_minor_unit(p50, currency),
                    p90_peak_gap=from_minor_unit(p90, currency),
                    gap_timing_days=min(gap_days) if gap_days else None,
                    recovery_timing_days=max(recovery_days) if recovery_days else None,
                    deterministic_exposure=deterministic,
                    expected_margin=from_minor_unit(
                        revenue_minor - sum(base_costs), currency
                    ),
                    weekly_cash_curve=[],
                    currency=currency,
                )
            )

        return MonteCarloSimulationResult(
            project_id=project.id,
            currency=currency,
            seed=seed,
            run_count=run_count,
            engine_version=SimulationEngine.ENGINE_VERSION,
            scenarios=results,
        )

    @staticmethod
    def stress_test_project(project: ProjectDTO, expected_payment_day: int) -> int:
        """
        Runs the project through a 'Pessimistic Scenario' (Costs overrun by 20%, 
        client pays 14 days late). Returns a Resilience Score from 0 to 100.
        """
        # CostDTO is frozen, so build a new list of stressed copies instead of mutating.
        stressed_costs = [
            dataclasses.replace(c, amount=(c.amount * 120) // 100) for c in project.costs
        ]
        stressed_project = dataclasses.replace(project, costs=stressed_costs)

        # Scenario 2: Push the final payment day back by 14 days
        stressed_payment_day = expected_payment_day + 14
        
        # Run the stressed data through the deterministic engine
        timeline = FinancialEngine.build_timeline(stressed_project, stressed_payment_day)
        risk = FinancialEngine.calculate_risk_metrics(timeline)
        
        # Calculate Resilience Score
        if not risk["has_cash_gap"]:
            return 100 # Bulletproof. Survived a 20% overrun and 14-day delay.
            
        # If there is a cash gap, how big is it relative to the revenue?
        revenue_kobo = stressed_project.revenue * 100
        gap_ratio = risk["upfront_exposure"] / revenue_kobo
        
        # A gap equal to 50% of the total revenue yields a score of 0
        score = max(0, int(100 - (gap_ratio * 200))) 
        return score
