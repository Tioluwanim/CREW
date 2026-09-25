from intelligence.interfaces import CostDTO
import money

class BufferEngine:
    # High-volatility categories mapping (case-insensitive checks)
    VOLATILITY_RATES_BP = {
        'transport': 2500,  # 25% buffer for fuel/logistics volatility
        'logistics': 2500,
        'generator': 2000,  # 20% buffer for diesel/power
        'power': 2000,
        'equipment': 1500,  # 15% for sudden equipment rentals
        'labour': 1000,     # 10% for crew overtime
        'default': 500      # 5% safety net for everything else (e.g. software)
    }

    @classmethod
    def calculate_dynamic_contingency(cls, costs: list[CostDTO]) -> int:
        """
        Calculates a highly accurate total contingency fund (in Kobo) by 
        applying specific volatility rates to specific cost categories.
        """
        total_contingency_kobo = 0
        
        for cost in costs:
            cost_kobo = money.to_kobo(cost.amount)
            category_key = cost.category.lower().strip()
            
            # Match the category to our volatility index, or fall back to default
            buffer_bp = cls.VOLATILITY_RATES_BP.get(category_key, cls.VOLATILITY_RATES_BP['default'])
            
            # Apply the buffer to this specific cost
            item_contingency = (cost_kobo * buffer_bp) // 10000
            total_contingency_kobo += item_contingency
            
        return total_contingency_kobo
