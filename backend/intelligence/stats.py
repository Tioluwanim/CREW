import statistics
def median_delay(delays: list[int]) -> float:
    if not delays:
        return 0.0
    return statistics.median(delays)

def bayesian_shrinkage(observed_history: list[int], prior_value:float, prior_weight_k: int = 5) -> float:
    """Blends observed creator evidence with prior expectations."""
    n = len(observed_history)
    if n == 0:
        return prior_value
    observed_median = median_delay(observed_history)
    numerator = (n * observed_median) + (prior_weight_k * prior_value)
    denominator = n + prior_weight_k
    return numerator / denominator