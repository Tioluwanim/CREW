"""The same conformance suite, run against two adapters that share NOTHING in wire format. If a third adapter
(Paystack, OPay, Moniepoint, Ecobank, Verve) passes this file's pattern, the platform can use it."""
import hashlib
import hmac
import json
import re
from datetime import datetime, timezone

import pytest

from app.payments import registry
from app.payments.adapters.example_http import ExamplePayProvider
from app.payments.adapters.sandbox import SandboxProvider
from app.payments.contract import ProviderContract
from app.payments.domain import CollectionMethod, CollectionRequest, Customer, WebhookEventType
from app.payments.errors import NotSupported, ProviderAuthError, ProviderNotConfigured, ProviderRejected
from app.payments.http import HttpClient, HttpResponse, ProviderHttp

NOW = lambda: datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- 1) the sandbox
class TestSandboxContract(ProviderContract):
    PENDING_BEFORE_PAYMENT = False        # by design, SBX- references succeed immediately

    def make_provider(self): return SandboxProvider()
    def pay(self, provider, session, amount_kobo): pass

    def signed_webhook(self, provider, kind, **f):
        return provider._signed({"type": kind.value, "eventId": "EV-" + f["reference"], "reference": f["reference"], "amountKobo": f["amount_kobo"], "occurredAt": NOW()})


# ---------------------------------------------------------------- 2) a fictional provider on a fake HTTP server
class FakeExamplePayServer(HttpClient):
    """Speaks ExamplePay's (invented) API: decimal-naira strings, cursor pagination, HMAC-SHA512 webhooks."""
    def __init__(self):
        self.charges, self.ledger, self.calls, self.fail_next = {}, [], [], 0

    def mark_paid(self, ref, amount_kobo):
        c = self.charges[ref]
        c.update(status="paid", amount_paid=f"{amount_kobo / 100:.2f}", paid_at=NOW(), fee="10.00")
        self.ledger.append({"id": "led_" + c["id"], "type": "credit", "amount": c["amount_paid"], "status": "ok", "created_at": NOW(), "merchant_ref": ref})

    def request(self, method, url, *, headers=None, json=None, params=None, timeout=15.0):
        self.calls.append((method, url))
        if self.fail_next:
            self.fail_next -= 1
            return HttpResponse(503)
        path = url.split("api.examplepay.test", 1)[1]
        if method == "POST" and path == "/v1/charges":
            ref = json["merchant_ref"]
            assert re.fullmatch(r"\d+\.\d{2}", json["amount"]), "amount must go over the wire as decimal naira"
            self.charges.setdefault(ref, {"id": "chg_" + ref[-6:], "status": "created", "amount": json["amount"]})
            return HttpResponse(201, {"id": self.charges[ref]["id"], "checkout_url": f"https://pay.examplepay.test/{ref}"})
        if method == "GET" and path.startswith("/v1/charges/by-ref/"):
            c = self.charges.get(path.rsplit("/", 1)[1])
            return HttpResponse(200, c) if c else HttpResponse(404, {"message": "no such charge"})
        if method == "GET" and path == "/v1/ledger":
            start = int(params.get("cursor", 0))
            page = self.ledger[start:start + 2]                     # tiny pages force the adapter to paginate
            nxt = str(start + 2) if start + 2 < len(self.ledger) else None
            return HttpResponse(200, {"items": page, "next_cursor": nxt})
        return HttpResponse(404, {"message": "unknown route"})


SECRET = "examplepay-webhook-secret"


