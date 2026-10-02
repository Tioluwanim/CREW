"""No-signup client access via an unguessable share link. Clients never see the creator's costs or margin."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.deps import public_limiter
from app.routers.workspace import accept_change
from app.payments.domain import CollectionMethod
from app.services import events, finance, idempotency, lifecycle, payments
from app.services.serializers import change_out, deliverable_out, invoice_out, milestone_out, verification_out

router = APIRouter(prefix="/share", tags=["Client link"], dependencies=[Depends(public_limiter)])


def _resolve(token: str, db: Session) -> models.Project:
    link = db.scalars(select(models.ShareLink).where(models.ShareLink.token == token)).first()
    now = datetime.now(timezone.utc)
    if not link or link.revoked or (link.expires_at and link.expires_at.replace(tzinfo=timezone.utc) < now):
        raise HTTPException(404, "This link is no longer valid")
    return db.get(models.Project, link.project_id)


def _view(p: models.Project) -> dict:
    received = finance.received_kobo(p)
    return {
        "project": {"name": p.name, "creator": None, "stage": p.stage, "price": p.revenue_kobo // 100,
                    "depositPct": p.deposit_pct, "revisionsIncluded": p.revisions_included, "revisionsUsed": sum(len(d.revisions) for d in p.deliverables)},
        "deliverables": [deliverable_out(d) for d in p.deliverables],
        "milestones": [milestone_out(m) for m in p.milestones],
        "changeRequests": [change_out(c) for c in p.change_requests if c.status == "proposed"],
        "invoices": [invoice_out(i, None) | {"paymentLink": ""} for i in p.invoices if i.status in ("sent", "paid")],
        "paid": received // 100, "outstanding": max(0, p.revenue_kobo - received) // 100,
        "timeline": [{"label": e.label, "timestamp": e.created_at.isoformat(), "actor": e.actor} for e in p.events if e.client_visible],
    }


@router.get("/{token}")
def view(token: str, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    profile = db.scalars(select(models.CreativeProfile).where(models.CreativeProfile.user_id == p.owner_id)).first()
    v = _view(p)
    v["project"]["creator"] = (profile.business_name or profile.owner_name) if profile else None
    return v


@router.post("/{token}/agree")
def agree(token: str, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    lifecycle.advance(db, p, "agreed", "client", "client agreed to scope and price")
    db.commit()
    return {"stage": p.stage}


@router.post("/{token}/approve")
def approve(token: str, body: schemas.PublicApprove, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    if p.stage != "in_review":
        raise HTTPException(409, "Nothing is waiting for your review")
    targets = [d for d in p.deliverables if d.status == "delivered" and (body.deliverable_id in (None, d.id))]
    if not targets:
        raise HTTPException(404, "No matching delivered item")
    for d in targets:
        d.status, d.approved_at = "approved", models.utcnow()
        events.record(db, p, "client", "approved", f"Client approved: {d.title}")
    events.notify(db, p, "approved", "Client approved delivery", p.name)
    if all(d.status == "approved" for d in p.deliverables):
        lifecycle.advance(db, p, "approved", "client", "all deliverables approved")
    db.commit()
    return {"stage": p.stage}


@router.post("/{token}/revision")
def request_revision(token: str, body: schemas.PublicRevision, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    d = next((x for x in p.deliverables if x.id == body.deliverable_id), None)
    if p.stage != "in_review" or not d or d.status != "delivered":
        raise HTTPException(409, "This item is not open for review")
    n = sum(len(x.revisions) for x in p.deliverables) + 1
    in_scope = n <= p.revisions_included
    db.add(models.Revision(project_id=p.id, deliverable_id=d.id, number=n, note=body.note, within_scope=in_scope))
    d.status = "revision_requested"
    events.record(db, p, "client", "revision_requested", f"Revision {n} requested: {d.title}", {"note": body.note, "withinScope": in_scope})
    if in_scope:
        events.notify(db, p, "revision_requested", "Revision requested", f"{d.title} (revision {n} of {p.revisions_included})")
    else:
        events.notify(db, p, "revision_over_scope", "Revision beyond the agreed scope",
                      f"{d.title}: revision {n} exceeds the {p.revisions_included} included - consider proposing a change request")
    lifecycle.advance(db, p, "in_progress", "client", "revision requested")
    db.commit()
    return {"stage": p.stage, "revision": n, "withinScope": in_scope}


@router.post("/{token}/change-requests/{change_id}/{decision}")
def decide_change(token: str, change_id: str, decision: str, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    c = db.get(models.ChangeRequest, change_id)
    if decision not in ("accept", "decline") or not c or c.project_id != p.id:
        raise HTTPException(404, "not found")
    if decision == "accept":
        accept_change(db, p, c, "client")
    else:
        if c.status != "proposed":
            raise HTTPException(409, f"Change request already {c.status}")
        c.status, c.decided_at = "declined", models.utcnow()
        events.record(db, p, "client", "change_declined", f"Change declined: {c.title}")
    db.commit()
    return change_out(c)


@router.post("/{token}/pay", status_code=201)
def pay(token: str, body: schemas.PublicPayIn, idempotency_key: str | None = Header(None), db: Session = Depends(get_db)):
    p = _resolve(token, db)
    fp = idempotency.fingerprint(f"POST /share/pay", body.model_dump(mode="json"))
    return idempotency.run(db, f"share:{p.id}", idempotency_key, fp, lambda: _start_payment(p, body, db), status=201)


def _start_payment(p: models.Project, body: schemas.PublicPayIn, db: Session) -> dict:
    inv = db.get(models.Invoice, body.invoice_id) if body.invoice_id else None
    if body.invoice_id and (not inv or inv.project_id != p.id or inv.status not in ("sent", "draft")):
        raise HTTPException(404, "Invoice not payable")
    amount = inv.amount_kobo if inv else (body.amount or 0) * 100
    if amount <= 0:
        raise HTTPException(422, "Provide an invoiceId or an amount")
    if amount > p.revenue_kobo - finance.received_kobo(p):
        raise HTTPException(422, "Amount exceeds what is outstanding")
    method = {"checkout": CollectionMethod.CHECKOUT, "virtual_account": CollectionMethod.VIRTUAL_ACCOUNT, "transfer": CollectionMethod.TRANSFER_INSTRUCTIONS}[body.method]
    pay_, session = payments.create_intent(db, p, inv, amount, method)
    db.flush()
    va = session.virtual_account
    return {"reference": pay_.reference, "amount": amount // 100, "currency": "NGN", "provider": pay_.provider, "method": session.method.value,
            "checkoutUrl": session.checkout_url, "instructions": session.instructions,
            "virtualAccount": {"accountNumber": va.account_number, "accountName": va.account_name, "bankName": va.bank_name} if va else None,
            "note": "Sandbox - no real money moves." if pay_.provider == "sandbox" else "Pay using the details provided."}


@router.post("/{token}/pay/{reference}/verify")
def verify_pay(token: str, reference: str, db: Session = Depends(get_db)):
    p = _resolve(token, db)
    pay_ = db.scalars(select(models.Payment).where(models.Payment.reference == reference, models.Payment.project_id == p.id).with_for_update()).first()
    if not pay_:
        raise HTTPException(404, "not found")
    payments.verify_payment(db, pay_)
    db.commit()
    return verification_out(pay_)


@router.post("/{token}/virtual-account", status_code=201)
def client_bank_transfer_details(token: str, db: Session = Depends(get_db)):
    """Let the client ask for bank-transfer details. Transfers to it are matched to this project automatically."""
    p = _resolve(token, db)
    if p.stage in ("released", "closed"):
        raise HTTPException(409, "This project is finished")
    va = payments.open_virtual_account(db, p)
    db.commit()
    return {"accountNumber": va.account_number, "accountName": va.account_name, "bankName": va.bank_name, "outstanding": max(0, p.revenue_kobo - finance.received_kobo(p)) // 100}
