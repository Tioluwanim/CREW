"""Every legacy endpoint must validate against the repo's openapi.yaml (the frontend's contract)."""
import pathlib

import jsonschema
import yaml

SPEC = yaml.safe_load((pathlib.Path(__file__).resolve().parents[2] / "openapi.yaml").read_text())


def check(schema_name_or_schema, body):
    schema = schema_name_or_schema if isinstance(schema_name_or_schema, dict) else {"$ref": f"#/components/schemas/{schema_name_or_schema}"}
    jsonschema.Draft202012Validator({**schema, "components": SPEC["components"]}).validate(body)


def test_contract_endpoints(client, auth):
    check("DashboardSummary", client.get("/api/dashboard", headers=auth).json())
    projects = client.get("/api/projects", headers=auth).json()
    for p in projects:
        check("Project", p)
    pid = "project-asoebi"
    check("Project", client.get(f"/api/projects/{pid}", headers=auth).json())
    check("ProjectFinancialSnapshot", client.get(f"/api/projects/{pid}/financials", headers=auth).json())
    for c in client.get("/api/clients", headers=auth).json():
        check("Client", c)
    check("ForecastResponse", client.get("/api/forecast", headers=auth).json())
    for f in client.get("/api/feedback").json():
        check("Feedback", f)
    check("CreativeProfile", client.get("/api/profile", headers=auth).json())


def test_error_shape_and_404(client, auth):
    r = client.get("/api/projects/nope", headers=auth)
    assert r.status_code == 404
    check("Error", r.json())


def test_payments_contract(client, auth):
    inv = client.post("/api/projects/project-asoebi/invoices", headers=auth, json={"kind": "deposit"}).json()
    r = client.post("/api/payments/verify", headers=auth, json={"paymentReference": "SBX-C0NTRACT1", "invoiceId": inv["id"], "amount": inv["amount"], "currency": "NGN"})
    assert r.status_code == 200, r.text
    check("PaymentVerificationResponse", r.json())
    assert r.json()["status"] == "verified"
    check("PaymentVerificationResponse", client.get("/api/payments/SBX-C0NTRACT1", headers=auth).json())
