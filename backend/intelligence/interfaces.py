from dataclasses import dataclass
from typing import Literal

Funder = Literal['creator', 'client']

@dataclass(frozen=True)
class CostDTO:
    id: str
    category: str  # Unconstrained to support any creative expense
    amount: int
    funded_by: Funder
    paid_on_day: int

@dataclass(frozen=True)
class ProjectDTO:
    id: str
    revenue: int
    deposit_pct: int
    costs: list[CostDTO]