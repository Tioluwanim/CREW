import hashlib
import hmac
import json

from app import models

TOKEN = "demo-share-token-amara"
P = "project-asoebi"


def _stage(client, auth):
    return client.get(f"/api/projects/{P}", headers=auth).json()["stage"]


def test_full_lifecycle_through_client_link(client, auth):
    # client agrees to scope via the no-signup link
    assert client.post(f"/api/share/{TOKEN}/agree").json()["stage"] == "agreed"
    proj = client.get(f"/api/projects/{P}", headers=auth).json()
    assert proj["stage"] == "agreed"
    # cannot start before the deposit lands
    assert client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_progress"}).status_code == 409
    # deposit invoice -> client pays through link -> verified -> auto funded
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    assert inv["amount"] == 192_000
    client.post(f"/api/invoices/{inv['id']}/send", headers=auth)
    intent = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": inv["id"]}).json()
    v = client.post(f"/api/share/{TOKEN}/pay/{intent['reference']}/verify").json()
    assert v["status"] == "verified"
    assert _stage(client, auth) == "funded"
    # verifying twice is idempotent
    client.post(f"/api/share/{TOKEN}/pay/{intent['reference']}/verify")
    assert client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()["receivedNaira"] == 192_000
    # work
    assert client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_progress"}).status_code == 200
    d = client.get(f"/api/projects/{P}", headers=auth).json()["deliverables"][0]
    assert client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"}).status_code == 409  # nothing delivered yet
    client.post(f"/api/projects/{P}/deliverables/{d['id']}/deliver", headers=auth)
    assert client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"}).status_code == 200
    # client pays the balance, then approves
    bal = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "balance"}).json()
    client.post(f"/api/invoices/{bal['id']}/send", headers=auth)
    i2 = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": bal["id"]}).json()
    client.post(f"/api/share/{TOKEN}/pay/{i2['reference']}/verify")
    # cannot release before approval
    assert client.post(f"/api/projects/{P}/release", headers=auth).status_code == 409
    assert client.post(f"/api/share/{TOKEN}/approve", json={}).json()["stage"] == "approved"
    rel = client.post(f"/api/projects/{P}/release", headers=auth).json()
    assert sum(r["amount"] for r in rel["released"]) == 480_000 and rel["stage"] == "released"
    assert client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "closed"}).status_code == 200
    rec = client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()
    assert rec["heldNaira"] == 0 and rec["outstandingNaira"] == 0 and rec["balanced"]
    tl = client.get(f"/api/projects/{P}/timeline", headers=auth).json()
    assert tl["integrity"]["intact"] and len(tl["events"]) >= 10


def test_client_view_hides_costs_and_margin(client):
    body = json.dumps(client.get(f"/api/share/{TOKEN}").json())
    assert "Materials" not in body and "profit" not in body.lower() and "costs" not in body


def test_revisions_over_scope_flag_and_change_request(client, auth, session_factory):
    client.post(f"/api/share/{TOKEN}/agree")
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-REVTEST", "invoiceId": inv["id"], "amount": inv["amount"]})
    assert r.json()["status"] == "verified"
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_progress"})
    d = client.get(f"/api/projects/{P}", headers=auth).json()["deliverables"][0]["id"]
    results = []
    for n in range(3):
        client.post(f"/api/projects/{P}/deliverables/{d}/deliver", headers=auth)
        client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"})
        results.append(client.post(f"/api/share/{TOKEN}/revision", json={"deliverableId": d, "note": f"tweak {n}"}).json())
    assert [x["withinScope"] for x in results] == [True, True, False]
    notes = client.get("/api/notifications", headers=auth).json()
    assert any(n["kind"] == "revision_over_scope" for n in notes)
    # creator proposes a priced change, client accepts -> price and milestones grow
    cr = client.post(f"/api/projects/{P}/change-requests", headers=auth, json={"title": "Extra outfit", "amount": 40_000}).json()
    out = client.post(f"/api/share/{TOKEN}/change-requests/{cr['id']}/accept").json()
    assert out["status"] == "accepted"
    proj = client.get(f"/api/projects/{P}", headers=auth).json()
    assert proj["revenue"] == 520_000 and any(m["title"].startswith("Change:") for m in proj["milestones"])


