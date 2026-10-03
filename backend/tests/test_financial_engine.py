"""Unit and property-based test suite for the financial engine.
Ports all 32 finance and money test cases from the frontend:
- 23 tests from src/lib/finance.test.ts
- 9 tests from src/lib/money.test.ts
Plus property-based and multi-currency tests for monetary invariants.
"""
from datetime import date, datetime, timezone
import pytest

from intelligence.currency import (
    CurrencyMismatchError,
    ExchangeRateEvidence,
    convert_minor_amount,
    format_currency,
    format_currency_compact,
    format_currency_signed,
    format_naira,
    format_naira_compact,
    format_naira_signed,
    from_minor_unit,
    round_half_up,
    to_minor_unit,
)
from intelligence.financial_engine import (
    FinancialEngine,
    build_cash_flow_projection,
    calculate_cash_gap,
    calculate_days_to_cash,
    calculate_deposit_amount,
    calculate_deposit_impact,
    calculate_expected_profit,
    calculate_profit_margin,
    calculate_realised_days_to_cash,
    calculate_upfront_exposure,
    find_first_cash_gap_date,
    recommend_minimum_safe_deposit,
    sum_costs,
    sum_creator_funded_costs,
)
from intelligence.interfaces import CostDTO, ProjectDTO, VerifiedPaymentEvent


# Canonical Aso-Ebi fixture from src/lib/finance.test.ts
ASO_EBI_COSTS = [
    CostDTO(id="cost-materials", label="Materials" if hasattr(CostDTO, "label") else None, category="materials", amount=210_000, funded_by="creator", paid_on_day=0),
    CostDTO(id="cost-labour", category="labour", amount=80_000, funded_by="creator", paid_on_day=0),
    CostDTO(id="cost-transport", category="transport", amount=20_000, funded_by="creator", paid_on_day=0),
    CostDTO(id="cost-other", category="other", amount=15_000, funded_by="creator", paid_on_day=0),
]
ASO_EBI_REVENUE = 480_000
ASO_EBI_DEPOSIT_PCT = 40
ASO_EBI_EXPECTED_PAYMENT_DAYS = 18

# Kemi Persona from src/data/demoPersona.ts
KEMI_COSTS = [
    CostDTO(id="cost-editor", category="labour", amount=40_000, funded_by="creator", paid_on_day=0),
    CostDTO(id="cost-promo", category="other", amount=15_000, funded_by="creator", paid_on_day=3),
    CostDTO(id="cost-props", category="materials", amount=10_000, funded_by="creator", paid_on_day=0),
]
KEMI_REVENUE = 300_000
KEMI_DEPOSIT_PCT = 40
KEMI_EXPECTED_PAYMENT_DAYS = 10


# ============================================================================
# PORTED SUITE 1: src/lib/finance.test.ts (23 test cases)
# ============================================================================

# 1-2. sumCosts
def test_1_sum_costs_sums_all_cost_line_items():
    assert sum_costs(ASO_EBI_COSTS) == 325_000


def test_2_sum_costs_returns_0_for_no_costs():
    assert sum_costs([]) == 0


# 3-4. sumCreatorFundedCosts
def test_3_sum_creator_funded_costs_matches_sum_costs_when_all_creator_funded():
    assert sum_creator_funded_costs(ASO_EBI_COSTS) == sum_costs(ASO_EBI_COSTS)


def test_4_sum_creator_funded_costs_excludes_client_funded_costs():
    costs_with_client = [
        CostDTO(c.id, c.category, c.amount, "client" if c.id == "cost-materials" else c.funded_by, c.paid_on_day)
        for c in ASO_EBI_COSTS
    ]
    # 325,000 total - 210,000 client-funded materials = 115,000 creator-funded
    assert sum_creator_funded_costs(costs_with_client) == 115_000


# 5-7. calculateDepositAmount
def test_5_calculate_deposit_amount_computes_at_40_percent():
    assert calculate_deposit_amount(ASO_EBI_REVENUE, 40) == 192_000


def test_6_calculate_deposit_amount_computes_at_60_percent():
    assert calculate_deposit_amount(ASO_EBI_REVENUE, 60) == 288_000


def test_7_calculate_deposit_amount_is_0_at_0_percent():
    assert calculate_deposit_amount(ASO_EBI_REVENUE, 0) == 0


# 8-12. calculateUpfrontExposure
def test_8_calculate_upfront_exposure_is_deepest_point_project_in_isolation():
    # Day 0: -325,000 + 192,000 deposit = -133,000 deepest point.
    exposure = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert exposure == 133_000


def test_9_calculate_upfront_exposure_never_goes_negative():
    exposure = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, 100, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert exposure >= 0


