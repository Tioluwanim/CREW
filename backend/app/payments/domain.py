"""Canonical payment vocabulary. Every provider adapter translates to and from THESE types, and nothing outside
`app/payments/adapters/` may know a provider's field names, status strings or amount units.

Rules that hold for every adapter:
  * money is integer KOBO, always. Convert at the edge with `to_provider_amount` / `from_provider_amount`;
  * our `reference` is the idempotency key we control; `provider_ref` is theirs (may be None until known);
  * timestamps are timezone-aware UTC;
  * `raw` is for audit only (already stripped of secrets) - business logic must never read it."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any


class CollectionMethod(str, Enum):
    CHECKOUT = "checkout"                 # hosted page / payment link the payer is redirected to
    VIRTUAL_ACCOUNT = "virtual_account"   # payer transfers to a dedicated account number
    TRANSFER_INSTRUCTIONS = "transfer"    # static account details + narration reference (no per-payer account)


class CollectionStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class PayoutStatus(str, Enum):
    PENDING = "pending"        # accepted by provider, not yet settled (most rails are async)
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class VirtualAccountStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    EXPIRED = "expired"


class WebhookEventType(str, Enum):
    COLLECTION_SUCCEEDED = "collection.succeeded"
    COLLECTION_FAILED = "collection.failed"
    VIRTUAL_ACCOUNT_CREDIT = "virtual_account.credit"
    PAYOUT_COMPLETED = "payout.completed"
    PAYOUT_FAILED = "payout.failed"
    PAYOUT_REVERSED = "payout.reversed"
    IGNORED = "ignored"        # a valid event we don't act on (keep it in the log, do nothing)


class Direction(str, Enum):
    INBOUND = "in"
    OUTBOUND = "out"


class TxnStatus(str, Enum):
    """Status of a line on a provider statement, normalised."""
    SUCCESSFUL = "successful"
    PENDING = "pending"
    FAILED = "failed"
    REVERSED = "reversed"


@dataclass(frozen=True)
class Capabilities:
    """What an adapter genuinely supports. Callers check these instead of catching exceptions, and the
    contract test-kit fails an adapter that claims a capability it does not implement."""
    checkout: bool = False
    virtual_accounts: bool = False
    transfer_instructions: bool = False
    payouts: bool = False
    statement: bool = False              # can list transactions for a period (needed for full reconciliation)
    account_name_lookup: bool = False    # can resolve bank_code + account_number -> account name
    webhooks: bool = False
    requires_payout_destination: bool = True   # real rails need the creator's bank details; the sandbox does not
    amount_unit: str = "kobo"            # what the provider's API expects on the wire: "kobo" or "naira"


@dataclass(frozen=True)
class Customer:
    name: str
    email: str | None = None
    phone: str | None = None


@dataclass(frozen=True)
class CollectionRequest:
    reference: str                       # ours; provider must echo it back on webhooks/verify where it supports one
    amount_kobo: int
    customer: Customer
    narration: str = ""
    method: CollectionMethod = CollectionMethod.CHECKOUT
    currency: str = "NGN"
    expires_at: datetime | None = None
    callback_url: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class VirtualAccountDetails:
    account_number: str
    account_name: str
    bank_name: str
    bank_code: str | None = None
    expires_at: datetime | None = None


@dataclass(frozen=True)
class CollectionSession:
    reference: str
    method: CollectionMethod
    provider_ref: str | None = None
    checkout_url: str | None = None
    virtual_account: VirtualAccountDetails | None = None
    instructions: str = ""
    expires_at: datetime | None = None


@dataclass(frozen=True)
class VerificationResult:
    status: CollectionStatus
    amount_kobo: int | None = None       # what the provider says was actually paid; None while pending
    provider_ref: str | None = None
    paid_at: datetime | None = None
    fee_kobo: int | None = None


@dataclass(frozen=True)
class VirtualAccountRequest:
    reference: str                       # ours, stable per project so re-opening is idempotent
    customer: Customer
    expected_amount_kobo: int | None = None   # None = accept any amount (the platform applies its own policy)
    expires_at: datetime | None = None
    narration: str = ""
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class VirtualAccount:
    reference: str
    details: VirtualAccountDetails
    status: VirtualAccountStatus = VirtualAccountStatus.OPEN
    provider_ref: str | None = None


@dataclass(frozen=True)
class PayoutDestination:
    bank_code: str
    account_number: str
    account_name: str


@dataclass(frozen=True)
class PayoutRequest:
    reference: str                       # ours; retries with the same reference must NOT pay twice
    amount_kobo: int
    destination: PayoutDestination | None
    narration: str = ""
    currency: str = "NGN"
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class PayoutResult:
    reference: str
    status: PayoutStatus
    provider_ref: str | None = None
    failure_reason: str | None = None
    fee_kobo: int | None = None


@dataclass(frozen=True)
class WebhookEvent:
    event_id: str                        # unique per provider event; our idempotency key for replays
    type: WebhookEventType
    occurred_at: datetime
    reference: str | None = None         # our reference, if the provider echoes it
    provider_ref: str | None = None
    amount_kobo: int | None = None
    account_number: str | None = None    # virtual account that was credited
    payer_name: str | None = None
    failure_reason: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderTransaction:
    """One line of the provider's own record of money movement - the "external" side of reconciliation.
    `amount_kobo` is the GROSS amount that moved; report fees in `fee_kobo`, never netted into the amount."""
    provider_ref: str
    direction: Direction
    amount_kobo: int
    status: TxnStatus
    occurred_at: datetime
    reference: str | None = None         # our reference if the statement carries it (narration / metadata / session id)
    account_number: str | None = None    # virtual account credited, for inbound transfers
    counterparty: str | None = None
    fee_kobo: int | None = None


# ------------------------------------------------------------------ amount + time helpers
def to_provider_amount(amount_kobo: int, unit: str) -> int | Decimal:
    """kobo -> the unit the provider's API wants. 'kobo' stays an int; 'naira' is an exact Decimal (never float)."""
    if unit == "kobo":
        return amount_kobo
    if unit == "naira":
        return (Decimal(amount_kobo) / Decimal(100)).quantize(Decimal("0.01"))
    raise ValueError(f"unknown amount unit {unit!r}")


def from_provider_amount(value: int | float | str | Decimal, unit: str) -> int:
    """provider amount -> integer kobo, rounding half-up on the kobo boundary. Floats are converted via str to avoid drift."""
    d = Decimal(str(value))
    kobo = d if unit == "kobo" else d * 100
    return int(kobo.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
