import smtplib
from datetime import timedelta

import pytest

from app import models
from app.services import messaging, sweeps
from intelligence.dates import today_lagos

P, TOKEN = "project-asoebi", "demo-share-token-amara"


def _sent_invoice(client, auth, kind="deposit"):
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": kind}).json()
    return inv, client.post(f"/api/invoices/{inv['id']}/send", headers=auth).json()


# ---------------------------------------------------------------- outbox
def test_invoice_send_queues_and_logs_email_honestly(client, auth):
    inv, sent = _sent_invoice(client, auth)
    assert sent["clientHasEmail"] and sent["emailQueued"] and sent["delivery"]["logged"] == 1   # console fallback
    msgs = client.get(f"/api/projects/{P}/messages", headers=auth).json()
    assert msgs[0]["kind"] == "invoice_sent" and msgs[0]["status"] == "logged"                  # NOT "sent"
    body = msgs[0]
    assert "recipient" not in body and "body" not in body                                       # list view never leaks content


def test_no_email_means_no_message(client, auth):
    body = {"name": "Walk-in", "clientName": "NoEmail", "revenue": 100_000, "depositPct": 50}
    pid = client.post("/api/projects", headers=auth, json=body).json()["id"]
    inv = client.post(f"/api/projects/{pid}/invoices", headers=auth, json={"kind": "deposit"}).json()
    sent = client.post(f"/api/invoices/{inv['id']}/send", headers=auth).json()
    assert sent["emailQueued"] is False and sent["clientHasEmail"] is False
    assert client.post(f"/api/invoices/{inv['id']}/remind", headers=auth).status_code == 422


def test_reminder_once_per_day_and_only_when_sent(client, auth):
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    assert client.post(f"/api/invoices/{inv['id']}/remind", headers=auth).status_code == 409   # still draft
    client.post(f"/api/invoices/{inv['id']}/send", headers=auth)
    assert client.post(f"/api/invoices/{inv['id']}/remind", headers=auth).status_code == 200
    assert client.post(f"/api/invoices/{inv['id']}/remind", headers=auth).status_code == 429


def test_receipt_queued_when_payment_verifies(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    inv, _ = _sent_invoice(client, auth)
    client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-RCPT", "invoiceId": inv["id"], "amount": inv["amount"]})
    kinds = [m["kind"] for m in client.get(f"/api/projects/{P}/messages", headers=auth).json()]
    assert "payment_receipt" in kinds


def test_failed_delivery_is_kept_and_retried(client, auth, session_factory, monkeypatch):
    class Boom:
        name = "smtp"
        def send(self, msg): raise smtplib.SMTPException("down")
    monkeypatch.setattr(messaging, "sender_for", lambda ch: Boom())
    _sent_invoice(client, auth)
    msg = client.get(f"/api/projects/{P}/messages", headers=auth).json()[0]
    assert msg["status"] == "failed" and msg["attempts"] == 1 and msg["lastError"] == "SMTPException"
    monkeypatch.undo()
    with session_factory() as s:
        assert messaging.deliver_pending(s)["logged"] == 1                                       # retried, now delivered
    assert client.get(f"/api/projects/{P}/messages", headers=auth).json()[0]["status"] == "logged"


def test_sms_channel_fails_clearly_until_a_provider_exists(client, auth, session_factory):
    with session_factory() as s:
        s.add(models.Message(owner_id=s.get(models.Project, P).owner_id, project_id=P, kind="invoice_reminder", channel="sms", recipient="+2348000000000", body="x"))
        s.commit()
        assert messaging.deliver_pending(s)["failed"] == 1
        m = s.query(models.Message).filter_by(channel="sms").one()
        assert "No provider configured" in m.last_error


def test_smtp_sender_uses_configured_server(monkeypatch):
    calls = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout): calls["host"] = (host, port)
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def starttls(self): calls["tls"] = True
        def login(self, u, p): calls["login"] = u
        def send_message(self, m): calls["to"] = m["To"]; calls["from"] = m["From"]
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com"); monkeypatch.setenv("SMTP_USER", "u"); monkeypatch.setenv("SMTP_PASSWORD", "p")
    monkeypatch.setenv("SMTP_FROM", "hello@crew.test")
    sender = messaging.sender_for("email")
    assert sender.name == "smtp"
    sender.send(models.Message(recipient="teni@example.com", subject="s", body="b", kind="invoice_sent", owner_id="o", project_id="p"))
    assert calls == {"host": ("smtp.example.com", 587), "tls": True, "login": "u", "to": "teni@example.com", "from": "hello@crew.test"}


# ---------------------------------------------------------------- idempotency
def test_idempotent_project_create(client, auth):
    body = {"name": "Once", "clientName": "Ade", "revenue": 200_000, "depositPct": 50}
    h = {**auth, "Idempotency-Key": "key-123"}
    a = client.post("/api/projects", headers=h, json=body)
    b = client.post("/api/projects", headers=h, json=body)
    assert a.status_code == b.status_code == 201 and a.json()["id"] == b.json()["id"] and b.headers["Idempotent-Replay"] == "true"
    assert sum(p["name"] == "Once" for p in client.get("/api/projects", headers=auth).json()) == 1
    clash = client.post("/api/projects", headers=h, json={**body, "revenue": 999_000})
    assert clash.status_code == 422 and "different request" in clash.json()["error"]


