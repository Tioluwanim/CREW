import json
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from app import models
from app.config import Settings, assert_production_safe
from app.services import sweeps
from intelligence.dates import today_lagos

P, TOKEN = "project-asoebi", "demo-share-token-amara"
ROOT = Path(__file__).resolve().parents[1]


def _fund_and_start(client, auth):
    client.post(f"/api/share/{TOKEN}/agree")
    inv = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit"}).json()
    client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-S2", "invoiceId": inv["id"], "amount": inv["amount"]})
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_progress"})


# ---- validation error shape matches the contract's Error schema
def test_validation_errors_use_contract_error_shape(client, auth):
    r = client.post("/api/projects", headers=auth, json={"name": "x", "clientName": "y", "revenue": -5})
    assert r.status_code == 422 and isinstance(r.json()["error"], str) and r.json()["fields"]


def test_headers_and_request_id(client):
    r = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert r.headers["X-Request-ID"] == "abc123" and r.headers["X-Content-Type-Options"] == "nosniff"


# ---- production guard
def test_production_refuses_unsafe_config():
    with pytest.raises(RuntimeError) as e:
        assert_production_safe(Settings(env="production"))
    assert "JWT_SECRET" in str(e.value) and "DATABASE_URL" in str(e.value)
    assert_production_safe(Settings(env="production", jwt_secret="x" * 40, webhook_secret="y" * 20,
                                    demo_mode=False, demo_auto_auth=False, database_url="postgresql+psycopg://u:p@h/db"))


def test_demo_auto_auth_bridge(client, monkeypatch):
    assert client.get("/api/dashboard").status_code == 401
    monkeypatch.setenv("DEMO_AUTO_AUTH", "true")
    assert client.get("/api/dashboard").status_code == 200
    # a bad token must never fall back to the demo user
    assert client.get("/api/dashboard", headers={"Authorization": "Bearer garbage"}).status_code == 401


# ---- estimate vs actual -> overrun stats feed profile + recommendations
def test_cost_overrun_tracking(client, auth):
    assert client.get("/api/profile", headers=auth).json()["averageMaterialOverrunPct"] == 0
    c = client.patch(f"/api/projects/{P}/costs/cost-materials", headers=auth, json={"amount": 252_000}).json()
    assert c["estimatedAmount"] == 210_000 and c["amount"] == 252_000     # first change freezes the old figure as the estimate
    assert client.get("/api/profile", headers=auth).json()["averageMaterialOverrunPct"] == 20.0
    c2 = client.patch(f"/api/projects/{P}/costs/cost-materials", headers=auth, json={"amount": 262_500}).json()
    assert c2["estimatedAmount"] == 210_000                              # estimate is not overwritten again
    fin = client.get(f"/api/projects/{P}/financials", headers=auth).json()
    assert fin["expectedProfit"] == 480_000 - (262_500 + 80_000 + 20_000 + 15_000)


# ---- share link expiry
def test_share_link_expiry(client, auth, session_factory):
    out = client.post(f"/api/projects/{P}/share-link?expires_in_days=7", headers=auth).json()
    assert out["expiresAt"]
    with session_factory() as s:
        link = s.query(models.ShareLink).filter_by(project_id=P, revoked=False).first()
        link.expires_at = models.utcnow() - timedelta(days=1)
        s.commit()
        tok = link.token
    assert client.get(f"/api/share/{tok}").status_code == 404


# ---- pagination
def test_projects_pagination(client, auth):
    assert len(client.get("/api/projects?limit=1", headers=auth).json()) == 1
    assert len(client.get("/api/projects?limit=100&offset=1", headers=auth).json()) == 2  # seed has 3 projects
    assert client.get("/api/projects?limit=0", headers=auth).status_code == 422


# ---- sweeps: overdue / due soon / stalled review, idempotent
def test_sweeps_are_idempotent(client, auth, session_factory):
    client.post(f"/api/share/{TOKEN}/agree")
    old = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "deposit", "dueInDays": 0}).json()
    client.post(f"/api/invoices/{old['id']}/send", headers=auth)
    with session_factory() as s:
        inv = s.get(models.Invoice, old["id"])
        inv.due_date = today_lagos() - timedelta(days=4)
        s.commit()
        first = sweeps.run(s)
        second = sweeps.run(s)
    assert first["overdueInvoices"] == 1 and second == {"overdueInvoices": 0, "dueSoonInvoices": 0, "stalledReviews": 0}
    notes = client.get("/api/notifications", headers=auth).json()
    assert sum(n["kind"] == "invoice_overdue" for n in notes) == 1


def test_stalled_review_sweep(client, auth, session_factory):
    _fund_and_start(client, auth)
    d = client.get(f"/api/projects/{P}", headers=auth).json()["deliverables"][0]["id"]
    client.post(f"/api/projects/{P}/deliverables/{d}/deliver", headers=auth)
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"})
    with session_factory() as s:
        s.get(models.Deliverable, d).delivered_at = models.utcnow() - timedelta(days=5)
        s.commit()
        assert sweeps.run(s)["stalledReviews"] == 1
        assert sweeps.run(s)["stalledReviews"] == 0


def test_sweep_endpoint_needs_secret(client, monkeypatch):
    assert client.post("/api/system/sweep").status_code == 404           # disabled by default
    monkeypatch.setenv("CRON_SECRET", "s3cret-value")
    assert client.post("/api/system/sweep", headers={"X-Cron-Secret": "nope"}).status_code == 404
    assert client.post("/api/system/sweep", headers={"X-Cron-Secret": "s3cret-value"}).status_code == 200


# ---- double release must not pay twice
def test_release_is_not_repeatable(client, auth):
    _fund_and_start(client, auth)
    d = client.get(f"/api/projects/{P}", headers=auth).json()["deliverables"][0]["id"]
    client.post(f"/api/projects/{P}/deliverables/{d}/deliver", headers=auth)
    client.post(f"/api/projects/{P}/transition", headers=auth, json={"to": "in_review"})
    bal = client.post(f"/api/projects/{P}/invoices", headers=auth, json={"kind": "balance"}).json()
    client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-BAL2", "invoiceId": bal["id"], "amount": bal["amount"]})
    client.post(f"/api/share/{TOKEN}/approve", json={})
    first = client.post(f"/api/projects/{P}/release", headers=auth).json()
    second = client.post(f"/api/projects/{P}/release", headers=auth).json()
    assert len(first["released"]) == 2 and second["released"] == []


# ---- migrations are in sync with the models
def test_alembic_migration_matches_models(tmp_path):
    env = {**__import__("os").environ, "DATABASE_URL": f"sqlite:///{tmp_path/'m.db'}"}
    run = lambda *a: subprocess.run([sys.executable, "-m", "alembic", *a], cwd=ROOT, env=env, capture_output=True, text=True)
    assert run("upgrade", "head").returncode == 0
    chk = run("check")
    assert chk.returncode == 0, chk.stdout + chk.stderr


# ---- the schema must at least compile for PostgreSQL (no server needed)
def test_schema_compiles_for_postgres():
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateIndex, CreateTable
    from app.db import Base
    for t in Base.metadata.sorted_tables:
        str(CreateTable(t).compile(dialect=postgresql.dialect()))
        for ix in t.indexes:
            str(CreateIndex(ix).compile(dialect=postgresql.dialect()))
