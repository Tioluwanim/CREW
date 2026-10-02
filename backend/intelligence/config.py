"""Static, versioned configuration for the Intelligence Layer.

No environment lookups, no I/O — every value here is a pure constant so the
rest of the layer stays deterministic and testable without a runtime.
"""

ENGINE_VERSION = "1.0.0"
GENOME_ENGINE_VERSION = "1.0.0"
FORECAST_ENGINE_VERSION = "1.0.0"
SIMULATION_ENGINE_VERSION = "1.0.0"

# Bayesian shrinkage: how many "virtual" observations the prior is worth.
# Higher k = a creator needs more history before their own data outweighs
# the platform/industry prior.
SHRINKAGE_PRIOR_WEIGHT_K = 5

# Genome trait confidence/status thresholds, in sample_count.
LOW_CONFIDENCE_SAMPLE_THRESHOLD = 3
ESTABLISHED_SAMPLE_THRESHOLD = 8

DEFAULT_SIMULATION_TRIALS = 2000
DEFAULT_SIMULATION_SEED = 42

DEFAULT_TARGET_MARGIN_BP = 5000  # 50%, used only as a last-resort prior

# Cost-category contingency rates, in basis points of the item's cost.
VOLATILITY_RATES_BP = {
    "transport": 2500,
    "logistics": 2500,
    "generator": 2000,
    "power": 2000,
    "equipment": 1500,
    "labour": 1000,
    "materials": 800,
    "default": 500,
}
