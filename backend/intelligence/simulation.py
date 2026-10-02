from intelligence.interfaces import ProjectDTO
from intelligence.financial_engine import FinancialEngine
import dataclasses

class SimulationEngine:
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
