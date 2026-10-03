"""Ecobank Developer Portal REST adapter.

Ecobank exposes OAuth-style bearer authentication and collection/notification
APIs. Endpoint paths are configurable because the portal assigns products and
versions per merchant application; no provider response is treated as success
unless it explicitly contains a successful status.
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
    CollectionStatus, Customer, VerificationResult, WebhookEvent,
    WebhookEventType, from_provider_amount, to_provider_amount, as_utc,
)
from app.payments.errors import MalformedPayload, ProviderNotConfigured, ProviderRejected, SignatureInvalid
from app.payments.http import ProviderHttp
from app.payments.ports import PaymentProvider


def _iso(value: Any) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return as_utc(datetime.fromisoformat(str(value).replace("Z", "+00:00")))
    except ValueError:
        return datetime.now(timezone.utc)


class EcobankProvider(PaymentProvider):
    name = "ecobank"
    reference_prefix = "ECO-"

    def __init__(self, http: ProviderHttp | None = None):
        self.base_url = os.environ.get("ECOBANK_BASE_URL", "").rstrip("/")
        self.client_id = os.environ.get("ECOBANK_CLIENT_ID", "")
        self.client_secret = os.environ.get("ECOBANK_CLIENT_SECRET", "")
        self.webhook_secret = os.environ.get("ECOBANK_WEBHOOK_SECRET", "")
        self.token_path = os.environ.get("ECOBANK_TOKEN_PATH", "/get_api_token")
        self.collection_path = os.environ.get("ECOBANK_COLLECTION_PATH", "/v1/collection")
        self.verify_path = os.environ.get("ECOBANK_VERIFY_PATH", "/v1/collection/{reference}")
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
                ("ECOBANK_BASE_URL", self.base_url),
                ("ECOBANK_CLIENT_ID", self.client_id),
                ("ECOBANK_CLIENT_SECRET", self.client_secret),
            ) if not value]
            raise ProviderNotConfigured("Ecobank is not configured" + (f": {', '.join(missing)}" if missing else ""))
        return self.http  # type: ignore[return-value]

    def _access_token(self) -> str:
        http = self._require()
        if self._token:
            return self._token
        body = http.call(
            "POST", self.token_path,
            json={"client_id": self.client_id, "client_secret": self.client_secret},
            headers={"content-type": "application/json"},
            idempotent=False,
        )
        token = body.get("access_token") or body.get("token") if isinstance(body, dict) else None
        if not token:
            raise ProviderRejected("Ecobank authentication response did not contain an access token")
        self._token = str(token)
        return self._token

    def _call(self, method: str, path: str, **kwargs: Any) -> Any:
        http = self._require()
        headers = dict(kwargs.pop("headers", {}))
        headers["authorization"] = "Bearer " + self._access_token()
        try:
            return http.call(method, path, headers=headers, **kwargs)
        except ProviderRejected as exc:
            if exc.code in {"401", "403"}:
                self._token = None
            raise

    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        if req.method != CollectionMethod.CHECKOUT:
            raise ProviderRejected("Ecobank collection adapter currently supports checkout collections only")
        body = self._call("POST", self.collection_path, json={
            "merchantReference": req.reference,
            "amount": str(to_provider_amount(req.amount_kobo, "naira")),
            "currency": req.currency,
            "customer": {"name": req.customer.name, "email": req.customer.email, "phone": req.customer.phone},
            "description": req.narration,
            "callbackUrl": req.callback_url,
            "metadata": req.metadata,
        }, headers={"authorization": "Bearer " + self._access_token(), "idempotency-key": req.reference}, idempotent=True)
        if not isinstance(body, dict):
            raise ProviderRejected("Ecobank returned an invalid collection response")
        return CollectionSession(
            reference=req.reference,
            method=req.method,
            provider_ref=str(body.get("transactionId") or body.get("reference") or req.reference),
            checkout_url=body.get("checkoutUrl") or body.get("paymentUrl") or body.get("redirectUrl"),
            expires_at=req.expires_at,
        )

    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        body = self._call("GET", self.verify_path.format(reference=reference))
        if not isinstance(body, dict):
            raise ProviderRejected("Ecobank returned an invalid verification response")
        status = str(body.get("status") or body.get("paymentStatus") or "").lower()
        canonical = CollectionStatus.SUCCEEDED if status in {"success", "successful", "paid", "completed"} else (
            CollectionStatus.FAILED if status in {"failed", "declined", "cancelled"} else CollectionStatus.PENDING
        )
        amount = body.get("amount") or body.get("amountPaid")
        return VerificationResult(
            canonical,
            from_provider_amount(amount, "naira") if amount is not None else None,
            str(body.get("transactionId") or body.get("providerReference") or reference),
            _iso(body.get("paidAt") or body.get("transactionDate")) if canonical == CollectionStatus.SUCCEEDED else None,
        )

    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        if not self.webhook_secret:
            raise ProviderNotConfigured("ECOBANK_WEBHOOK_SECRET is not configured")
        signature = headers.get("x-ecobank-signature") or headers.get("x-signature") or ""
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise SignatureInvalid("invalid Ecobank webhook signature")

    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        try:
            payload = json.loads(body)
            rows = payload if isinstance(payload, list) else [payload]
            events = []
            for item in rows:
                status = str(item.get("status") or item.get("paymentStatus") or "").lower()
                event_type = WebhookEventType.COLLECTION_SUCCEEDED if status in {"success", "successful", "paid", "completed"} else (
                    WebhookEventType.COLLECTION_FAILED if status in {"failed", "declined", "cancelled"} else WebhookEventType.IGNORED
                )
                amount = item.get("amount") or item.get("amountPaid")
                events.append(WebhookEvent(
                    event_id=str(item.get("eventId") or item.get("id") or item.get("transactionId")),
                    type=event_type,
                    occurred_at=_iso(item.get("occurredAt") or item.get("transactionDate")),
                    reference=item.get("merchantReference") or item.get("reference"),
                    provider_ref=item.get("transactionId") or item.get("providerReference"),
                    amount_kobo=from_provider_amount(amount, "naira") if amount is not None else None,
                    failure_reason=item.get("failureReason") or item.get("message"),
                    raw=item,
                ))
            return events
        except (ValueError, TypeError, KeyError) as exc:
            raise MalformedPayload("Ecobank webhook payload is invalid") from exc