class TestExamplePayContract(ProviderContract):
    def setup_method(self): self.server = FakeExamplePayServer()

    def make_provider(self):
        return ExamplePayProvider(ProviderHttp("https://api.examplepay.test", self.server, sleep=lambda s: None), SECRET)

    def pay(self, provider, session, amount_kobo): self.server.mark_paid(session.reference, amount_kobo)

    def signed_webhook(self, provider, kind, **f):
        body = json.dumps({"event": "charge.paid" if kind == WebhookEventType.COLLECTION_SUCCEEDED else "charge.failed", "id": "evt_" + f["reference"],
                           "data": {"merchant_ref": f["reference"], "amount": f"{f['amount_kobo'] / 100:.2f}", "id": "chg_1", "paid_at": NOW()}}).encode()
        return {"x-examplepay-signature": hmac.new(SECRET.encode(), body, hashlib.sha512).hexdigest()}, body

    # things only THIS adapter can prove
    def test_amounts_cross_the_wire_as_decimal_naira_but_return_as_kobo(self):
        p = self.make_provider()
        s = p.create_collection(CollectionRequest("EXP-WIRE", 150_050, Customer("A")))
        self.server.mark_paid(s.reference, 150_050)
        assert self.server.charges["EXP-WIRE"]["amount"] == "1500.50" and p.verify_collection("EXP-WIRE").amount_kobo == 150_050

    def test_statement_paginates_across_pages(self):
        p = self.make_provider()
        for i in range(5):
            s = p.create_collection(CollectionRequest(f"EXP-PG{i}", 10_000 * (i + 1), Customer("A")))
            self.server.mark_paid(s.reference, 10_000 * (i + 1))
        rows = list(p.list_transactions(datetime(2020, 1, 1, tzinfo=timezone.utc), datetime(2100, 1, 1, tzinfo=timezone.utc)))
        assert len(rows) == 5 and [r.amount_kobo for r in rows] == [10_000, 20_000, 30_000, 40_000, 50_000]

    def test_fee_is_reported_separately_from_the_gross_amount(self):
        p = self.make_provider()
        s = p.create_collection(CollectionRequest("EXP-FEE", 100_000, Customer("A")))
        self.server.mark_paid(s.reference, 100_000)
        v = p.verify_collection(s.reference)
        assert v.amount_kobo == 100_000 and v.fee_kobo == 1_000

    def test_transient_outage_is_retried_for_reads_and_for_the_idempotent_create(self):
        p = self.make_provider()
        self.server.fail_next = 2
        assert p.create_collection(CollectionRequest("EXP-RETRY", 5_000, Customer("A"))).checkout_url
        self.server.fail_next = 1
        assert p.verify_collection("EXP-RETRY").status.value == "pending"

    def test_unsupported_method_and_unknown_charge_are_clean_errors(self):
        p = self.make_provider()
        with pytest.raises(NotSupported):
            p.create_collection(CollectionRequest("EXP-VA", 1_000, Customer("A"), method=CollectionMethod.VIRTUAL_ACCOUNT))
        with pytest.raises(ProviderRejected):
            p.verify_collection("EXP-DOESNOTEXIST")


# ---------------------------------------------------------------- 3) the two rails you are building next
@pytest.mark.parametrize("name", ["ecobank", "verve"])
def test_skeleton_adapters_are_honest(name):
    p = registry.get(name)
    caps = p.capabilities
    assert not any([caps.checkout, caps.virtual_accounts, caps.payouts, caps.statement, caps.webhooks, caps.account_name_lookup]), "a skeleton must not claim what it can't do"
    for call in (lambda: p.create_collection(CollectionRequest("X", 100, Customer("A"))), lambda: p.verify_collection("X"),
                 lambda: p.verify_webhook({}, b"{}"), lambda: p.parse_webhook(b"{}")):
        with pytest.raises(ProviderNotConfigured) as e:
            call()
        assert name.capitalize() in str(e.value)
    with pytest.raises(NotSupported):
        p.open_virtual_account(None)
    assert p.reference_prefix and p.name == name


def test_registry_lists_providers_and_rejects_unknown_names():
    assert {"sandbox", "ecobank", "verve"} <= set(registry.known())
    with pytest.raises(ProviderNotConfigured):
        registry.get("paystack-not-written-yet")


def test_new_provider_is_one_registration_away():
    registry.register("examplepay", lambda: ExamplePayProvider(ProviderHttp("https://api.examplepay.test", FakeExamplePayServer()), SECRET))
    try:
        assert registry.get("examplepay").capabilities.amount_unit == "naira"
    finally:
        registry._factories.pop("examplepay")