def test_idempotent_invoice_and_share_pay(client, auth):
    h = {**auth, "Idempotency-Key": "inv-1"}
    a = client.post(f"/api/projects/{P}/invoices", headers=h, json={"kind": "deposit"}).json()
    b = client.post(f"/api/projects/{P}/invoices", headers=h, json={"kind": "deposit"}).json()
    assert a["id"] == b["id"] and len(client.get(f"/api/projects/{P}/invoices", headers=auth).json()) == 1
    client.post(f"/api/share/{TOKEN}/agree")
    r1 = client.post(f"/api/share/{TOKEN}/pay", headers={"Idempotency-Key": "p-1"}, json={"invoiceId": a["id"]}).json()
    r2 = client.post(f"/api/share/{TOKEN}/pay", headers={"Idempotency-Key": "p-1"}, json={"invoiceId": a["id"]}).json()
    assert r1["reference"] == r2["reference"]
    assert len(client.get(f"/api/projects/{P}/payments", headers=auth).json()) == 1


def test_no_key_still_works_and_scopes_are_per_user(client, auth):
    body = {"name": "NoKey", "clientName": "Ade", "revenue": 50_000}
    assert client.post("/api/projects", headers=auth, json=body).status_code == 201
    other = client.post("/api/auth/register", json={"email": "z@x.com", "password": "password123"}).json()["accessToken"]
    h2 = {"Authorization": f"Bearer {other}", "Idempotency-Key": "shared-key"}
    h1 = {**auth, "Idempotency-Key": "shared-key"}
    a = client.post("/api/projects", headers=h1, json=body).json()["id"]
    b = client.post("/api/projects", headers=h2, json=body).json()["id"]
    assert a != b                                                                               # same key, different users


def test_old_idempotency_keys_are_purged(client, auth, session_factory):
    client.post("/api/projects", headers={**auth, "Idempotency-Key": "old"}, json={"name": "x", "clientName": "y", "revenue": 10_000})
    with session_factory() as s:
        s.query(models.IdempotencyKey).update({"created_at": models.utcnow() - timedelta(hours=30)})
        s.commit()
        sweeps.run(s)
        assert s.query(models.IdempotencyKey).count() == 0


# ---------------------------------------------------------------- auth hardening
def test_lockout_after_repeated_failures(client):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "wrong-password"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "crew-demo-1234"})
    assert r.status_code == 429                                                                 # even the right password is refused while locked


def test_success_resets_failure_counter(client):
    for _ in range(4):
        client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "nope-nope"})
    assert client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "crew-demo-1234"}).status_code == 200
    for _ in range(4):
        assert client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "nope-nope"}).status_code == 401


def test_change_password_revokes_old_tokens(client, auth):
    assert client.get("/api/dashboard", headers=auth).status_code == 200
    assert client.post("/api/auth/change-password", headers=auth, json={"currentPassword": "bad", "newPassword": "brand-new-pass"}).status_code == 401
    r = client.post("/api/auth/change-password", headers=auth, json={"currentPassword": "crew-demo-1234", "newPassword": "brand-new-pass"})
    new = {"Authorization": f"Bearer {r.json()['accessToken']}"}
    assert client.get("/api/dashboard", headers=auth).status_code == 401                        # old token dead
    assert client.get("/api/dashboard", headers=new).status_code == 200
    assert client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "brand-new-pass"}).status_code == 200


def test_logout_all(client, auth):
    assert client.post("/api/auth/logout-all", headers=auth).status_code == 204
    assert client.get("/api/dashboard", headers=auth).status_code == 401


# ---------------------------------------------------------------- data-subject rights
def test_export_contains_everything_and_no_secrets(client, auth):
    d = client.get("/api/me/export", headers=auth).json()
    assert d["account"]["email"] == "amara@crew.demo" and len(d["projects"]) == 3 and len(d["clients"]) == 2
    text = str(d)
    assert "password" not in text.lower() and "scrypt$" not in text and TOKEN not in text


def test_account_erasure(client, auth, session_factory):
    assert client.request("DELETE", "/api/me", headers=auth, json={"password": "wrong", "confirm": "DELETE"}).status_code == 401
    assert client.request("DELETE", "/api/me", headers=auth, json={"password": "crew-demo-1234", "confirm": "yes"}).status_code == 422
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-GONE", "invoiceId": inv["id"], "amount": inv["amount"]})
    assert client.request("DELETE", "/api/me", headers=auth, json={"password": "crew-demo-1234", "confirm": "DELETE"}).status_code == 204
    assert client.get(f"/api/share/{TOKEN}").status_code == 404                                 # client link died with the account
    assert client.post("/api/auth/login", json={"email": "amara@crew.demo", "password": "crew-demo-1234"}).status_code == 401
    with session_factory() as s:
        for m in (models.User, models.Project, models.Client, models.Payment, models.Transaction, models.ShareLink,
                  models.ActivityEvent, models.Message, models.Notification, models.Cost, models.Milestone, models.CreativeProfile):
            assert s.query(m).count() == 0, m.__tablename__


def test_erasure_leaves_other_users_alone(client, auth, session_factory):
    other = client.post("/api/auth/register", json={"email": "keep@x.com", "password": "password123", "businessName": "Keeper"}).json()["accessToken"]
    h = {"Authorization": f"Bearer {other}"}
    pid = client.post("/api/projects", headers=h, json={"name": "Mine", "clientName": "C", "revenue": 10_000}).json()["id"]
    client.request("DELETE", "/api/me", headers=auth, json={"password": "crew-demo-1234", "confirm": "DELETE"})
    assert client.get(f"/api/projects/{pid}", headers=h).status_code == 200
