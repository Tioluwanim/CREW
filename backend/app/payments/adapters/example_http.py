"""ExamplePay - a FICTIONAL provider, invented to be deliberately unlike the sandbox, so it proves the port survives
real-world differences: naira DECIMAL amounts on the wire, its own status words, cursor pagination, an HMAC-SHA512
webhook signature, and a "merchant_ref" that echoes our reference. It is also the template to copy for a real adapter:
every `# MAP:` comment marks a place you translate between the provider's world and app/payments/domain.py.

It is NOT registered in the registry and never used at runtime; only the tests import it (with a fake HTTP server)."""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from typing import Iterator, Mapping

from app.payments.domain import (
    Capabilities, CollectionRequest, CollectionSession, CollectionMethod, CollectionStatus, Direction, ProviderTransaction, TxnStatus,
    VerificationResult, WebhookEvent, WebhookEventType, as_utc, from_provider_amount, to_provider_amount,
)
from app.payments.errors import MalformedPayload, ProviderRejected, SignatureInvalid
from app.payments.http import ProviderHttp, redact
from app.payments.ports import PaymentProvider

UNIT = "naira"   # MAP: the provider speaks decimal naira, we speak integer kobo


def _dt(s: str) -> datetime:
    return as_utc(datetime.fromisoformat(s.replace("Z", "+00:00")))


class ExamplePayProvider(PaymentProvider):
    name = "examplepay"
    reference_prefix = "EXP-"

    def __init__(self, http: ProviderHttp, webhook_secret: str):
        self.http, self.webhook_secret = http, webhook_secret

    @property
    def capabilities(self) -> Capabilities:
        return Capabilities(checkout=True, statement=True, webhooks=True, amount_unit=UNIT)   # honest: no VA, no payouts

    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        if req.method != CollectionMethod.CHECKOUT:
            from app.payments.errors import NotSupported
            raise NotSupported("examplepay: only checkout")
        body = {"merchant_ref": req.reference, "amount": str(to_provider_amount(req.amount_kobo, UNIT)), "currency": req.currency,
                "customer": {"name": req.customer.name, "email": req.customer.email}, "redirect_url": req.callback_url}
        # idempotent=True: this provider dedupes on merchant_ref, so a retried POST cannot double-charge.
        r = self.http.call("POST", "/v1/charges", json=body, idempotent=True)
        return CollectionSession(reference=req.reference, method=CollectionMethod.CHECKOUT, provider_ref=r["id"], checkout_url=r["checkout_url"])

    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        r = self.http.call("GET", f"/v1/charges/by-ref/{reference}")
        status = {"created": CollectionStatus.PENDING, "paid": CollectionStatus.SUCCEEDED, "failed": CollectionStatus.FAILED}.get(r["status"])   # MAP: status words
        if status is None:
            raise ProviderRejected(f"unknown charge status {r['status']!r}", "status")
        paid = status == CollectionStatus.SUCCEEDED
        return VerificationResult(status, from_provider_amount(r["amount_paid"], UNIT) if paid else None, r["id"],
                                  _dt(r["paid_at"]) if paid and r.get("paid_at") else None, from_provider_amount(r["fee"], UNIT) if paid and r.get("fee") else None)

    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha512).hexdigest()   # MAP: their signing scheme
        if not hmac.compare_digest(expected, headers.get("x-examplepay-signature", "")):
            raise SignatureInvalid("bad signature")

    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        try:
            d = json.loads(body)
            kind = {"charge.paid": WebhookEventType.COLLECTION_SUCCEEDED, "charge.failed": WebhookEventType.COLLECTION_FAILED}.get(d["event"], WebhookEventType.IGNORED)
            x = d["data"]
            return [WebhookEvent(event_id=d["id"], type=kind, occurred_at=_dt(x["paid_at"]) if x.get("paid_at") else as_utc(datetime.utcnow()),
                                 reference=x.get("merchant_ref"), provider_ref=x.get("id"),
                                 amount_kobo=from_provider_amount(x["amount"], UNIT) if x.get("amount") is not None else None, raw=redact(d))]
        except (KeyError, ValueError, TypeError) as e:
            raise MalformedPayload(f"examplepay webhook: {type(e).__name__}") from e

    def list_transactions(self, since: datetime, until: datetime) -> Iterator[ProviderTransaction]:
        cursor = None
        while True:   # MAP: their pagination -> a plain iterator
            page = self.http.call("GET", "/v1/ledger", params={"from": since.isoformat(), "to": until.isoformat(), **({"cursor": cursor} if cursor else {})})
            for it in page["items"]:
                yield ProviderTransaction(
                    provider_ref=it["id"], direction=Direction.INBOUND if it["type"] == "credit" else Direction.OUTBOUND,
                    amount_kobo=from_provider_amount(it["amount"], UNIT),
                    status={"ok": TxnStatus.SUCCESSFUL, "pending": TxnStatus.PENDING, "error": TxnStatus.FAILED, "reversed": TxnStatus.REVERSED}[it["status"]],
                    occurred_at=_dt(it["created_at"]), reference=it.get("merchant_ref"), account_number=it.get("account"))
            cursor = page.get("next_cursor")
            if not cursor:
                return
