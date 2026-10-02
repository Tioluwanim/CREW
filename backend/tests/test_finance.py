from datetime import date


def test_aso_ebi_numbers_match_frontend_core(client, auth):
    s = client.get("/api/projects/project-asoebi/financials", headers=auth).json()
    assert s["depositAmount"] == 192_000
    assert s["upfrontExposure"] == 133_000          # 325,000 creator costs - 192,000 deposit (same-day inflow first)
    assert s["cashGap"] == 133_000
    assert s["expectedProfit"] == 155_000           # 480,000 - 325,000
    assert round(s["profitMarginPct"], 2) == 32.29
    assert s["daysToCash"] == {"status": "planned", "days": 18}
    assert [p["label"] for p in s["cashFlow"]] == ["Today", "+3 days", "+7 days", "+14 days", "+30 days"]
    assert s["cashFlow"][0]["projectedBalance"] == -133_000
    assert s["cashFlow"][-1]["projectedBalance"] == 155_000
    assert s["gapDate"] == s["cashFlow"][0]["date"]


def test_client_funded_costs_never_count_against_creator(client, auth):
    body = {"name": "Shoot", "clientName": "Ade", "revenue": 300_000, "depositPct": 0, "expectedPaymentDays": 10,
            "costs": [{"label": "Props", "category": "materials", "amount": 100_000, "fundedBy": "client", "paidOnDay": 0},
                      {"label": "Crew", "category": "labour", "amount": 50_000, "fundedBy": "creator", "paidOnDay": 0}]}
    p = client.post("/api/projects", headers=auth, json=body).json()
    s = client.get(f"/api/projects/{p['id']}/financials", headers=auth).json()
    assert s["upfrontExposure"] == 50_000
    assert s["expectedProfit"] == 250_000


def test_deposit_covering_costs_removes_gap(client, auth):
    body = {"name": "Big deposit", "clientName": "Ade", "revenue": 400_000, "depositPct": 100, "expectedPaymentDays": 10,
            "costs": [{"label": "Mat", "category": "materials", "amount": 300_000, "paidOnDay": 0}]}
    p = client.post("/api/projects", headers=auth, json=body).json()
    s = client.get(f"/api/projects/{p['id']}/financials", headers=auth).json()
    assert s["upfrontExposure"] == 0 and s["gapDate"] is None


def test_dashboard_and_forecast_consistent(client, auth):
    d = client.get("/api/dashboard", headers=auth).json()
    f = client.get("/api/forecast", headers=auth).json()["points"]
    assert d["activeProjects"] == 1
    assert d["cashGap"] == max(0, -min(p["projectedBalance"] for p in f))
    assert d["owed"] == 480_000
