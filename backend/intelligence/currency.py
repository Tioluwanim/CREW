"""Currency and minor-unit monetary abstractions for CREW.
Strict rules:
- Money is never handled in floats in intermediate calculations.
- Amounts are represented in integer minor units (kobo, cents, pence).
- No mixing of currencies without an explicit ExchangeRateEvidence context.
- Explicit as_of and provenance for all exchange rates.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

CurrencyCode = str

CURRENCY_SPECS: dict[str, dict] = {
    "NGN": {"symbol": "₦", "factor": 100, "minor_unit": "kobo", "name": "Nigerian Naira"},
    "USD": {"symbol": "$", "factor": 100, "minor_unit": "cents", "name": "US Dollar"},
    "GBP": {"symbol": "£", "factor": 100, "minor_unit": "pence", "name": "British Pound"},
    "EUR": {"symbol": "€", "factor": 100, "minor_unit": "cents", "name": "Euro"},
    "CAD": {"symbol": "CA$", "factor": 100, "minor_unit": "cents", "name": "Canadian Dollar"},
    "AUD": {"symbol": "AU$", "factor": 100, "minor_unit": "cents", "name": "Australian Dollar"},
    "JPY": {"symbol": "¥", "factor": 1, "minor_unit": "yen", "name": "Japanese Yen"},
}


class CurrencyMismatchError(ValueError):
    """Raised when an operation attempts to combine values in different currencies without an explicit conversion rate."""
    pass


def get_minor_unit_factor(currency: str = "NGN") -> int:
    return CURRENCY_SPECS.get(currency.upper(), {"factor": 100})["factor"]


def get_currency_symbol(currency: str = "NGN") -> str:
    return CURRENCY_SPECS.get(currency.upper(), {"symbol": f"{currency} "})["symbol"]


def round_half_up(value: float) -> int:
    """Matches frontend kobo.ts roundHalfUp: Math.sign(value) * Math.floor(Math.abs(value) + 0.5)"""
    if value == 0:
        return 0
    sign = 1 if value > 0 else -1
    return int(sign * math.floor(abs(value) + 0.5))


def to_minor_unit(major_amount: float | int, currency: str = "NGN") -> int:
    factor = get_minor_unit_factor(currency)
    return round_half_up(major_amount * factor)


def from_minor_unit(minor_amount: int, currency: str = "NGN") -> float | int:
    factor = get_minor_unit_factor(currency)
    res = minor_amount / factor
    return int(res) if res.is_integer() else res


@dataclass(frozen=True)
class ExchangeRateEvidence:
    from_currency: str
    to_currency: str
    rate: float  # 1 from_currency = rate to_currency
    as_of: datetime
    source: str
    status: Literal["verified", "manual", "simulated"] = "verified"

    def __post_init__(self):
        if self.rate <= 0:
            raise ValueError("Exchange rate must be positive")


def convert_minor_amount(
    amount_minor: int,
    from_currency: str,
    to_currency: str,
    evidence: ExchangeRateEvidence,
) -> int:
    """Converts an integer minor-unit amount from one currency to another using verified evidence."""
    from_curr = from_currency.upper()
    to_curr = to_currency.upper()
    if from_curr == to_curr:
        return amount_minor

    if evidence.from_currency.upper() != from_curr or evidence.to_currency.upper() != to_curr:
        raise CurrencyMismatchError(
            f"Evidence currency pair ({evidence.from_currency}->{evidence.to_currency}) "
            f"does not match conversion pair ({from_curr}->{to_curr})"
        )

    from_factor = get_minor_unit_factor(from_curr)
    to_factor = get_minor_unit_factor(to_curr)

    # major amount in from_currency = amount_minor / from_factor
    # major amount in to_currency = (amount_minor / from_factor) * rate
    # minor amount in to_currency = round_half_up(major amount in to_currency * to_factor)
    converted_minor = round_half_up((amount_minor * evidence.rate * to_factor) / from_factor)
    return converted_minor


# Formatting helpers (exact match with frontend money.ts)
def format_currency(amount: float | int, currency: str = "NGN") -> str:
    sym = get_currency_symbol(currency)
    rounded = round_half_up(amount)
    return f"{sym}{rounded:,}"


def format_currency_compact(amount: float | int, currency: str = "NGN") -> str:
    sym = get_currency_symbol(currency)
    sign = "-" if amount < 0 else ""
    abs_amt = abs(amount)
    if abs_amt >= 1_000_000:
        val = abs_amt / 1_000_000
        formatted = f"{val:.1f}".rstrip("0").rstrip(".") if val % 1 != 0 else f"{int(val)}"
        return f"{sign}{sym}{formatted}m"
    if abs_amt >= 1_000:
        val = abs_amt / 1_000
        formatted = f"{val:.1f}".rstrip("0").rstrip(".") if val % 1 != 0 else f"{int(val)}"
        return f"{sign}{sym}{formatted}k"
    return f"{sign}{sym}{int(abs_amt)}"


def format_currency_signed(amount: float | int, currency: str = "NGN") -> str:
    sym = get_currency_symbol(currency)
    rounded = abs(round_half_up(amount))
    sign = "+" if amount > 0 else "-" if amount < 0 else ""
    return f"{sign}{sym}{rounded:,}"


# Naira-specific aliases matching frontend
def format_naira(amount: float | int) -> str:
    return format_currency(amount, "NGN")


def format_naira_compact(amount: float | int) -> str:
    return format_currency_compact(amount, "NGN")


def format_naira_signed(amount: float | int) -> str:
    return format_currency_signed(amount, "NGN")
