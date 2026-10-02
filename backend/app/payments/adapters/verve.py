"""Verve adapter - SKELETON. Nothing here talks to Verve; I have not seen its API contract and did not guess one.

To finish it, implement each method below using `ProviderHttp` (see app/payments/http.py) and translate to/from the
canonical types in app/payments/domain.py. Work through docs/PAYMENT_ADAPTERS.md (the mapping worksheet), flip the
matching `Capabilities` flags to True as you go, then run the contract kit (tests/test_adapter_contract_template.py shows how).

Env this adapter will read: VERVE_BASE_URL, VERVE_CLIENT_ID, VERVE_CLIENT_SECRET (+ VERVE_WEBHOOK_SECRET)."""
from __future__ import annotations

import os
from typing import Mapping

from app.payments.domain import Capabilities, CollectionRequest, CollectionSession, VerificationResult, WebhookEvent
from app.payments.errors import ProviderNotConfigured
from app.payments.ports import PaymentProvider


class VerveProvider(PaymentProvider):
    name = "verve"
    reference_prefix = "VRV-"

    def __init__(self):
        self.base_url = os.environ.get("VERVE_BASE_URL", "")
        self.client_id = os.environ.get("VERVE_CLIENT_ID", "")
        self.client_secret = os.environ.get("VERVE_CLIENT_SECRET", "")
        self.webhook_secret = os.environ.get("VERVE_WEBHOOK_SECRET", "")

    @property
    def capabilities(self) -> Capabilities:
        # Everything is False until the method is really implemented (the contract kit fails an adapter that over-claims).
        return Capabilities()

    def _todo(self, what: str):
        missing = [k for k, v in (("VERVE_BASE_URL", self.base_url), ("VERVE_CLIENT_ID", self.client_id), ("VERVE_CLIENT_SECRET", self.client_secret)) if not v]
        raise ProviderNotConfigured(f"Verve: {what} is not implemented yet" + (f" (and {', '.join(missing)} are not set)" if missing else ""))

    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        self._todo("create_collection")

    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        self._todo("verify_collection")

    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        self._todo("verify_webhook")

    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        self._todo("parse_webhook")

    # Optional - override when Verve supports them, then set the matching Capabilities flag:
    #   open_virtual_account / get_virtual_account / close_virtual_account
    #   initiate_payout / get_payout / resolve_account
    #   list_transactions   (needed for full reconciliation; without it the runner falls back to the stored webhook log)
