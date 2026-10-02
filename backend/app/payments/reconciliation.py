"""Provider-agnostic reconciliation engine.

Pure function: (what WE recorded) x (what the PROVIDER recorded) -> discrepancies. No DB, no HTTP, no provider names,
so it is identical whether the money moved through Ecobank, Verve, Paystack, OPay or Moniepoint, and can be tested
exhaustively. The service layer (`services/reconcile_runner.py`) feeds it and persists the outcome.

Matching runs in passes, each consuming entries so nothing is matched twice:
  1. our reference   (internal.key == external.reference)
  2. provider ref    (internal.provider_ref == external.provider_ref)
  3. account + amount + time window   (inbound transfers into a virtual account that carry no reference)
Pluggable: pass your own `matchers` to add a pass (e.g. narration parsing for a provider that only gives narration).

Everything unexplained becomes a Discrepancy with a severity; nothing is auto-fixed here."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Sequence

from app.payments.domain import Direction, ProviderTransaction, TxnStatus


class Severity(str, Enum):
    INFO = "info"          # explained by timing; look again next run
    WARNING = "warning"
    CRITICAL = "critical"  # money may be wrong or missing - a human must look


class DiscrepancyKind(str, Enum):
    AMOUNT_MISMATCH = "amount_mismatch"
    STATUS_MISMATCH = "status_mismatch"                # we say paid, provider says failed/reversed (or the reverse)
    MISSING_AT_PROVIDER = "missing_at_provider"        # we say paid, provider has no record, past the grace period
    PENDING_AT_PROVIDER = "pending_at_provider"        # same, but still inside the grace period
    UNRECORDED_AT_PLATFORM = "unrecorded_at_platform"  # provider received/sent money we have no record of
    DUPLICATE_AT_PROVIDER = "duplicate_at_provider"    # same provider_ref appears more than once on the statement
    UNRECORDED_SUCCESS = "unrecorded_success"          # provider succeeded but we still show pending/failed


@dataclass(frozen=True)
class InternalEntry:
    key: str                                  # our reference (unique)
    direction: Direction
    amount_kobo: int
    status: str                               # verified | completed | pending | unverified | failed
    occurred_at: datetime
    kind: str = "collection"                  # collection | payout
    provider_ref: str | None = None
    account_number: str | None = None
    project_id: str | None = None
    entry_id: str | None = None               # our DB id, so the caller can act on the result

    @property
    def settled(self) -> bool:
        return self.status in ("verified", "completed")


@dataclass(frozen=True)
class Discrepancy:
    kind: DiscrepancyKind
    severity: Severity
    message: str
    internal: InternalEntry | None = None
    external: ProviderTransaction | None = None
    delta_kobo: int = 0                       # external - internal (signed), where meaningful

    @property
    def fingerprint(self) -> str:
        """Stable across runs so the same problem is one open item, not one per run."""
        i = self.internal.key if self.internal else "-"
        e = self.external.provider_ref if self.external else "-"
        return f"{self.kind.value}|{i}|{e}"


@dataclass
class ReconciliationResult:
    matched: list[tuple[InternalEntry, ProviderTransaction]] = field(default_factory=list)
    discrepancies: list[Discrepancy] = field(default_factory=list)
    internal_in_kobo: int = 0
    external_in_kobo: int = 0
    internal_out_kobo: int = 0
    external_out_kobo: int = 0

    @property
    def balanced(self) -> bool:
        return not any(d.severity in (Severity.WARNING, Severity.CRITICAL) for d in self.discrepancies)

    def by_kind(self, kind: DiscrepancyKind) -> list[Discrepancy]:
        return [d for d in self.discrepancies if d.kind == kind]


Matcher = Callable[[InternalEntry, ProviderTransaction, "Policy"], bool]


@dataclass(frozen=True)
class Policy:
    grace: timedelta = timedelta(hours=6)             # how long a provider may lag before "missing" becomes CRITICAL
    amount_tolerance_kobo: int = 0                    # rounding tolerance; keep 0 unless a provider truncates
    account_match_window: timedelta = timedelta(hours=2)


def by_reference(i: InternalEntry, e: ProviderTransaction, p: Policy) -> bool:
    return bool(e.reference) and e.reference == i.key


def by_provider_ref(i: InternalEntry, e: ProviderTransaction, p: Policy) -> bool:
    return bool(i.provider_ref) and i.provider_ref == e.provider_ref


def by_account_amount_time(i: InternalEntry, e: ProviderTransaction, p: Policy) -> bool:
    return (bool(i.account_number) and i.account_number == e.account_number and i.direction == e.direction
            and abs(i.amount_kobo - e.amount_kobo) <= p.amount_tolerance_kobo
            and abs(i.occurred_at - e.occurred_at) <= p.account_match_window)


DEFAULT_MATCHERS: tuple[Matcher, ...] = (by_reference, by_provider_ref, by_account_amount_time)


class ReconciliationEngine:
    def __init__(self, matchers: Sequence[Matcher] = DEFAULT_MATCHERS, policy: Policy = Policy()):
        self.matchers, self.policy = tuple(matchers), policy

    def reconcile(self, internal: Sequence[InternalEntry], external: Sequence[ProviderTransaction],
                  *, since: datetime, until: datetime, now: datetime) -> ReconciliationResult:
        res = ReconciliationResult()
        p = self.policy

        # duplicates on the provider statement: keep the first line for matching, flag the rest
        seen: dict[str, ProviderTransaction] = {}
        ext_pool: list[ProviderTransaction] = []
        for e in sorted(external, key=lambda x: (x.occurred_at, x.provider_ref)):
            if e.provider_ref in seen:
                res.discrepancies.append(Discrepancy(DiscrepancyKind.DUPLICATE_AT_PROVIDER, Severity.CRITICAL,
                                                     f"Provider statement lists {e.provider_ref} more than once", external=e))
                continue
            seen[e.provider_ref] = e
            ext_pool.append(e)

        remaining_ext = list(ext_pool)
        unmatched_int = sorted(internal, key=lambda x: (x.occurred_at, x.key))
        for matcher in self.matchers:
            still: list[InternalEntry] = []
            for i in unmatched_int:
                hit = next((e for e in remaining_ext if e.direction == i.direction and matcher(i, e, p)), None)
                if hit is None:
                    still.append(i)
                    continue
                remaining_ext.remove(hit)
                res.matched.append((i, hit))
            unmatched_int = still

        # 1) matched pairs: do the facts agree?
        for i, e in res.matched:
            self._compare(i, e, res)

        # 2) ours, not theirs
        for i in unmatched_int:
            if not i.settled:
                continue   # a pending/failed entry with no provider trace is normal
            if i.occurred_at > until:
                continue   # outside the statement window
            age = now - i.occurred_at
            if age <= p.grace:
                res.discrepancies.append(Discrepancy(DiscrepancyKind.PENDING_AT_PROVIDER, Severity.INFO,
                                                     f"{i.key}: not on the provider statement yet ({_mins(age)} old, within grace)", internal=i))
            else:
                res.discrepancies.append(Discrepancy(DiscrepancyKind.MISSING_AT_PROVIDER, Severity.CRITICAL,
                                                     f"{i.key}: we recorded {_naira(i.amount_kobo)} as {i.status} but the provider has no matching record", internal=i))

        # 3) theirs, not ours (only money that really moved)
        for e in remaining_ext:
            if e.status != TxnStatus.SUCCESSFUL:
                continue
            sev = Severity.CRITICAL
            what = "received" if e.direction == Direction.INBOUND else "sent"
            res.discrepancies.append(Discrepancy(DiscrepancyKind.UNRECORDED_AT_PLATFORM, sev,
                                                 f"Provider {what} {_naira(e.amount_kobo)} ({e.provider_ref}) that we have no record of", external=e, delta_kobo=e.amount_kobo))

        # totals over SETTLED movements only, so pending noise doesn't show as a gap
        for i in internal:
            if i.settled:
                if i.direction == Direction.INBOUND: res.internal_in_kobo += i.amount_kobo
                else: res.internal_out_kobo += i.amount_kobo
        for e in ext_pool:
            if e.status == TxnStatus.SUCCESSFUL:
                if e.direction == Direction.INBOUND: res.external_in_kobo += e.amount_kobo
                else: res.external_out_kobo += e.amount_kobo
        return res

    def _compare(self, i: InternalEntry, e: ProviderTransaction, res: ReconciliationResult) -> None:
        p = self.policy
        if i.settled and e.status in (TxnStatus.FAILED, TxnStatus.REVERSED):
            res.discrepancies.append(Discrepancy(DiscrepancyKind.STATUS_MISMATCH, Severity.CRITICAL,
                                                 f"{i.key}: we recorded {i.status} but the provider shows {e.status.value}", i, e))
            return
        if not i.settled and e.status == TxnStatus.SUCCESSFUL:
            res.discrepancies.append(Discrepancy(DiscrepancyKind.UNRECORDED_SUCCESS, Severity.WARNING,
                                                 f"{i.key}: provider shows {_naira(e.amount_kobo)} successful but we still show {i.status}", i, e, e.amount_kobo - i.amount_kobo))
            return
        if i.settled and abs(e.amount_kobo - i.amount_kobo) > p.amount_tolerance_kobo:
            res.discrepancies.append(Discrepancy(DiscrepancyKind.AMOUNT_MISMATCH, Severity.CRITICAL,
                                                 f"{i.key}: we recorded {_naira(i.amount_kobo)}, provider moved {_naira(e.amount_kobo)}", i, e, e.amount_kobo - i.amount_kobo))


def _naira(kobo: int) -> str:
    return f"₦{kobo / 100:,.2f}"


def _mins(td: timedelta) -> str:
    return f"{int(td.total_seconds() // 60)} min"
