"""Adapter conformance test-kit. Subclass `ProviderContract` in a test module, fill in the hooks, and pytest runs the
whole suite against your adapter:

    class TestMyAdapter(ProviderContract):
        def make_provider(self): ...                       # build the adapter (with a fake HTTP server, or sandbox creds)
        def pay(self, provider, session, amount_kobo): ... # make the payer's payment happen on the provider side
        def signed_webhook(self, provider, kind, **f): ... # -> (headers, body) exactly as the provider would send it

It checks the promises the rest of the platform relies on: honest capabilities, integer kobo, idempotency, canonical
webhook events, statement pagination that terminates, and errors that stay inside the ProviderError family."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.payments.domain import (
    CollectionMethod, CollectionRequest, CollectionStatus, Customer, Direction, PayoutRequest, PayoutStatus, ProviderTransaction,
    VirtualAccountRequest, WebhookEventType,
)
from app.payments.errors import NotSupported, ProviderError, SignatureInvalid
from app.payments.ports import PaymentProvider


class ProviderContract:
    AMOUNT = 150_000   # kobo
    PENDING_BEFORE_PAYMENT = True   # the sandbox auto-succeeds SBX- references, so its test module sets this False

    # ---- hooks each adapter's test module provides -------------------------------------------------
    def make_provider(self) -> PaymentProvider: raise NotImplementedError
    def pay(self, provider: PaymentProvider, session, amount_kobo: int) -> None: raise NotImplementedError
    def signed_webhook(self, provider: PaymentProvider, kind: WebhookEventType, **fields) -> tuple[dict[str, str], bytes]: raise NotImplementedError

    # ---- helpers ------------------------------------------------------------------------------------
    def _req(self, provider, ref: str, method=CollectionMethod.CHECKOUT) -> CollectionRequest:
        return CollectionRequest(reference=provider.reference_prefix + ref, amount_kobo=self.AMOUNT, customer=Customer("Test Payer", "t@example.com"), method=method)

    # ---- identity / capabilities --------------------------------------------------------------------
    def test_identity(self):
        p = self.make_provider()
        assert p.name and p.name == p.name.lower() and " " not in p.name
        assert p.reference_prefix and p.capabilities.amount_unit in ("kobo", "naira")

    def test_unclaimed_capabilities_raise_not_supported(self):
        p, c = self.make_provider(), self.make_provider().capabilities
        probes = [(c.virtual_accounts, lambda: p.open_virtual_account(VirtualAccountRequest("r", Customer("x")))),
                  (c.payouts, lambda: p.initiate_payout(PayoutRequest("r", 100, None))),
                  (c.account_name_lookup, lambda: p.resolve_account("000", "0123456789")),
                  (c.statement, lambda: list(p.list_transactions(datetime.now(timezone.utc) - timedelta(days=1), datetime.now(timezone.utc))))]
        for claimed, call in probes:
            if not claimed:
                with pytest.raises(NotSupported):
                    call()

    # ---- collections --------------------------------------------------------------------------------
    def test_collection_lifecycle_and_kobo_integrity(self):
        p = self.make_provider()
        s = p.create_collection(self._req(p, "LIFE1"))
        assert s.reference == p.reference_prefix + "LIFE1"
        if self.PENDING_BEFORE_PAYMENT:
            assert p.verify_collection(s.reference, self.AMOUNT).status == CollectionStatus.PENDING, "unpaid must be PENDING, not an error"
        self.pay(p, s, self.AMOUNT)
        v = p.verify_collection(s.reference, self.AMOUNT)
        assert v.status == CollectionStatus.SUCCEEDED
        assert isinstance(v.amount_kobo, int) and v.amount_kobo == self.AMOUNT, "amount must be exact integer kobo"

    def test_verify_is_repeatable(self):
        p = self.make_provider()
        s = p.create_collection(self._req(p, "REPEAT"))
        self.pay(p, s, self.AMOUNT)
        a, b = p.verify_collection(s.reference, self.AMOUNT), p.verify_collection(s.reference, self.AMOUNT)
        assert (a.status, a.amount_kobo, a.provider_ref) == (b.status, b.amount_kobo, b.provider_ref)   # timestamps may differ

    def test_create_collection_is_idempotent(self):
        p = self.make_provider()
        a, b = p.create_collection(self._req(p, "IDEM")), p.create_collection(self._req(p, "IDEM"))
        assert a.reference == b.reference and a.provider_ref == b.provider_ref

    # ---- webhooks -----------------------------------------------------------------------------------
    def test_webhook_authentication(self):
        p = self.make_provider()
        headers, body = self.signed_webhook(p, WebhookEventType.COLLECTION_SUCCEEDED, reference=p.reference_prefix + "WH1", amount_kobo=self.AMOUNT)
        p.verify_webhook(headers, body)                                    # authentic -> no exception
        with pytest.raises(SignatureInvalid):
            p.verify_webhook(headers, body + b" ")                         # tampered body
        with pytest.raises(SignatureInvalid):
            p.verify_webhook({}, body)                                     # missing signature

    def test_webhook_parses_to_canonical_events(self):
        p = self.make_provider()
        headers, body = self.signed_webhook(p, WebhookEventType.COLLECTION_SUCCEEDED, reference=p.reference_prefix + "WH2", amount_kobo=self.AMOUNT)
        ev = p.parse_webhook(body)
        assert ev and ev[0].type == WebhookEventType.COLLECTION_SUCCEEDED and ev[0].reference == p.reference_prefix + "WH2"
        assert ev[0].amount_kobo == self.AMOUNT and ev[0].event_id and ev[0].occurred_at.tzinfo is not None

    def test_garbage_webhook_is_a_provider_error_not_a_crash(self):
        p = self.make_provider()
        with pytest.raises(ProviderError):
            p.parse_webhook(b"not json at all")

    # ---- virtual accounts ---------------------------------------------------------------------------
    def test_virtual_account_roundtrip(self):
        p = self.make_provider()
        if not p.capabilities.virtual_accounts:
            pytest.skip("adapter does not claim virtual accounts")
        r = VirtualAccountRequest("VA-CONTRACT-1", Customer("Project Client"))
        a, b = p.open_virtual_account(r), p.open_virtual_account(r)
        assert a.details.account_number and a.details.account_number == b.details.account_number, "must be idempotent on reference"
        assert p.get_virtual_account(r.reference).details.account_number == a.details.account_number
        assert p.close_virtual_account(r.reference).status.value == "closed"

    # ---- payouts ------------------------------------------------------------------------------------
    def test_payout_is_idempotent(self):
        p = self.make_provider()
        if not p.capabilities.payouts:
            pytest.skip("adapter does not claim payouts")
        dest = p.resolve_account("000", "0123456789") if p.capabilities.account_name_lookup else None
        req = PayoutRequest(p.reference_prefix + "PAYOUT1", 50_000, dest)
        first, again = p.initiate_payout(req), p.initiate_payout(req)
        assert first.provider_ref == again.provider_ref, "a retried payout must not pay twice"
        assert first.status in (PayoutStatus.PENDING, PayoutStatus.COMPLETED)

    # ---- statement ----------------------------------------------------------------------------------
    def test_statement_is_iterable_gross_kobo_and_terminates(self):
        p = self.make_provider()
        if not p.capabilities.statement:
            pytest.skip("adapter does not claim a statement")
        s = p.create_collection(self._req(p, "STMT1"))
        self.pay(p, s, self.AMOUNT)
        p.verify_collection(s.reference, self.AMOUNT)
        now = datetime.now(timezone.utc)
        rows = list(p.list_transactions(now - timedelta(days=1), now + timedelta(days=1)))
        assert rows and all(isinstance(r, ProviderTransaction) and isinstance(r.amount_kobo, int) and r.occurred_at.tzinfo for r in rows)
        assert all(r.direction in (Direction.INBOUND, Direction.OUTBOUND) for r in rows)
        assert len({r.provider_ref for r in rows}) == len(rows), "provider_ref must be unique per line"
