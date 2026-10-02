"""Operator endpoints (cron / on-call), protected by X-Cron-Secret; disabled unless CRON_SECRET is set.
Plus dev-only sandbox helpers for demoing virtual accounts and async payouts without a real fintech."""
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.db import get_db
from app.deps import current_user, owned_project
from app.payments import registry
from app.services import events, reconcile_runner, webhooks

router = APIRouter(tags=["Operations"])


def require_cron(x_cron_secret: str = Header(default="")) -> None:
    secret = get_settings().cron_secret
    if not secret or not secrets.compare_digest(x_cron_secret, secret):
        raise HTTPException(404, "not found")


def _run_out(r: models.ReconciliationRun) -> dict:
    return {"id": r.id, "provider": r.provider, "source": r.source, "since": r.since.isoformat(), "until": r.until.isoformat(), "internalCount": r.internal_count,
            "externalCount": r.external_count, "matched": r.matched_count, "discrepancies": r.discrepancy_count, "critical": r.critical_count, "balanced": r.balanced,
            "totals": {k: v // 100 for k, v in r.totals.items()} | {"unit": "naira"}}


def item_out(i: models.ReconciliationItem, ops: bool = False) -> dict:
    out = {"id": i.id, "kind": i.kind, "severity": i.severity, "message": i.message, "status": i.status, "projectId": i.project_id,
           "deltaNaira": i.delta_kobo / 100, "firstSeenRun": i.first_run_id, "createdAt": i.created_at.isoformat()}
    if ops:
        out |= {"provider": i.provider, "internalKey": i.internal_key, "externalRef": i.external_ref, "externalAccount": i.external_account,
                "externalAmountKobo": i.external_amount_kobo, "resolutionNote": i.resolution_note}
    return out


@router.post("/system/reconcile", dependencies=[Depends(require_cron)])
def reconcile_now(provider: str | None = None, hours: int = Query(48, ge=1, le=24 * 31), autopost: bool = False, db: Session = Depends(get_db)):
    """Reconcile our books against the provider for the last N hours. Creators never see other creators' items."""
    from app.services.payments import provider_errors
    name = provider or get_settings().payment_provider
    try:
        with provider_errors():
            registry.get(name)
            run = reconcile_runner.run(db, name, hours=hours, autopost=autopost)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return _run_out(run)


@router.get("/system/reconcile/runs", dependencies=[Depends(require_cron)])
def runs(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return [_run_out(r) for r in db.scalars(select(models.ReconciliationRun).order_by(models.ReconciliationRun.started_at.desc()).limit(limit))]


@router.get("/system/reconcile/items", dependencies=[Depends(require_cron)])
def all_items(status: str = "open", db: Session = Depends(get_db)):
    return [item_out(i, ops=True) for i in db.scalars(select(models.ReconciliationItem).where(models.ReconciliationItem.status == status).order_by(models.ReconciliationItem.created_at))]


class _Resolve(schemas.CamelModel):
    action: str  # ignore | credit_to_project
    note: str = ""
    project_id: str | None = None


@router.post("/system/reconcile/items/{item_id}/resolve", dependencies=[Depends(require_cron)])
def resolve(item_id: str, body: _Resolve, db: Session = Depends(get_db)):
    item = db.get(models.ReconciliationItem, item_id)
    if not item or item.status != "open":
        raise HTTPException(404, "not found")
    if body.action == "ignore":
        if not body.note.strip():
            raise HTTPException(422, "A note is required to ignore a discrepancy")
        item.status, item.resolution_note, item.resolved_at = "ignored", body.note, models.utcnow()
    elif body.action == "credit_to_project":
        if item.kind != "unrecorded_at_platform":
            raise HTTPException(422, "Only unrecorded provider credits can be booked to a project")
        try:
            reconcile_runner.resolve_credit(db, item, body.project_id, body.note)
        except ValueError as e:
            raise HTTPException(422, str(e))
    else:
        raise HTTPException(422, "action must be 'ignore' or 'credit_to_project'")
    db.commit()
    return item_out(item, ops=True)


@router.get("/reconciliation/items")
def my_items(status: str = "open", user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Creator view: only problems attributable to THEIR projects, without provider internals."""
    rows = db.scalars(select(models.ReconciliationItem).where(models.ReconciliationItem.owner_id == user.id, models.ReconciliationItem.status == status))
    return [item_out(i) for i in rows]


# ----------------------------------------------------------------------------------------------- dev-only sandbox helpers
def _sandbox_only() -> None:
    s = get_settings()
    if s.env == "production" or s.payment_provider != "sandbox":
        raise HTTPException(404, "not found")


@router.post("/dev/sandbox/transfer", dependencies=[Depends(_sandbox_only)])
def sandbox_transfer(body: schemas.SandboxTransferIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Pretend a client transferred money into a project's virtual account (goes through the real webhook path)."""
    p = owned_project(body.project_id, user, db)
    va = db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.project_id == p.id, models.VirtualAccount.provider == "sandbox")
                    .order_by(models.VirtualAccount.created_at.desc())).first()
    if not va:
        raise HTTPException(409, "Open a virtual account for this project first")
    headers, raw = registry.get("sandbox").simulate_credit(va.account_number, body.amount * 100, event_id=body.event_id)
    return webhooks.handle(db, "sandbox", headers, raw)


@router.post("/dev/sandbox/payouts/{reference}/complete", dependencies=[Depends(_sandbox_only)])
def sandbox_complete_payout(reference: str, ok: bool = True, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    payout = db.scalars(select(models.Payout).where(models.Payout.reference == reference)).first()
    if not payout:
        raise HTTPException(404, "not found")
    owned_project(payout.project_id, user, db)
    headers, raw = registry.get("sandbox").complete_payout(reference, ok)
    return webhooks.handle(db, "sandbox", headers, raw)
