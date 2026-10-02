"""Data-subject controls (export + erasure), in the spirit of Nigeria's NDPA/NDPR data-subject rights.
Not legal advice: financial/payment records may carry retention duties - confirm with counsel before launch."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.deps import current_user
from app.security import verify_password
from app.services import events, finance
from app.services.serializers import event_out, invoice_out, payment_out, project_out

router = APIRouter(prefix="/me", tags=["Account"])


@router.get("/export")
def export_my_data(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    pr = user.profile
    projects = db.scalars(select(models.Project).where(models.Project.owner_id == user.id)).all()
    return {
        "account": {"id": user.id, "email": user.email, "createdAt": user.created_at.isoformat()},
        "profile": {"businessName": pr.business_name, "craft": pr.craft, "location": pr.location, "ownerName": pr.owner_name,
                    "typicalDepositPct": pr.typical_deposit_pct, "startingCash": finance.naira(pr.starting_cash_kobo),
                    "consent": {"projectActivity": pr.consent_project_activity, "paymentActivity": pr.consent_payment_activity,
                                "businessPatterns": pr.consent_business_patterns, "sharingLevel": pr.sharing_level}},
        "clients": [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone} for c in db.scalars(select(models.Client).where(models.Client.owner_id == user.id))],
        "projects": [project_out(p) | {"invoices": [invoice_out(i, None) for i in p.invoices], "payments": [payment_out(x) for x in p.payments],
                                       "timeline": [event_out(e, full=True) for e in p.events]} for p in projects],
        "messages": [{"id": m.id, "projectId": m.project_id, "kind": m.kind, "status": m.status, "createdAt": m.created_at.isoformat()}
                     for m in db.scalars(select(models.Message).where(models.Message.owner_id == user.id))],
        "notifications": [{"kind": n.kind, "title": n.title, "createdAt": n.created_at.isoformat()}
                          for n in db.scalars(select(models.Notification).where(models.Notification.user_id == user.id))],
    }


@router.delete("", status_code=204)
def delete_my_account(body: schemas.DeleteAccountIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Permanently erases the account and everything under it (projects, clients, payments, timeline, messages). Irreversible."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Password is incorrect")
    ids = list(db.scalars(select(models.Project.id).where(models.Project.owner_id == user.id)))
    if ids:  # tables without an ORM cascade from Project
        for model in (models.ShareLink, models.Payout, models.Revision, models.Message):
            db.execute(delete(model).where(model.project_id.in_(ids)))
        db.execute(delete(models.Transaction).where(models.Transaction.project_id.in_(ids)))
        db.execute(delete(models.Notification).where(models.Notification.project_id.in_(ids)))
    db.execute(delete(models.Notification).where(models.Notification.user_id == user.id))
    db.execute(delete(models.IdempotencyKey).where(models.IdempotencyKey.scope == user.id))
    db.expire_all()
    for p in db.scalars(select(models.Project).where(models.Project.owner_id == user.id)):
        db.delete(p)   # ORM cascade: costs, deliverables, milestones, change requests, invoices, payments, events
    db.flush()
    for c in db.scalars(select(models.Client).where(models.Client.owner_id == user.id)):
        db.delete(c)
    db.flush()
    db.delete(user)   # cascades the profile
    db.commit()