def test_timeline_tamper_detection(client, auth, session_factory):
    client.post(f"/api/share/{TOKEN}/agree")
    assert client.get(f"/api/projects/{P}/timeline", headers=auth).json()["integrity"]["intact"]
    with session_factory() as s:
        ev = s.query(models.ActivityEvent).filter_by(project_id=P).first()
        ev.label = "edited after the fact"
        s.commit()
    assert not client.get(f"/api/projects/{P}/timeline", headers=auth).json()["integrity"]["intact"]


def test_owner_isolation_and_auth(client, auth):
    assert client.get("/api/projects").status_code == 401
    other = client.post("/api/auth/register", json={"email": "b@x.com", "password": "password123"}).json()["accessToken"]
    h = {"Authorization": f"Bearer {other}"}
    assert client.get(f"/api/projects/{P}", headers=h).status_code == 404
    assert client.get("/api/projects", headers=h).json() == []
    assert client.post("/api/auth/register", json={"email": "b@x.com", "password": "password123"}).status_code == 409


def test_revoked_link_stops_working(client, auth):
    client.post(f"/api/projects/{P}/share-link?rotate=true", headers=auth)
    assert client.get(f"/api/share/{TOKEN}").status_code == 404


def test_webhook_signature_and_idempotency(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    ref = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": inv["id"]}).json()["reference"]
    body = json.dumps({"reference": ref, "status": "verified", "amountKobo": inv["amount"] * 100}).encode()
    sig = hmac.new(b"dev-webhook-secret", body, hashlib.sha256).hexdigest()
    assert client.post("/api/webhooks/payments", content=body, headers={"X-CREW-Signature": "bad"}).status_code == 401
    assert client.post("/api/webhooks/payments", content=body, headers={"X-CREW-Signature": sig}).json()["status"] == "verified"
    assert client.post("/api/webhooks/payments", content=body, headers={"X-CREW-Signature": sig}).json()["status"] == "verified"
    assert client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()["receivedNaira"] == 192_000


def test_amount_mismatch_is_not_credited(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    ref = client.post(f"/api/share/{TOKEN}/pay", json={"invoiceId": inv["id"]}).json()["reference"]
    body = json.dumps({"reference": ref, "status": "verified", "amountKobo": 1}).encode()
    sig = hmac.new(b"dev-webhook-secret", body, hashlib.sha256).hexdigest()
    assert client.post("/api/webhooks/payments", content=body, headers={"X-CREW-Signature": sig}).json()["status"] == "unverified"
    assert client.get(f"/api/projects/{P}/reconciliation", headers=auth).json()["receivedNaira"] == 0


def test_failed_reference_and_unconfigured_ecobank(client, auth, monkeypatch):
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-FAIL1", "invoiceId": inv["id"], "amount": inv["amount"]})
    assert r.json()["status"] == "failed"
    monkeypatch.setenv("PAYMENT_PROVIDER", "ecobank")
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": "X-1", "invoiceId": inv["id"], "amount": inv["amount"]})
    assert r.status_code == 502 and "error" in r.json()


def test_intelligence_genome_copilot_and_data_pipeline(client, auth):
    i = client.get(f"/api/projects/{P}/intelligence", headers=auth).json()
    assert i["risk"]["upfrontExposure"] == 133_000 and i["engine"] == "deterministic-v1"
    assert any(r["type"] == "INCREASE_DEPOSIT" for r in i["recommendations"])
    g = client.get("/api/genome", headers=auth).json()
    assert g["projectsAnalysed"] == 2 and 0 <= g["clientQuality"] <= 100
    chat = client.post("/api/copilot/chat", headers=auth, json={"message": "What's my cash gap?", "projectId": P}).json()
    assert "133,000" in chat["text"] and chat["agent"] == "null"
    client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-DATA1", "invoiceId": client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()["id"], "amount": 192_000})
    rows = client.get("/api/data/normalized", headers=auth).json()
    assert rows and rows[-1]["direction"] == "inflow" and rows[-1]["amountKobo"] == 192_000 * 100
    assert client.get("/api/system/extensions", headers=auth).json()["forecaster"] == "baseline-deterministic"
    assert client.get("/api/forecast/series", headers=auth).json()["learned"] is False


def test_milestones_must_sum_to_price(client, auth):
    body = {"name": "X", "clientName": "Y", "revenue": 100_000, "milestones": [{"title": "a", "amount": 10_000}]}
    assert client.post("/api/projects", headers=auth, json=body).status_code == 422
