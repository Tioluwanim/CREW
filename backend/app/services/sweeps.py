"""Scheduled follow-ups. Deterministic and idempotent: running twice creates nothing new.
Run from cron / a scheduler:  python -m scripts.sweep   (or POST /api/system/sweep with X-Cron-Secret)."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.services import events, finance, idempotency
from intelligence.dates import today_lagos

STALLED_REVIEW_DAYS = 3
DUE_SOON_DAYS = 2


def _already(db: Session, project_id: str, kind: str, key: str) -> bool:
    rows = db.scalars(select(models.ActivityEvent).where(models.ActivityEvent.project_id == project_id, models.ActivityEvent.kind == kind))
    return any(e.meta.get("key") == key for e in rows)


def run(db: Session) -> dict:
    today = today_lagos()
    out = {"overdueInvoices": 0, "dueSoonInvoices": 0, "stalledReviews": 0}
    idempotency.purge_old(db)
    for inv in db.scalars(select(models.Invoice).where(models.Invoice.status == "sent")):
        p = inv.project
        if p.stage in ("released", "closed"):
            continue
        paid = sum(x.amount_kobo for x in p.payments if x.invoice_id == inv.id and x.status == "verified")
        if paid >= inv.amount_kobo:
            continue
        left = (inv.amount_kobo - paid) // 100
        if inv.due_date < today:
            key = f"overdue:{inv.id}"
            if not _already(db, p.id, "invoice_overdue", key):
                days = (today - inv.due_date).days
                events.record(db, p, "system", "invoice_overdue", f"Invoice overdue by {days} day(s)", {"key": key, "invoiceId": inv.id})
                events.notify(db, p, "invoice_overdue", "Invoice overdue", f"{p.client.name} owes ₦{left:,} on {p.name} ({days} day(s) late)")
                out["overdueInvoices"] += 1
        elif (inv.due_date - today).days <= DUE_SOON_DAYS:
            key = f"soon:{inv.id}"
            if not _already(db, p.id, "invoice_due_soon", key):
                events.record(db, p, "system", "invoice_due_soon", f"Invoice due {inv.due_date.isoformat()}", {"key": key, "invoiceId": inv.id}, client_visible=False)
                events.notify(db, p, "invoice_due_soon", "Invoice due soon", f"₦{left:,} from {p.client.name} due {inv.due_date.isoformat()}")
                out["dueSoonInvoices"] += 1
    for p in db.scalars(select(models.Project).where(models.Project.stage == "in_review")):
        delivered = [d.delivered_at for d in p.deliverables if d.status == "delivered" and d.delivered_at]
        if not delivered:
            continue
        waited = (today - max(delivered).date()).days
        key = f"stalled:{max(delivered).isoformat()}"
        if waited >= STALLED_REVIEW_DAYS and not _already(db, p.id, "review_stalled", key):
            events.record(db, p, "system", "review_stalled", f"Waiting on client review for {waited} days", {"key": key}, client_visible=False)
            events.notify(db, p, "review_stalled", "Client hasn't reviewed yet", f"{p.name}: delivered {waited} days ago")
            out["stalledReviews"] += 1
    db.commit()
    return out
