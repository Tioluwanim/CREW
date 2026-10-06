from datetime import timedelta

import pytest
from sqlalchemy import select

from app import models
from app.services import dl
from app.services.finance import CHECKPOINTS
from app.services.portfolio import forecast_points
from intelligence.dates import today_lagos
from intelligence.dl import PaymentDelayExample


def _user(s):
    return s.scalars(select(models.User).where(models.User.email == "amara@crew.demo")).first()


def test_late_balance_moves_inflow_not_outflow(session_factory, client):
    with session_factory() as s:
        u = _user(s)
        on_time = forecast_points(s, u)
        late = forecast_points(s, u, balance_delay_days=45)
    assert [p["date"] for p in on_time] == [p["date"] for p in late] and len(on_time) == len(CHECKPOINTS)
    assert all(l["projectedBalance"] <= o["projectedBalance"] for o, l in zip(on_time, late))
    assert all(l["outflow"] == o["outflow"] for o, l in zip(on_time, late))     # costs don't move when a client is late
    assert sum(l["inflow"] for l in late) <= sum(o["inflow"] for o in on_time)


def test_estimate_without_a_model_is_statistical_and_not_called_learned(session_factory, client):
    with session_factory() as s:
        est = dl.estimate_payment_delay(s, _user(s))
    assert est["learned"] is False and est["source"] in ("history", "prior") and est["days"] >= 0


def test_untrusted_model_never_moves_the_forecast(session_factory, client, tmp_path):
    with session_factory() as s:
        u = _user(s)
        s.add(models.ModelRun(owner_id=u.id, model_version="v", architecture="gru", dataset_version="d",
                              artifact_reference=str(tmp_path / "missing.pt"), validation_metrics={"beatsBaseline": False}))
        s.commit()
        est = dl.estimate_payment_delay(s, u)
    assert est["source"] != "gru"


def test_trained_model_that_beats_baseline_drives_the_estimate(session_factory, client, tmp_path):
    pytest.importorskip("torch")
    from intelligence.dl import temporal_split, train_payment_delay_model
    from datetime import date

    def example(i):
        day = float(2 + (i * 7) % 20)
        return PaymentDelayExample(project_id=f"x{i}", cutoff=date(2024, 1, 1) + timedelta(days=i), sequence=((day, 0.4),),
                                   target_delay_days=day * 0.8, currency="NGN", provenance={}, feature_dates=())
    train, val = temporal_split([example(i) for i in range(48)])
    art = tmp_path / "m.pt"
    out = train_payment_delay_model(train, val, str(art), epochs=150, seed=1)
    assert out["beatsBaseline"]

    with session_factory() as s:
        u = _user(s)
        open_project = next(p for p in s.scalars(select(models.Project).where(models.Project.owner_id == u.id)) if p.stage == "brief")
        s.add(models.Payment(project_id=open_project.id, reference="T-1", amount_kobo=1000, status="verified", method="manual",
                             verified_at=models.utcnow()))
        s.add(models.ModelRun(owner_id=u.id, model_version="payment-delay-gru-v1", architecture="gru", dataset_version="d",
                              artifact_reference=str(art), validation_metrics={"beatsBaseline": True}))
        s.commit()
        est = dl.estimate_payment_delay(s, u)
    assert est["source"] == "gru" and est["learned"] is True and est["projects"] >= 1
