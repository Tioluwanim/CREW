"""Virtual accounts, payouts, provider switching and reconciliation through the real API + sandbox provider."""
from dataclasses import replace
from datetime import timedelta

import pytest

from app import models
from app.payments import registry
from app.payments.adapters.sandbox import LEDGER, SandboxProvider
from app.payments.domain import Direction, ProviderTransaction, TxnStatus
from app.services import reconcile_runner

P, TOKEN = "project-asoebi", "demo-share-token-amara"
OPS = {"X-Cron-Secret": "ops-secret"}


@pytest.fixture(autouse=True)
def ops_secret(monkeypatch): monkeypatch.setenv("CRON_SECRET", "ops-secret")


def pay_invoice(client, auth, kind, ref):
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": kind}).json()
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": ref, "invoiceId": inv["id"], "amount": inv["amount"]})
    assert r.json()["status"] == "verified", r.text


def to_approved(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    pay_invoice(client, auth, "deposit", "SBX-DEP")
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_progress"})
    d = client.get(f"/api/projects/{P}", headers=auth).json()["deliverables"][0]["id"]
    client.post(f"/api/projects/{P}/deliverables/{d}/deliver", headers=auth)
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"})
    pay_invoice(client, auth, "balance", "SBX-BAL")
    assert client.post(f"/api/share/{TOKEN}/approve", json={}).json()["stage"] == "approved"


def stage(client, auth): return client.get(f"/api/projects/{P}", headers=auth).json()["stage"]
def received(client, auth): return client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()["receivedNaira"]
def transfer(client, auth, amount, event_id=None):
    return client.post("/api/dev/sandbox/transfer", headers=auth, json={"projectId": P, "amount": amount, "eventId": event_id}).json()


# ------------------------------------------------------------------------------ virtual accounts
def test_virtual_account_is_idempotent_and_shared_with_the_client_link(client, auth):
    a = client.post(f"/api/projects/{P}/virtual-account", headers=auth).json()
    b = client.post(f"/api/projects/{P}/virtual-account", headers=auth).json()
    c = client.post(f"/api/share/{TOKEN}/virtual-account").json()
    assert a["accountNumber"] == b["accountNumber"] == c["accountNumber"] and a["provider"] == "sandbox" and c["outstanding"] == 480_000
    assert len(client.get(f"/api/projects/{P}/virtual-account", headers=auth).json()) == 1


def test_transfer_into_virtual_account_is_matched_to_the_project_and_funds_it(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    client.post(f"/api/projects/{P}/virtual-account", headers=auth)
    out = transfer(client, auth, 192_000, "EV-1")
    assert out["events"][0]["outcome"] == "applied" and received(client, auth) == 192_000
    assert stage(client, auth) == "funded"
    again = transfer(client, auth, 192_000, "EV-1")                       # provider redelivers the webhook
    assert again["events"][0]["outcome"] == "duplicate" and received(client, auth) == 192_000


def test_transfers_that_break_the_rules_are_held_not_credited(client, auth, session_factory):
    client.post(f"/api/projects/{P}/virtual-account", headers=auth)
    assert transfer(client, auth, 500_000, "EV-OVER")["events"][0]["outcome"] == "held"          # more than the price
    with session_factory() as s:
        s.query(models.VirtualAccount).update({"expected_amount_kobo": 192_000 * 100}); s.commit()
    assert transfer(client, auth, 100_000, "EV-WRONG")["events"][0]["outcome"] == "held"         # not the invoiced amount
    assert received(client, auth) == 0
    kinds = [n["kind"] for n in client.get("/api/notifications", headers=auth).json()]
    assert kinds.count("payment_held") == 2
    held = client.get(f"/api/projects/{P}/payments", headers=auth).json()
    assert {x["status"] for x in held} == {"unverified"}


def test_credit_to_a_closed_account_is_held(client, auth):
    client.post(f"/api/projects/{P}/virtual-account", headers=auth)
    assert client.delete(f"/api/projects/{P}/virtual-account", headers=auth).status_code == 204
    assert transfer(client, auth, 100_000, "EV-CLOSED")["events"][0]["outcome"] == "held" and received(client, auth) == 0
    assert client.post(f"/api/projects/{P}/virtual-account", headers=auth).status_code == 201   # a fresh account can be opened


def test_unknown_account_is_acknowledged_but_stored_as_unmatched(client):
    headers, raw = SandboxProvider().simulate_credit("9999999999", 10_000, event_id="EV-GHOST")
    r = client.post("/api/webhooks/payments/sandbox", content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["events"][0]["outcome"] == "unmatched"              # 200 so the provider stops retrying


# ------------------------------------------------------------------------------ webhooks
def test_webhook_authentication_and_routing(client):
    headers, raw = SandboxProvider().simulate_credit("9999999999", 1, event_id="EV-AUTH")
    assert client.post("/api/webhooks/payments/sandbox", content=raw, headers={"x-crew-signature": "nope"}).status_code == 401
    assert client.post("/api/webhooks/payments/nosuchprovider", content=raw, headers=headers).status_code == 404
    assert client.post("/api/webhooks/payments/ecobank", content=raw, headers=headers).status_code == 502   # skeleton says so plainly
    assert client.post("/api/webhooks/payments/sandbox", content=b"garbage", headers={"x-crew-signature": SandboxProvider.sign(b"garbage")}).status_code == 400


# ------------------------------------------------------------------------------ payouts
def test_async_payout_stays_pending_until_the_provider_confirms(client, auth, monkeypatch):
    monkeypatch.setenv("SANDBOX_ASYNC_PAYOUTS", "true")
    to_approved(client, auth)
    rel = client.post(f"/api/projects/{P}/release", headers=auth).json()
    assert rel["released"] == [] and len(rel["pending"]) == 2 and rel["stage"] == "approved"
    assert {m["status"] for m in client.get(f"/api/projects/{P}/milestones", headers=auth).json()} == {"releasing"}
    again = client.post(f"/api/projects/{P}/release", headers=auth).json()            # impatient double-click
    assert again["pending"] == [] and again["released"] == []
    for p in rel["pending"]:
        assert client.post(f"/api/dev/sandbox/payouts/{p['reference']}/complete", headers=auth).status_code == 200
    assert stage(client, auth) == "released"
    rec = client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()
    assert rec["releasedNaira"] == 480_000 and rec["heldNaira"] == 0


def test_failed_payout_returns_money_to_held_and_can_be_retried_under_a_new_reference(client, auth, monkeypatch):
    monkeypatch.setenv("SANDBOX_ASYNC_PAYOUTS", "true")
    to_approved(client, auth)
    first = client.post(f"/api/projects/{P}/release", headers=auth).json()["pending"]
    bad = first[0]["reference"]
    client.post(f"/api/dev/sandbox/payouts/{bad}/complete?ok=false", headers=auth)
    assert "payout_failed" in [n["kind"] for n in client.get("/api/notifications", headers=auth).json()]
    retry = client.post(f"/api/projects/{P}/release", headers=auth).json()["pending"]
    assert len(retry) == 1 and retry[0]["reference"] != bad and retry[0]["reference"].endswith("-r1")


def test_sync_payout_releases_immediately(client, auth):
    to_approved(client, auth)
    rel = client.post(f"/api/projects/{P}/release", headers=auth).json()
    assert len(rel["released"]) == 2 and rel["pending"] == [] and rel["stage"] == "released"


# ------------------------------------------------------------------------------ switching fintechs
def test_switching_provider_does_not_strand_in_flight_payments(client, auth, monkeypatch):
    client.post(f"/api/share/{TOKEN}/agree")
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    ref = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": inv["id"]}).json()["reference"]
    monkeypatch.setenv("PAYMENT_PROVIDER", "ecobank")                                   # the business changes fintech mid-flight
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": ref, "amount": inv["amount"]})
    assert r.json()["status"] == "verified"                                              # still verified through its ORIGINAL provider
    new = client.post(f"/api/share/{TOKEN}/pay", json={"amount": 100})
    assert new.status_code == 502 and "Ecobank" in new.json()["error"]                    # new payments use the configured (unfinished) one
    info = client.get("/api/payments/providers", headers=auth).json()
    assert info["collections"] == "ecobank" and info["providers"]["sandbox"]["virtualAccounts"] and not info["providers"]["ecobank"]["checkout"]


def test_collections_and_payouts_can_use_different_fintechs(client, auth, monkeypatch):
    class Strict(SandboxProvider):
        name, reference_prefix = "strict", "STR-"
        @property
        def capabilities(self): return replace(super().capabilities, requires_payout_destination=True)
    registry.register("strict", Strict)
    try:
        monkeypatch.setenv("PAYOUT_PROVIDER", "strict")
        to_approved(client, auth)
        blocked = client.post(f"/api/projects/{P}/release", headers=auth)
        assert blocked.status_code == 422 and "payout bank account" in blocked.json()["error"]
        assert client.put("/api/profile/payout-account", headers=auth, json={"bankCode": "058", "accountNumber": "12345", "accountName": "x"}).status_code == 422
        acct = client.put("/api/profile/payout-account", headers=auth, json={"bankCode": "058", "accountNumber": "0123456789", "accountName": "typed wrong"}).json()
        assert acct["accountNumber"] == "******6789" and acct["verified"] and acct["accountName"] == "SANDBOX ACCOUNT 6789"   # the bank's name wins
        rel = client.post(f"/api/projects/{P}/release", headers=auth).json()
        assert len(rel["released"]) == 2 and all(r["reference"].startswith("STR-OUT-") for r in rel["released"])
        assert "0123456789" not in str(client.get("/api/profile/payout-account", headers=auth).json())
    finally:
        registry._factories.pop("strict")


# ------------------------------------------------------------------------------ reconciliation against the provider
def recon(client, hours=48, autopost=False): return client.post(f"/api/system/reconcile?hours={hours}&autopost={str(autopost).lower()}", headers=OPS).json()


def test_clean_books_reconcile_and_mark_payments(client, auth, session_factory):
    client.post(f"/api/share/{TOKEN}/agree")
    pay_invoice(client, auth, "deposit", "SBX-R1")
    run = recon(client)
    assert run["balanced"] and run["critical"] == 0 and run["matched"] == 1 and run["source"] == "statement"
    assert run["totals"]["internalInKobo"] == run["totals"]["externalInKobo"] == 192_000
    with session_factory() as s:
        assert s.query(models.Payment).filter(models.Payment.reconciled_at.is_not(None)).count() == 1


def test_missing_at_provider_is_critical_only_after_the_grace_period(client, auth, session_factory):
    client.post(f"/api/share/{TOKEN}/agree")
    pay_invoice(client, auth, "deposit", "SBX-R2")
    LEDGER.txns.clear()                                                                        # the provider has no record of it
    assert recon(client)["critical"] == 0                                                      # fresh: timing, not an alarm
    with session_factory() as s:
        r = reconcile_runner.run(s, "sandbox", now=models.utcnow() + timedelta(hours=7))
        assert r.critical_count == 1 and not r.balanced
        item = s.query(models.ReconciliationItem).filter_by(kind="missing_at_provider").one()
        assert item.severity == "critical" and item.project_id == P
        LEDGER.add_txn(ProviderTransaction("LATE", Direction.INBOUND, 192_000 * 100, TxnStatus.SUCCESSFUL, models.utcnow(), "SBX-R2"))
        reconcile_runner.run(s, "sandbox", now=models.utcnow() + timedelta(hours=8))
        s.refresh(item)
        assert item.status == "auto_resolved"                                                  # the statement caught up


def test_unrecorded_credit_lifecycle_with_scoped_visibility(client, auth):
    va = client.post(f"/api/projects/{P}/virtual-account", headers=auth).json()
    SandboxProvider().simulate_credit(va["accountNumber"], 5_000_000, event_id="EV-MISSED")            # ₦50,000; the webhook never arrived
    r1, r2 = recon(client), recon(client)
    items = client.get("/api/system/reconcile/items", headers=OPS).json()
    assert r1["critical"] == r2["critical"] == 1 and len(items) == 1, "the same problem across runs is ONE open item"
    assert items[0]["kind"] == "unrecorded_at_platform" and items[0]["projectId"] == P and items[0]["externalAccount"] == va["accountNumber"]
    mine = client.get("/api/reconciliation/items", headers=auth).json()
    assert len(mine) == 1 and "externalRef" not in mine[0] and "provider" not in mine[0]         # creators see their problem, not our plumbing
    other = client.post("/api/auth/register", json={"email": "q@x.com", "password": "password123"}).json()["accessToken"]
    assert client.get("/api/reconciliation/items", headers={"Authorization": f"Bearer {other}"}).json() == []
    fixed = client.post(f"/api/system/reconcile/items/{items[0]['id']}/resolve", headers=OPS, json={"action": "credit_to_project", "projectId": P, "note": "webhook lost"}).json()
    assert fixed["status"] == "resolved" and received(client, auth) == 50_000
    assert recon(client)["critical"] == 0 and client.get("/api/system/reconcile/items", headers=OPS).json() == []


def test_ignoring_needs_a_reason_and_credits_need_the_right_project(client, auth):
    va = client.post(f"/api/projects/{P}/virtual-account", headers=auth).json()
    SandboxProvider().simulate_credit(va["accountNumber"], 10_000, event_id="EV-X")
    recon(client)
    iid = client.get("/api/system/reconcile/items", headers=OPS).json()[0]["id"]
    assert client.post(f"/api/system/reconcile/items/{iid}/resolve", headers=OPS, json={"action": "ignore"}).status_code == 422
    assert client.post(f"/api/system/reconcile/items/{iid}/resolve", headers=OPS, json={"action": "credit_to_project", "projectId": "someone-elses"}).status_code == 422
    assert client.post(f"/api/system/reconcile/items/{iid}/resolve", headers=OPS, json={"action": "delete-it"}).status_code == 422
    ok = client.post(f"/api/system/reconcile/items/{iid}/resolve", headers=OPS, json={"action": "ignore", "note": "test transfer by ops"}).json()
    assert ok["status"] == "ignored" and ok["resolutionNote"] == "test transfer by ops"


def test_autopost_books_recoverable_credits_but_is_off_by_default(client, auth):
    va = client.post(f"/api/projects/{P}/virtual-account", headers=auth).json()
    SandboxProvider().simulate_credit(va["accountNumber"], 2_000_000, event_id="EV-AUTO")             # ₦20,000
    assert recon(client)["critical"] == 1 and received(client, auth) == 0                    # default: humans decide
    recon(client, autopost=True)
    assert received(client, auth) == 20_000 and client.get("/api/system/reconcile/items", headers=OPS).json() == []


def test_reconciliation_endpoints_are_operator_only(client, auth):
    assert client.post("/api/system/reconcile").status_code == 404
    assert client.get("/api/system/reconcile/items", headers={"X-Cron-Secret": "wrong"}).status_code == 404
    no_data = client.post("/api/system/reconcile?provider=ecobank", headers=OPS)                     # unfinished adapter: refuse, never "balanced"
    assert no_data.status_code == 422 and "cannot be reconciled" in no_data.json()["error"]
    assert client.post("/api/system/reconcile?provider=ghost", headers=OPS).status_code == 502


def test_provider_without_a_statement_falls_back_to_the_webhook_log_honestly(client, auth, monkeypatch):
    class NoStatement(SandboxProvider):
        name, reference_prefix = "nostmt", "NS-"
        @property
        def capabilities(self): return replace(super().capabilities, statement=False)
    registry.register("nostmt", NoStatement)
    try:
        monkeypatch.setenv("PAYMENT_PROVIDER", "nostmt")
        client.post(f"/api/share/{TOKEN}/agree")
        inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
        ref = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": inv["id"]}).json()["reference"]
        assert ref.startswith("NS-")
        import hashlib, hmac, json
        body = json.dumps({"reference": ref, "status": "verified", "amountKobo": inv["amount"] * 100}).encode()
        sig = hmac.new(b"dev-webhook-secret", body, hashlib.sha256).hexdigest()
        assert client.post("/api/webhooks/payments/nostmt", content=body, headers={"x-crew-signature": sig}).status_code == 200
        run = client.post("/api/system/reconcile?provider=nostmt", headers=OPS).json()
        assert run["source"] == "webhook_log" and run["balanced"] and run["matched"] == 1     # says HOW it checked, and that it's the weaker check
    finally:
        registry._factories.pop("nostmt")