def test_10_calculate_upfront_exposure_decreases_as_deposit_increases():
    at40 = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, 40, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    at60 = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, 60, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert at60 < at40


def test_11_calculate_upfront_exposure_ignores_client_funded_costs():
    all_client = [CostDTO(c.id, c.category, c.amount, "client", c.paid_on_day) for c in ASO_EBI_COSTS]
    assert calculate_upfront_exposure(all_client, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS) == 0


def test_12_calculate_upfront_exposure_cost_paid_later_changes_deepest_point():
    delayed = [CostDTO(c.id, c.category, c.amount, c.funded_by, 25 if c.id == "cost-transport" else c.paid_on_day) for c in ASO_EBI_COSTS]
    exp_delayed = calculate_upfront_exposure(delayed, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    exp_orig = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert exp_delayed < exp_orig


# 13-15. calculateExpectedProfit
def test_13_calculate_expected_profit_is_revenue_minus_creator_costs():
    assert calculate_expected_profit(ASO_EBI_COSTS, ASO_EBI_REVENUE) == 155_000


def test_14_calculate_expected_profit_excludes_client_funded_costs():
    costs_with_client = [
        CostDTO(c.id, c.category, c.amount, "client" if c.id == "cost-materials" else c.funded_by, c.paid_on_day)
        for c in ASO_EBI_COSTS
    ]
    assert calculate_expected_profit(costs_with_client, ASO_EBI_REVENUE) == 365_000


def test_15_calculate_expected_profit_can_be_negative():
    expensive = [CostDTO("c1", "materials", 600_000, "creator", 0)]
    assert calculate_expected_profit(expensive, ASO_EBI_REVENUE) < 0


# 16-17. calculateProfitMargin
def test_16_calculate_profit_margin_computes_percentage():
    margin = calculate_profit_margin(ASO_EBI_COSTS, ASO_EBI_REVENUE)
    assert round(margin, 2) == 32.29


def test_17_calculate_profit_margin_returns_0_for_zero_revenue():
    assert calculate_profit_margin(ASO_EBI_COSTS, 0) == 0.0


# 18. calculateDaysToCash (planned)
def test_18_calculate_days_to_cash_planned():
    assert calculate_days_to_cash(ASO_EBI_EXPECTED_PAYMENT_DAYS) == {"status": "planned", "days": 18}


# 19-20. calculateRealisedDaysToCash
def test_19_calculate_realised_days_to_cash_pending():
    result = calculate_realised_days_to_cash(ASO_EBI_COSTS, ASO_EBI_REVENUE, [{"day": 0, "amount": 192_000}], 5)
    assert result == {"status": "pending", "daysSoFar": 5}


def test_20_calculate_realised_days_to_cash_complete():
    result = calculate_realised_days_to_cash(
        ASO_EBI_COSTS,
        ASO_EBI_REVENUE,
        [{"day": 0, "amount": 192_000}, {"day": 18, "amount": 288_000}],
        18,
    )
    assert result == {"status": "complete", "days": 18}


# 21-22. calculateCashGap
def test_21_calculate_cash_gap_matches_exposure_when_current_cash_is_0():
    gap = calculate_cash_gap(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS, 0)
    exposure = calculate_upfront_exposure(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert gap == exposure


def test_22_calculate_cash_gap_shrinks_with_cash_on_hand():
    gap = calculate_cash_gap(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS, 200_000)
    assert gap == 0


# 23-24. calculateDepositImpact
def test_23_calculate_deposit_impact_bundles_figures():
    impact = calculate_deposit_impact(ASO_EBI_COSTS, ASO_EBI_REVENUE, 40, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert impact["depositPct"] == 40
    assert impact["depositAmount"] == 192_000
    assert impact["upfrontExposure"] == 133_000
    assert impact["cashGap"] == 133_000
    assert impact["coversFullCosts"] is False


def test_24_calculate_deposit_impact_flags_covers_full_costs():
    impact = calculate_deposit_impact(ASO_EBI_COSTS, ASO_EBI_REVENUE, 70, ASO_EBI_EXPECTED_PAYMENT_DAYS)
    assert impact["coversFullCosts"] is True
    assert impact["upfrontExposure"] == 0


# 25-26. recommendMinimumSafeDeposit
def test_25_recommend_minimum_safe_deposit_finds_step():
    # 325,000 / 480,000 = 67.7% -> next 5% step is 70%
    assert recommend_minimum_safe_deposit(ASO_EBI_COSTS, ASO_EBI_REVENUE) == 70


def test_26_recommend_minimum_safe_deposit_returns_none_for_zero_revenue():
    assert recommend_minimum_safe_deposit(ASO_EBI_COSTS, 0) is None


# 27-28. buildCashFlowProjection
def test_27_build_cash_flow_projection_produces_standard_checkpoints():
    points = build_cash_flow_projection(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS, 0)
    assert [p["label"] for p in points] == ["Today", "+3 days", "+7 days", "+14 days", "+30 days"]


def test_28_build_cash_flow_projection_shows_dip_and_recovery():
    points = build_cash_flow_projection(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS, 0)
    day14 = next(p for p in points if p["label"] == "+14 days")
    day30 = next(p for p in points if p["label"] == "+30 days")
    assert day14["projectedBalance"] == 0 + 192_000 - 325_000
    assert day30["projectedBalance"] == 0 + 192_000 + 288_000 - 325_000


# 29-30. findFirstCashGapDate
def test_29_find_first_cash_gap_date_returns_date_when_negative():
    points = build_cash_flow_projection(ASO_EBI_COSTS, ASO_EBI_REVENUE, ASO_EBI_DEPOSIT_PCT, ASO_EBI_EXPECTED_PAYMENT_DAYS, 0)
    assert find_first_cash_gap_date(points) is not None


def test_30_find_first_cash_gap_date_returns_none_when_safe():
    points = build_cash_flow_projection(ASO_EBI_COSTS, ASO_EBI_REVENUE, 100, 1, 1_000_000)
    assert find_first_cash_gap_date(points) is None


# ============================================================================
# PORTED SUITE 2: src/lib/money.test.ts (formatting tests, 31-32)
# ============================================================================

def test_31_format_naira():
    assert format_naira(480_000) == "₦480,000"
    assert format_naira(72_000) == "₦72,000"
    assert format_naira(1000.6) == "₦1,001"


def test_32_format_naira_compact_and_signed():
    assert format_naira_compact(1_200_000) == "₦1.2m"
    assert format_naira_compact(85_000) == "₦85k"
    assert format_naira_compact(500) == "₦500"
    assert format_naira_compact(-72_000) == "-₦72k"
    assert format_naira_signed(155_000) == "+₦155,000"
    assert format_naira_signed(-72_000) == "-₦72,000"


# ============================================================================
# MULTI-CURRENCY & MONETARY INVARIANT PROPERTY TESTS
# ============================================================================

def test_usd_project_calculations_preserve_currency():
    usd_costs = [
        CostDTO(id="c1", category="hosting", amount=500, funded_by="creator", paid_on_day=0, currency="USD"),
        CostDTO(id="c2", category="contractor", amount=700, funded_by="creator", paid_on_day=0, currency="USD"),
    ]
    usd_revenue = 3000
    deposit_pct = 50  # $1,500 deposit
    exp = calculate_upfront_exposure(usd_costs, usd_revenue, deposit_pct, 14, currency="USD")
    # Day 0: -1,200 costs + 1,500 deposit = +300. Exposure is 0!
    assert exp == 0
    profit = calculate_expected_profit(usd_costs, usd_revenue, currency="USD")
    assert profit == 1800  # $3,000 - $1,200


def test_currency_mixing_raises_error():
    mixed_costs = [
        CostDTO(id="c1", category="transport", amount=100, funded_by="creator", paid_on_day=0, currency="USD"),
    ]
    with pytest.raises(CurrencyMismatchError):
        sum_costs(mixed_costs, currency="NGN")


def test_explicit_exchange_rate_conversion():
    as_of = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
    evidence = ExchangeRateEvidence(
        from_currency="USD",
        to_currency="NGN",
        rate=1500.0,
        as_of=as_of,
        source="CentralBankVerified",
        status="verified",
    )
    # $2,000 = 200,000 cents
    # Converted = 200,000 * 1500 * 100 / 100 = 300,000,000 kobo = ₦3,000,000
    cents = 200_000
    kobo = convert_minor_amount(cents, "USD", "NGN", evidence)
    assert kobo == 300_000_000
    assert from_minor_unit(kobo, "NGN") == 3_000_000


@pytest.mark.parametrize("rev,deposit_pct", [
    (100_000, 30),
    (500_000, 50),
    (1_000_000, 70),
    (2_500_000, 0),
])
def test_monetary_invariants_exposure_and_gap_non_negative(rev, deposit_pct):
    costs = [
        CostDTO("c1", "materials", rev * 0.4, "creator", 0),
        CostDTO("c2", "labour", rev * 0.2, "creator", 2),
    ]
    exposure = calculate_upfront_exposure(costs, rev, deposit_pct, 14)
    gap = calculate_cash_gap(costs, rev, deposit_pct, 14, current_cash=50_000)
    assert exposure >= 0
    assert gap >= 0
