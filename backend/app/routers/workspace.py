"""Creator-side workspace: lifecycle, deliverables, change requests, invoices, share link,
evidence timeline, reconciliation, release, intelligence, data export, copilot."""
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.db import get_db
from app.deps import current_user, owned_project
from app.extension.learned_forecaster import scenario_delays
from app.extension.registry import get_agent, get_forecaster
from app.services import events, finance, idempotency, intelligence_service, lifecycle, messaging, payments, portfolio, dl
from app.services.serializers import change_out, deliverable_out, event_out, invoice_out, milestone_out, payment_out
from intelligence import money
from intelligence.dates import today_lagos
from intelligence.simulation import SimulationEngine

router = APIRouter(tags=["Workspace"])


def ensure_share_link(db: Session, p: models.Project) -> models.ShareLink:
    link = db.scalars(select(models.ShareLink).where(models.ShareLink.project_id == p.id, models.ShareLink.revoked.is_(False))).first()
    if not link:
        link = models.ShareLink(project_id=p.id)
        db.add(link)
        db.flush()
    return link


def _own(db, user, project_id, model, item_id):
    item = db.get(model, item_id)
    p = owned_project(project_id, user, db)
    if not item or item.project_id != p.id:
        raise HTTPException(404, "not found")
    return p, item


