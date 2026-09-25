class PriorResolver:
    # Baseline delays across the entire CREW platform (fallback of last resort)
    GLOBAL_DEFAULT_DELAY = 14.0 
    
    # Industry-specific averages
    INDUSTRY_DELAYS = {
        'videography': 21.0, # Post-production revisions delay payments
        'design': 10.0,
        'development': 18.0
    }

    @classmethod
    def get_creator_baseline_delay(
        cls, 
        creator_historical_delays: list[int], 
        creator_industry: str
    ) -> float:
        """
        Finds the most accurate baseline prior for Bayesian calculations.
        Chain: Creator's own history -> Industry average -> Global average.
        """
        # 1. If the creator has their own history, use their median.
        if len(creator_historical_delays) >= 3:
            from intelligence.stats import median_delay
            return float(median_delay(creator_historical_delays))
            
        # 2. Fallback to their specific industry average
        industry_key = creator_industry.lower()
        if industry_key in cls.INDUSTRY_DELAYS:
            return cls.INDUSTRY_DELAYS[industry_key]
            
        # 3. Fallback to the platform global average
        return cls.GLOBAL_DEFAULT_DELAY
