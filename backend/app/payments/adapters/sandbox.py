"""Fully working in-memory adapter. It is (1) what runs in dev/demo/tests, (2) the reference implementation of every
port method, and (3) the fixture the contract test-kit and the reconciliation tests drive. It moves no real money.

Behaviour: references starting `SBX-FAIL` fail, any other `SBX-` reference succeeds, everything else stays pending.
Its "statement" is a module-level ledger that verified collections, virtual-account credits and payouts write to; tests
can edit that ledger to create discrepancies for the reconciliation engine to find."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import threading
from datetime import datetime, timedelta
from typing import Iterator, Mapping

from app.config import get_settings
from app.payments.domain import (
    Capabilities, CollectionMethod, CollectionRequest, CollectionSession, CollectionStatus, Direction, PayoutDestination,
    PayoutRequest, PayoutResult, PayoutStatus, ProviderTransaction, TxnStatus, VerificationResult, VirtualAccount,
    VirtualAccountDetails, VirtualAccountRequest, VirtualAccountStatus, WebhookEvent, WebhookEventType, as_utc,
)
from app.payments.errors import MalformedPayload, ProviderRejected, SignatureInvalid
from app.payments.ports import PaymentProvider
from app.models import utcnow


class _Ledger:
    def __init__(self):
        self.lock = threading.RLock()
        self.reset()

    def reset(self):
        self.sessions: dict[str, CollectionSession] = {}
        self.session_amounts: dict[str, int] = {}
        self.accounts: dict[str, VirtualAccount] = {}
        self.payouts: dict[str, PayoutResult] = {}
        self.payout_amounts: dict[str, int] = {}
        self.txns: list[ProviderTransaction] = []

    def add_txn(self, txn: ProviderTransaction) -> None:
        if not any(t.provider_ref == txn.provider_ref for t in self.txns):
            self.txns.append(txn)


LEDGER = _Ledger()


def reset_sandbox() -> None:
    LEDGER.reset()


class SandboxProvider(PaymentProvider):
    name = "sandbox"
    reference_prefix = "SBX-"

    @property
    def capabilities(self) -> Capabilities:
        return Capabilities(checkout=True, virtual_accounts=True, transfer_instructions=True, payouts=True, statement=True,
                            account_name_lookup=True, webhooks=True, requires_payout_destination=False, amount_unit="kobo")

    # ---- collections
    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        with LEDGER.lock:
            if req.reference in LEDGER.sessions:
                return LEDGER.sessions[req.reference]
            url = f"{get_settings().public_app_url}/sandbox/pay/{req.reference}" if req.method == CollectionMethod.CHECKOUT else None
            s = CollectionSession(reference=req.reference, method=req.method, provider_ref="SBXP-" + req.reference[-8:], checkout_url=url,
                                  instructions="Sandbox - no real money moves.", expires_at=req.expires_at)
            LEDGER.sessions[req.reference], LEDGER.session_amounts[req.reference] = s, req.amount_kobo
            return s

    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        if reference.startswith("SBX-FAIL"):
            return VerificationResult(CollectionStatus.FAILED)
        if not reference.startswith("SBX-"):
            return VerificationResult(CollectionStatus.PENDING)
        with LEDGER.lock:
            amount = LEDGER.session_amounts.get(reference, expected_kobo)   # sandbox has no rail, so it may echo the hint
            if amount is None:
                return VerificationResult(CollectionStatus.PENDING)
            ref = "SBXTX-" + reference
            LEDGER.add_txn(ProviderTransaction(provider_ref=ref, direction=Direction.INBOUND, amount_kobo=amount, status=TxnStatus.SUCCESSFUL,
                                               occurred_at=utcnow(), reference=reference))
            return VerificationResult(CollectionStatus.SUCCEEDED, amount_kobo=amount, provider_ref=ref, paid_at=utcnow(), fee_kobo=0)

    # ---- webhooks (HMAC-SHA256 of the raw body in X-CREW-Signature, secret = WEBHOOK_SECRET)
    @staticmethod
    def sign(body: bytes) -> str:
        return hmac.new(get_settings().webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        if not hmac.compare_digest(self.sign(body), headers.get("x-crew-signature", "")):
            raise SignatureInvalid("bad signature")

    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        try:
            d = json.loads(body)
            now = utcnow()
            if "type" not in d:   # legacy shape: {"reference","status","amountKobo"}
                ok = d["status"] == "verified"
                return [WebhookEvent(event_id=f"{d['reference']}:{d['status']}",
                                     type=WebhookEventType.COLLECTION_SUCCEEDED if ok else WebhookEventType.COLLECTION_FAILED,
                                     occurred_at=now, reference=d["reference"], amount_kobo=int(d["amountKobo"]))]
            t = WebhookEventType(d["type"])
            return [WebhookEvent(event_id=d["eventId"], type=t, occurred_at=as_utc(datetime.fromisoformat(d["occurredAt"])) if d.get("occurredAt") else now,
                                 reference=d.get("reference"), provider_ref=d.get("providerRef"),
                                 amount_kobo=int(d["amountKobo"]) if d.get("amountKobo") is not None else None,
                                 account_number=d.get("accountNumber"), payer_name=d.get("payerName"), failure_reason=d.get("failureReason"))]
        except (KeyError, ValueError, TypeError) as e:
            raise MalformedPayload(f"sandbox webhook: {type(e).__name__}") from e

    # ---- virtual accounts
    def open_virtual_account(self, req: VirtualAccountRequest) -> VirtualAccount:
        with LEDGER.lock:
            if req.reference in LEDGER.accounts:
                return LEDGER.accounts[req.reference]
            number = "9" + str(int(hashlib.sha256(req.reference.encode()).hexdigest(), 16))[:9]
            va = VirtualAccount(reference=req.reference, provider_ref="SBXVA-" + number, status=VirtualAccountStatus.OPEN,
                                details=VirtualAccountDetails(number, f"CREW/{req.customer.name}"[:40], "Sandbox Bank", "000", req.expires_at))
            LEDGER.accounts[req.reference] = va
            return va

    def get_virtual_account(self, reference: str) -> VirtualAccount:
        try:
            return LEDGER.accounts[reference]
        except KeyError:
            raise ProviderRejected("virtual account not found", "404")

    def close_virtual_account(self, reference: str) -> VirtualAccount:
        with LEDGER.lock:
            va = self.get_virtual_account(reference)
            closed = VirtualAccount(va.reference, va.details, VirtualAccountStatus.CLOSED, va.provider_ref)
            LEDGER.accounts[reference] = closed
            return closed

    # ---- payouts (SANDBOX_ASYNC_PAYOUTS=true makes them start PENDING, like a real rail)
    def initiate_payout(self, req: PayoutRequest) -> PayoutResult:
        with LEDGER.lock:
            if req.reference in LEDGER.payouts:
                return LEDGER.payouts[req.reference]   # idempotent: a retry never pays twice
            async_ = os.environ.get("SANDBOX_ASYNC_PAYOUTS", "").lower() in ("1", "true")
            res = PayoutResult(req.reference, PayoutStatus.PENDING if async_ else PayoutStatus.COMPLETED, provider_ref="SBXO-" + req.reference[-8:], fee_kobo=0)
            LEDGER.payouts[req.reference], LEDGER.payout_amounts[req.reference] = res, req.amount_kobo
            if not async_:
                self._record_payout_txn(req.reference)
            return res

    def get_payout(self, reference: str) -> PayoutResult:
        try:
            return LEDGER.payouts[reference]
        except KeyError:
            raise ProviderRejected("payout not found", "404")

    def resolve_account(self, bank_code: str, account_number: str) -> PayoutDestination:
        if not (account_number.isdigit() and len(account_number) == 10):
            raise ProviderRejected("account number must be 10 digits", "422")
        return PayoutDestination(bank_code, account_number, f"SANDBOX ACCOUNT {account_number[-4:]}")

    # ---- statement
    def list_transactions(self, since: datetime, until: datetime) -> Iterator[ProviderTransaction]:
        with LEDGER.lock:
            rows = sorted((t for t in LEDGER.txns if since <= t.occurred_at < until), key=lambda t: (t.occurred_at, t.provider_ref))
        yield from rows

    # ---- helpers used by the dev endpoint and tests to simulate the outside world
    def _record_payout_txn(self, reference: str) -> None:
        LEDGER.add_txn(ProviderTransaction(provider_ref="SBXOT-" + reference, direction=Direction.OUTBOUND, amount_kobo=LEDGER.payout_amounts[reference],
                                           status=TxnStatus.SUCCESSFUL, occurred_at=utcnow(), reference=reference, fee_kobo=0))

    def _signed(self, payload: dict) -> tuple[dict[str, str], bytes]:
        body = json.dumps(payload, sort_keys=True).encode()
        return {"x-crew-signature": self.sign(body)}, body

    def simulate_credit(self, account_number: str, amount_kobo: int, payer_name: str = "Sandbox Payer", event_id: str | None = None,
                        record_on_statement: bool = True) -> tuple[dict[str, str], bytes]:
        """A payer transfers money into a virtual account. Returns the signed webhook the provider would send."""
        eid = event_id or "SBXEV-" + hashlib.sha256(f"{account_number}{amount_kobo}{utcnow().isoformat()}".encode()).hexdigest()[:12]
        if record_on_statement:
            with LEDGER.lock:
                LEDGER.add_txn(ProviderTransaction(provider_ref="SBXIN-" + eid, direction=Direction.INBOUND, amount_kobo=amount_kobo, status=TxnStatus.SUCCESSFUL,
                                                   occurred_at=utcnow(), account_number=account_number, counterparty=payer_name))
        return self._signed({"type": WebhookEventType.VIRTUAL_ACCOUNT_CREDIT.value, "eventId": eid, "providerRef": "SBXIN-" + eid, "accountNumber": account_number,
                             "amountKobo": amount_kobo, "payerName": payer_name, "occurredAt": utcnow().isoformat()})

    def complete_payout(self, reference: str, ok: bool = True) -> tuple[dict[str, str], bytes]:
        """The async payout settles. Returns the signed webhook."""
        with LEDGER.lock:
            old = LEDGER.payouts[reference]
            LEDGER.payouts[reference] = PayoutResult(reference, PayoutStatus.COMPLETED if ok else PayoutStatus.FAILED, old.provider_ref,
                                                     None if ok else "sandbox: simulated failure")
            if ok:
                self._record_payout_txn(reference)
        return self._signed({"type": (WebhookEventType.PAYOUT_COMPLETED if ok else WebhookEventType.PAYOUT_FAILED).value, "eventId": f"SBXPO-{reference}-{int(ok)}",
                             "reference": reference, "providerRef": old.provider_ref, "amountKobo": LEDGER.payout_amounts[reference],
                             "failureReason": None if ok else "simulated failure"})
