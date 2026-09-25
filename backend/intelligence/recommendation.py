from dataclasses import dataclass
from typing import Literal
from intelligence.interfaces import ProjectDTO
import money

RecommendationType = Literal['INCREASE_DEPOSIT', 'INCREASE_PRICE', 'CLIENT_RISK_WARNING']
Severity = Literal['LOW', 'MEDIUM', 'HIGH']


@dataclass(frozen=True)
class RecommendationDTO:
    type: RecommendationType
    severity: Severity
    message: str
    suggested_value_naira: int | None = None
    suggested_value_pct: int | None = None


class RecommendationEngine:

    @staticmethod
    def evaluate_deposit(project: ProjectDTO, upfront_exposure_naira: int) -> RecommendationDTO | None:
        """
        Checks if the creator is funding the project out-of-pocket.
        If upfront exposure > 0, recommends a new deposit percentage.
        """
        if upfront_exposure_naira <= 0:
            return None  # No cash gap, deposit is fine.

        # Calculate what the deposit should have been to cover the exposure
        current_deposit_naira = money.kobo_to_naira(
            money.calculate_cost_buffer(money.naira_to_kobo(project.revenue), money.points_for_percentage(project.deposit_pct))
        )

        required_deposit_naira = current_deposit_naira + upfront_exposure_naira

        # Calculate the new required percentage (convert back from basis points)
        required_deposit_bp = money.calculate_margin_dp(
            money.naira_to_kobo(required_deposit_naira),
            money.naira_to_kobo(project.revenue)
        )
        required_deposit_pct = required_deposit_bp // 100  # e.g., 7500 bp -> 75%

        return RecommendationDTO(
            type='INCREASE_DEPOSIT',
            severity='HIGH',
            message=f"You will experience a cash gap. Increase your deposit to at least {required_deposit_pct}% to avoid paying for materials out-of-pocket.",
            suggested_value_pct=required_deposit_pct
        )

    @staticmethod
    def evaluate_margin(project_margin_bp: int, historical_overrun_pct: float) -> RecommendationDTO | None:
        """
        Checks if the project is priced high enough to absorb typical cost overruns.
        """
        historical_overrun_bp = money.points_for_percentage(historical_overrun_pct)

        if project_margin_bp >= historical_overrun_bp:
            return None  # The margin is safe.

        # The margin is too thin. Calculate the difference in basis points.
        deficit_bp = historical_overrun_bp - project_margin_bp

        return RecommendationDTO(
            type='INCREASE_PRICE',
            severity='MEDIUM',
            message=f"Your profit margin is lower than your typical {historical_overrun_pct}% cost overrun. Consider increasing your total price.",
            suggested_value_pct=deficit_bp // 100
        )