# ---- lifecycle ----------------------------------------------------------------------------
@router.post("/projects/{project_id}/transition")
def transition(project_id: str, body: schemas.TransitionIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    lifecycle.advance(db, p, body.to, "creator")
    db.commit()
    return {"stage": p.stage}


@router.post("/projects/{project_id}/release")
def release_funds(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    out = payments.release_milestones(db, p)
    db.commit()
    row = lambda o: {"milestoneId": o.milestone_id, "amount": o.amount_kobo // 100, "reference": o.reference, "status": o.status}
    return {"released": [row(o) for o in out["released"]], "pending": [row(o) for o in out["pending"]], "failed": out["failed"], "stage": p.stage}


# ---- scope: deliverables / milestones -----------------------------------------------------
@router.post("/projects/{project_id}/deliverables", status_code=201)
def add_deliverable(project_id: str, body: schemas.DeliverableIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    if p.stage not in ("brief", "agreed"):
        raise HTTPException(409, "Scope is locked - use a change request")
    d = models.Deliverable(project_id=p.id, title=body.title, description=body.description, due_date=body.due_date, position=len(p.deliverables))
    db.add(d)
    events.record(db, p, "creator", "deliverable_added", f"Deliverable added: {body.title}")
    db.commit()
    return deliverable_out(d)


@router.post("/projects/{project_id}/deliverables/{deliverable_id}/deliver")
def deliver(project_id: str, deliverable_id: str, evidence_url: str | None = None, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p, d = _own(db, user, project_id, models.Deliverable, deliverable_id)
    if p.stage not in ("in_progress", "in_review"):
        raise HTTPException(409, "Work must be in progress to deliver")
    if d.status not in ("pending", "revision_requested"):
        raise HTTPException(409, f"Deliverable is already {d.status}")
    d.status, d.delivered_at, d.evidence_url = "delivered", models.utcnow(), evidence_url
    for r in d.revisions:
        if r.status == "open":
            r.status = "resolved"
    events.record(db, p, "creator", "delivered", f"Delivered: {d.title}", {"evidenceUrl": evidence_url})
    db.commit()
    return deliverable_out(d)


@router.get("/projects/{project_id}/milestones")
def list_milestones(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return [milestone_out(m) for m in owned_project(project_id, user, db).milestones]


# ---- change requests ----------------------------------------------------------------------
@router.post("/projects/{project_id}/change-requests", status_code=201)
def propose_change(project_id: str, body: schemas.ChangeRequestIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    if p.stage in ("released", "closed"):
        raise HTTPException(409, "Project is finished")
    c = models.ChangeRequest(project_id=p.id, title=body.title, description=body.description, amount_kobo=money.naira_to_kobo(body.amount), requested_by="creator")
    db.add(c)
    db.flush()
    events.record(db, p, "creator", "change_proposed", f"Change proposed: {body.title}", {"amount": body.amount})
    db.commit()
    return change_out(c)


def accept_change(db: Session, p: models.Project, c: models.ChangeRequest, actor: str) -> None:
    if c.status != "proposed":
        raise HTTPException(409, f"Change request already {c.status}")
    c.status, c.decided_at = "accepted", models.utcnow()
    p.revenue_kobo += c.amount_kobo
    if c.amount_kobo:
        db.add(models.Milestone(project_id=p.id, title=f"Change: {c.title}", amount_kobo=c.amount_kobo, change_request_id=c.id, position=len(p.milestones)))
    events.record(db, p, actor, "change_accepted", f"Change accepted: {c.title}", {"amountKobo": c.amount_kobo})
    events.notify(db, p, "change_accepted", "Change request accepted", c.title)


# ---- invoices -----------------------------------------------------------------------------
@router.post("/projects/{project_id}/invoices", status_code=201)
def create_invoice(project_id: str, body: schemas.InvoiceIn, idempotency_key: str | None = Header(None),
                   user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    fp = idempotency.fingerprint(f"POST /projects/{project_id}/invoices", body.model_dump(mode="json"))
    return idempotency.run(db, user.id, idempotency_key, fp, lambda: _create_invoice(p, body, db), status=201)


def _create_invoice(p: models.Project, body: schemas.InvoiceIn, db: Session) -> dict:
    dep = finance.deposit_kobo(p)
    if body.kind == "deposit":
        amount = dep
    elif body.kind == "balance":
        amount = p.revenue_kobo - dep
    else:
        m = next((m for m in p.milestones if m.id == body.milestone_id), None)
        if not m:
            raise HTTPException(422, "milestoneId is required for milestone/change invoices")
        amount = m.amount_kobo - m.funded_kobo
    if amount <= 0:
        raise HTTPException(422, "Nothing to invoice for this kind")
    inv = models.Invoice(project_id=p.id, kind=body.kind, milestone_id=body.milestone_id, amount_kobo=amount,
                         due_date=today_lagos() + timedelta(days=body.due_in_days))
    db.add(inv)
    db.flush()
    link = ensure_share_link(db, p)
    events.record(db, p, "creator", "invoice_created", f"{body.kind.title()} invoice created", {"amountKobo": amount})
    db.flush()
    return invoice_out(inv, link.token)


@router.get("/projects/{project_id}/invoices")
def list_project_invoices(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    link = ensure_share_link(db, p)
    db.commit()
    return [invoice_out(i, link.token) for i in p.invoices]


@router.get("/invoices")
def list_invoices(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for p in portfolio.user_projects(db, user.id):
        link = next((l for l in db.scalars(select(models.ShareLink).where(models.ShareLink.project_id == p.id, models.ShareLink.revoked.is_(False)))), None)
        out += [invoice_out(i, link.token if link else None) for i in p.invoices]
    return out


def _own_invoice(db: Session, user: models.User, invoice_id: str) -> tuple[models.Invoice, models.Project]:
    inv = db.get(models.Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "not found")
    return inv, owned_project(inv.project_id, user, db)


@router.post("/invoices/{invoice_id}/send")
def send_invoice(invoice_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    inv, p = _own_invoice(db, user, invoice_id)
    if inv.status not in ("draft", "pending_approval"):
        raise HTTPException(409, f"Invoice is {inv.status}")
    inv.status = "sent"
    link = ensure_share_link(db, p)
    events.record(db, p, "creator", "invoice_sent", "Invoice sent to client", {"invoiceId": inv.id})
    queued = messaging.queue_invoice(db, inv)
    db.commit()
    delivery = messaging.deliver_pending(db, p.id) if queued else None
    return invoice_out(inv, link.token) | {"emailQueued": bool(queued), "clientHasEmail": bool(p.client.email), "delivery": delivery}


@router.post("/invoices/{invoice_id}/remind")
def remind_invoice(invoice_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Creator-initiated payment reminder by email. At most one per invoice per day."""
    inv, p = _own_invoice(db, user, invoice_id)
    if inv.status != "sent":
        raise HTTPException(409, "Only sent, unpaid invoices can be reminded")
    if not p.client.email:
        raise HTTPException(422, "This client has no email address on file")
    msg = messaging.queue_invoice(db, inv, reminder=True)
    if not msg:
        raise HTTPException(429, "A reminder for this invoice was already sent today")
    db.commit()
    return {"queued": True, "delivery": messaging.deliver_pending(db, p.id)}


@router.get("/projects/{project_id}/messages")
def list_messages(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    rows = db.scalars(select(models.Message).where(models.Message.project_id == p.id).order_by(models.Message.created_at.desc()).limit(100))
    return [{"id": m.id, "kind": m.kind, "channel": m.channel, "status": m.status, "attempts": m.attempts, "lastError": m.last_error,
             "createdAt": m.created_at.isoformat(), "sentAt": m.sent_at.isoformat() if m.sent_at else None} for m in rows]


@router.get("/projects/{project_id}/payments")
def list_project_payments(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return [payment_out(x) for x in owned_project(project_id, user, db).payments]


# ---- share link (no-signup client access) -------------------------------------------------
@router.post("/projects/{project_id}/share-link", status_code=201)
def create_share_link(project_id: str, rotate: bool = False, expires_in_days: int | None = Query(None, ge=1, le=365), user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    if rotate:
        for l in db.scalars(select(models.ShareLink).where(models.ShareLink.project_id == p.id)):
            l.revoked = True
        events.record(db, p, "creator", "share_link_rotated", "Client link replaced", client_visible=False)
    link = ensure_share_link(db, p)
    if expires_in_days:
        link.expires_at = models.utcnow() + timedelta(days=expires_in_days)
    db.commit()
    return {"expiresAt": link.expires_at.isoformat() if link.expires_at else None, "token": link.token, "url": f"{get_settings().public_app_url}/c/{link.token}"}


@router.delete("/projects/{project_id}/share-link", status_code=204)
def revoke_share_link(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    for l in db.scalars(select(models.ShareLink).where(models.ShareLink.project_id == p.id)):
        l.revoked = True
    events.record(db, p, "creator", "share_link_revoked", "Client link revoked", client_visible=False)
    db.commit()


# ---- evidence / reconciliation ------------------------------------------------------------
@router.get("/projects/{project_id}/timeline")
def timeline(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    return {"events": [event_out(e, full=True) for e in p.events], "integrity": events.verify_chain(db, p)}


@router.get("/projects/{project_id}/reconciliation")
def reconciliation(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return payments.reconcile(owned_project(project_id, user, db))


# ---- intelligence (deterministic engine outputs) ------------------------------------------
@router.get("/projects/{project_id}/intelligence")
def project_intel(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.project_intelligence(db, owned_project(project_id, user, db))


@router.get("/projects/{project_id}/forecast")
def project_forecast(project_id: str, horizon_days: int = Query(30, ge=1, le=365),
                     user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.forecast_report(db, owned_project(project_id, user, db), horizon_days)


@router.get("/projects/{project_id}/simulation")
def project_simulation(project_id: str, seed: int = Query(42), run_count: int = Query(1000, ge=1, le=10000),
                       user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    result = SimulationEngine.run_monte_carlo(
        finance.to_dto(p), p.expected_payment_days, [40, 50, 60, 70], seed=seed, run_count=run_count
    )
    return {
        "projectId": p.id, "currency": p.currency, "seed": seed, "runCount": run_count,
        "engineVersion": result.engine_version, "scenarios": [s.__dict__ for s in result.scenarios],
    }


@router.get("/projects/{project_id}/deposit-analysis")
def project_deposit_analysis(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.deposit_analysis(db, owned_project(project_id, user, db))


@router.get("/projects/{project_id}/cost-buffer")
def project_cost_buffer(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.cost_buffer_analysis(db, owned_project(project_id, user, db))


@router.get("/projects/{project_id}/copilot-context")
def project_copilot_context(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.copilot_context(db, owned_project(project_id, user, db))


@router.get("/dl/dataset")
def dl_dataset(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return dl.dataset_summary(db, user.id)


@router.get("/dl/model-status")
def dl_model_status(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return dl.status(db, user.id)


@router.post("/dl/train")
def dl_train(body: schemas.DLTrainIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return dl.train(db, user.id, body.epochs, body.seed)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/projects/{project_id}/dl/prediction")
def dl_prediction(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return dl.predict(db, user.id, owned_project(project_id, user, db))
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/genome")
def genome(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return intelligence_service.creator_genome(db, user.id)


# ---- data pipeline + extension seams (agent / DL plug in here) ----------------------------
@router.get("/data/normalized")
def normalized(limit: int = 1000, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Normalized ledger rows for the intelligence layer / DL pipeline. Kobo, Lagos dates, owner-scoped."""
    prof = user.profile
    if prof and not prof.consent_payment_activity and not prof.consent_project_activity:
        pass  # consent gates *sharing outside CREW*; own-data reads stay allowed
    rows = db.scalars(select(models.Transaction).where(models.Transaction.owner_id == user.id).order_by(models.Transaction.occurred_on).limit(min(limit, 5000)))
    return [{"id": t.id, "projectId": t.project_id, "direction": t.direction, "amountKobo": t.amount_kobo,
             "occurredOn": t.occurred_on.isoformat(), "category": t.category, "source": t.source} for t in rows]


@router.get("/forecast/series")
def forecast_series(horizon_days: int = 30, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    history = normalized(5000, user, db)
    delay = dl.estimate_payment_delay(db, user)
    days = scenario_delays(delay["days"])
    context = {
        "points": portfolio.forecast_points(db, user),
        "scenarios": {
            "optimistic": portfolio.forecast_points(db, user, days["optimisticDays"]),
            "expected": portfolio.forecast_points(db, user, days["expectedDays"]),
            "pessimistic": portfolio.forecast_points(db, user, days["pessimisticDays"]),
        },
        "delay": {**delay, **days},
    }
    return get_forecaster().forecast(history, horizon_days, context)


@router.post("/copilot/chat")
def copilot_chat(body: schemas.ChatIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    grounding: dict = {}
    if body.project_id:
        p = owned_project(body.project_id, user, db)
        grounding = {**finance.snapshot(p), **intelligence_service.project_intelligence(db, p), "depositPct": p.deposit_pct}
    return get_agent().chat(user.id, body.message, body.project_id, grounding)


@router.get("/system/extensions")
def extensions():
    return {"forecaster": get_forecaster().name, "agent": get_agent().name, "paymentProvider": get_settings().payment_provider}


@router.post("/system/sweep")
def run_sweep(x_cron_secret: str = Header(default=""), db: Session = Depends(get_db)):
    """Trigger scheduled follow-ups from an external scheduler. Disabled unless CRON_SECRET is set."""
    from app.services import sweeps
    secret = get_settings().cron_secret
    if not secret or not secrets.compare_digest(x_cron_secret, secret):
        raise HTTPException(404, "not found")
    result = sweeps.run(db)
    return result | {"messages": messaging.deliver_pending(db)}
