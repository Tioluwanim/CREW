from dataclasses import dataclass
from intelligence.stats import median_delay
from intelligence.interfaces import CostDTO

@dataclass(frozen=True)
class CreatorGenome:
    pricing_power: int      # 0-100: How often they secure >50% margins
    scope_discipline: int   # 0-100: How well they prevent cost overruns
    client_quality: int     # 0-100: The average punctuality of their clients
    cashflow_health: int    # 0-100: Ability to avoid cash gaps

class GenomeEngine:
    @staticmethod
    def calculate_scope_discipline(historical_project_margins: list[int], target_margin_bp: int = 5000) -> int:
        """
        Scores 0-100 based on how often the creator actually hits their target margin.
        If they consistently bleed margin to scope creep, this score drops.
        """
        if not historical_project_margins:
            return 50 # Default baseline
            
        hits = sum(1 for m in historical_project_margins if m >= target_margin_bp)
        score = (hits / len(historical_project_margins)) * 100
        return int(score)

    @staticmethod
    def calculate_client_quality(historical_client_delays: list[int]) -> int:
        """
        Scores 0-100 based on client punctuality. 
        0 delays = 100 score. 30+ days average delay = 0 score.
        """
        if not historical_client_delays:
            return 50
            
        median = median_delay(historical_client_delays)
        # Cap the penalty at 30 days. Anything worse than 30 days is a 0.
        penalty = min(median / 30.0, 1.0) 
        return int(100 - (penalty * 100))
