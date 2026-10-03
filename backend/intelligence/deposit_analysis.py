"""Deposit scenario analysis engine for CREW.
Evaluates deposit percentages against explicit creator financial risk constraints.

Rules:
- Does NOT output a magical 'correct deposit'.
- Evaluates scenarios against configurable constraints:
  - maximum tolerated probability of cash gap (e.g. <= 10%)
  - maximum tolerated peak gap (e.g. <= 0 or <= 50,000)
  - minimum and maximum deposit percentage bounds
- Computes marginal effect of deposit changes.
- Reports feasible scenarios, failed constraints, evidence, and confidence.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from intelligence.interfaces import CostDTO, ProjectDTO
from intelligence.simulation import ScenarioSimulationResult, SimulationEngine


@dataclass(frozen=True)
class DepositConstraintConfig:
    max_gap_probability: float = 0.10     # Max 10% probability of going negative
    max_tolerated_peak_gap: float = 0.0   # Max tolerable cash deficit
    min_deposit_pct: int = 20
    max_deposit_pct: int = 80


@dataclass(frozen=True)
class DepositScenarioEvaluation:
    deposit_pct: int
    deposit_amount: float | int
    gap_probability: float
    p50_peak_gap: float | int
    p90_peak_gap: float | int
    is_feasible: bool
    failed_constraints: list[str]
    marginal_gap_reduction: float | int   # improvement in p90 gap vs previous scenario


@dataclass(frozen=True)
class DepositAnalysisReport:
    project_id: str
    currency: str
    constraints: dict[str, Any]
    scenarios_evaluated: list[DepositScenarioEvaluation]
    feasible_scenarios: list[int]
    recommended_deposit_range: tuple[int, int] | None
    marginal_effects: list[dict[str, Any]]
    confidence: float
    evidence: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "projectId": self.project_id,
            "currency": self.currency,
            "constraints": self.constraints,
            "scenariosEvaluated": [asdict(s) for s in self.scenarios_evaluated],
            "feasibleScenarios": self.feasible_scenarios,
            "recommendedDepositRange": list(self.recommended_deposit_range) if self.recommended_deposit_range else None,
            "marginalEffects": self.marginal_effects,
            "confidence": self.confidence,
            "evidence": self.evidence,
        }


class DepositAnalysisEngine:
    @classmethod
    def analyze_deposit_scenarios(
        cls,
        project: ProjectDTO,
        expected_payment_day: int,
        constraints: DepositConstraintConfig | None = None,
        candidate_percentages: list[int] | None = None,
        seed: int = 42,
    ) -> DepositAnalysisReport:
        cfg = constraints or DepositConstraintConfig()
        candidates = candidate_percentages or [30, 40, 50, 60, 70, 80]
        # Filter within min/max bounds
        filtered_candidates = [p for p in candidates if cfg.min_deposit_pct <= p <= cfg.max_deposit_pct]
        filtered_candidates.sort()

        sim_result = SimulationEngine.run_monte_carlo(
            project=project,
            expected_payment_day=expected_payment_day,
            deposit_scenarios=filtered_candidates,
            seed=seed,
            run_count=500,
        )

        evaluations: list[DepositScenarioEvaluation] = []
        feasible_list: list[int] = []
        marginal_effects: list[dict[str, Any]] = []

        prev_p90 = None
        for sc in sim_result.scenarios:
            failed: list[str] = []
            if sc.probability_of_cash_gap > cfg.max_gap_probability:
                failed.append(f"Gap probability ({sc.probability_of_cash_gap * 100:.1f}%) exceeds max {cfg.max_gap_probability * 100:.1f}%")
            if sc.p90_peak_gap > cfg.max_tolerated_peak_gap:
                failed.append(f"p90 peak gap ({sc.p90_peak_gap:,.0f}) exceeds max tolerated {cfg.max_tolerated_peak_gap:,.0f}")

            is_feasible = len(failed) == 0
            if is_feasible:
                feasible_list.append(sc.deposit_pct)

            marginal_red = (prev_p90 - sc.p90_peak_gap) if prev_p90 is not None else 0
            if prev_p90 is not None:
                marginal_effects.append({
                    "fromPct": evaluations[-1].deposit_pct,
                    "toPct": sc.deposit_pct,
                    "gapReduction": marginal_red,
                    "probabilityReduction": round(evaluations[-1].gap_probability - sc.probability_of_cash_gap, 4),
                })
            prev_p90 = sc.p90_peak_gap

            evaluations.append(
                DepositScenarioEvaluation(
                    deposit_pct=sc.deposit_pct,
                    deposit_amount=sc.deposit_amount,
                    gap_probability=sc.probability_of_cash_gap,
                    p50_peak_gap=sc.p50_peak_gap,
                    p90_peak_gap=sc.p90_peak_gap,
                    is_feasible=is_feasible,
                    failed_constraints=failed,
                    marginal_gap_reduction=marginal_red,
                )
            )

        recommended_range = (min(feasible_list), max(feasible_list)) if feasible_list else None

        evidence = {
            "seed": seed,
            "runCount": sim_result.run_count,
            "engineVersion": sim_result.engine_version,
            "totalScenariosEvaluated": len(evaluations),
        }

        return DepositAnalysisReport(
            project_id=project.id,
            currency=project.currency or "NGN",
            constraints={
                "maxGapProbability": cfg.max_gap_probability,
                "maxToleratedPeakGap": cfg.max_tolerated_peak_gap,
                "minDepositPct": cfg.min_deposit_pct,
                "maxDepositPct": cfg.max_deposit_pct,
            },
            scenarios_evaluated=evaluations,
            feasible_scenarios=feasible_list,
            recommended_deposit_range=recommended_range,
            marginal_effects=marginal_effects,
            confidence=0.85,
            evidence=evidence,
        )
