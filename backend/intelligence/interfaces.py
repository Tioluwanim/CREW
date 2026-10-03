from dataclasses import dataclass
from typing import Literal

Funder = Literal['creator', 'client']

@dataclass(frozen=True)
class CostDTO:
    id: str
    category: str  # Unconstrained to support any creative expense
    amount: int | float
    funded_by: Funder
    paid_on_day: int
    label: str | None = None
    currency: str = "NGN"

@dataclass(frozen=True)
class ProjectDTO:
    id: str
    revenue: int | float
    deposit_pct: int
    costs: list[CostDTO]
    currency: str = "NGN"


@dataclass(frozen=True)
class VerifiedPaymentEvent:
    day: int
    amount: int | float