"""Verve payments through the Interswitch merchant REST gateway.

Verve cards are routed through Interswitch's merchant APIs. The adapter uses
OAuth client credentials, idempotent merchant references, explicit verification,
and HMAC webhook validation. Product endpoint paths remain configurable for
merchant accounts using a different gateway version.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any, Mapping

from app.payments.domain import (
    Capabilities, CollectionMethod, CollectionRequest, CollectionSession,
    CollectionStatus, VerificationResult, WebhookEvent, WebhookEventType,
    from_provider_amount, to_provider_amount, as_utc,
)
from app.payments.errors import MalformedPayload, ProviderNotConfigured, ProviderRejected, SignatureInvalid
from app.payments.http import ProviderHttp
from app.payments.ports import PaymentProvider


def _date(value: Any) -> datetime:
    try:
        return as_utc(datetime.fromisoformat(str(value).replace("Z", "+00:00")))
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


class VerveProvider(PaymentProvider):
    name = "verve"
    reference_prefix = "VRV-"

    def __init__(self, http: ProviderHttp | None = None):
        self.base_url = os.environ.get("VERVE_BASE_URL", "").rstrip("/")
        self.client_id = os.environ.get("VERVE_CLIENT_ID", "")
        self.client_secret = os.environ.get("VERVE_CLIENT_SECRET", "")
        self.webhook_secret = os.environ.get("VERVE_WEBHOOK_SECRET", "")
        self.token_path = os.environ.get("VERVE_TOKEN_PATH", "/passport/oauth/token")
        self.collection_path = os.environ.get("VERVE_COLLECTION_PATH", "/api/v1/payments")
        self.verify_path = os.environ.get("VERVE_VERIFY_PATH", "/api/v1/payments/{reference}")
        self.http = http or (ProviderHttp(self.base_url) if self.base_url else None)
        self._token: str | None = None

    def _configured(self) -> bool:
        return bool(self.base_url and self.client_id and self.client_secret and self.http)

    @property
    def capabilities(self) -> Capabilities:
        configured = self._configured()
        return Capabilities(checkout=configured, webhooks=configured, amount_unit="naira")

    def _require(self) -> ProviderHttp:
        if not self._configured():
            missing = [key for key, value in (
                ("VERVE_BASE_URL", self.base_url),
                ("VERVE_CLIENT_ID", self.client_id),
                ("VERVE_CLIENT_SECRET", self.client_secret),
            ) if not value]
            raise ProviderNotConfigured("Verve is not configured" + (f": {', '.join(missing)}" if missing else ""))
        return self.http  # type: ignore[return-value]

    def _access_token(self) -> str:
        if self._token:
            return self._token
        body = self._require().call(
            "POST", self.token_path,
            json={"grant_type": "client_credentials"},
            headers={
                "authorization": "Basic " + __import__("base64").b64encode(
                    f"{self.client_id}:{self.client_secret}".encode()
                ).decode(),
                "content-type": "application/x-www-form-urlencoded",
            },
            idempotent=False,
        )
        token = body.get("access_token") if isinstance(body, dict) else None
        if not token:
            raise ProviderRejected("Verve authentication response did not contain an access token")
        self._token = str(token)
        return self._token

    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        if req.method != CollectionMethod.CHECKOUT:
            raise ProviderRejected("Verve adapter supports card checkout collections only")
        body = self._require().call("POST", self.collection_path, json={
            "merchantReference": req.reference,
            "amount": str(to_provider_amount(req.amount_kobo, "naira")),
            "currency": req.currency,
            "customer": {"name": req.customer.name, "email": req.customer.email, "phone": req.customer.phone},
            "narration": req.narration,
            "callbackUrl": req.callback_url,
            "metadata": req.metadata,
        }, headers={"authorization": "Bearer " + self._access_token(), "idempotency-key": req.reference}, idempotent=True)
        if not isinstance(body, dict):
            raise ProviderRejected("Verve returned an invalid collection response")
        return CollectionSession(
            req.reference, req.method,
            str(body.get("transactionReference") or body.get("transactionId") or req.reference),
            body.get("paymentUrl") or body.get("checkoutUrl") or body.get("redirectUrl"),
            expires_at=req.expires_at,
        )

    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        body = self._require().call(
            "GET", self.verify_path.format(reference=reference),
            headers={"authorization": "Bearer " + self._access_token()},
        )
        if not isinstance(body, dict):
            raise ProviderRejected("Verve returned an invalid verification response")
        status = str(body.get("responseCode") or body.get("status") or "").lower()
        canonical = CollectionStatus.SUCCEEDED if status in {"00", "success", "successful", "paid", "completed"} else (
            CollectionStatus.FAILED if status in {"failed", "declined", "cancelled"} else CollectionStatus.PENDING
        )
        amount = body.get("amount") or body.get("amountPaid")
        return VerificationResult(
            canonical,
            from_provider_amount(amount, "naira") if amount is not None else None,
            str(body.get("transactionReference") or body.get("transactionId") or reference),
            _date(body.get("paidAt") or body.get("transactionDate")) if canonical == CollectionStatus.SUCCEEDED else None,
        )

    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        if not self.webhook_secret:
            raise ProviderNotConfigured("VERVE_WEBHOOK_SECRET is not configured")
        signature = headers.get("x-verve-signature") or headers.get("x-interswitch-signature") or ""
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise SignatureInvalid("invalid Verve webhook signature")

    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        try:
            payload = json.loads(body)
            rows = payload if isinstance(payload, list) else [payload]
            result = []
            for item in rows:
                status = str(item.get("responseCode") or item.get("status") or "").lower()
                event_type = WebhookEventType.COLLECTION_SUCCEEDED if status in {"00", "success", "successful", "paid", "completed"} else (
                    WebhookEventType.COLLECTION_FAILED if status in {"failed", "declined", "cancelled"} else WebhookEventType.IGNORED
                )
                amount = item.get("amount") or item.get("amountPaid")
                result.append(WebhookEvent(
                    event_id=str(item.get("eventId") or item.get("id") or item.get("transactionId")),
                    type=event_type,
                    occurred_at=_date(item.get("occurredAt") or item.get("transactionDate")),
                    reference=item.get("merchantReference") or item.get("reference"),
                    provider_ref=item.get("transactionReference") or item.get("transactionId"),
                    amount_kobo=from_provider_amount(amount, "naira") if amount is not None else None,
                    failure_reason=item.get("failureReason") or item.get("message"),
                    raw=item,
                ))
            return result
        except (ValueError, TypeError, KeyError) as exc:
            raise MalformedPayload("Verve webhook payload is invalid") from exc
