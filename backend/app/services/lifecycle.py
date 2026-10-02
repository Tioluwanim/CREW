"""Project lifecycle: brief -> agreed -> funded -> in_progress -> in_review -> approved -> released -> closed.
Every transition is guarded and writes an evidence event."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.services import events, finance

STAGES = ["brief", "agreed", "funded", "in_progress", "in_review", "approved", "released", "closed"]

ALLOWED = {
    "brief": {"agreed"},
    "agreed": {"funded", "in_progress"},      # in_progress directly only when no deposit is required
    "funded": {"in_progress"},
    "in_progress": {"in_review"},
    "in_review": {"in_progress", "approved"},  # back to in_progress on a revision request
    "approved": {"released"},
    "released": {"closed"},
    "closed": set(),
}


def _guard(db: Session, p: models.Project, to: str) -> None:
    if to == "agreed":
        if not p.deliverables:
            raise HTTPException(409, "Add at least one deliverable before agreeing scope")
        if p.milestones and sum(m.amount_kobo for m in p.milestones) != p.revenue_kobo:
            raise HTTPException(409, "Milestone amounts must add up to the project price")
    elif to == "in_progress" and p.stage == "agreed" and finance.deposit_kobo(p) > 0:
        raise HTTPException(409, "Deposit is required before work starts")
    elif to == "in_review" and not any(d.status == "delivered" for d in p.deliverables):
        raise HTTPException(409, "Mark at least one deliverable as delivered first")
    elif to == "approved" and (not p.deliverables or any(d.status != "approved" for d in p.deliverables)):
        raise HTTPException(409, "Every deliverable must be approved")
    elif to == "released" and any(m.status != "released" for m in p.milestones):
        raise HTTPException(409, "Release every funded milestone first")


def advance(db: Session, p: models.Project, to: str, actor: str, reason: str = "") -> None:
    if to not in ALLOWED.get(p.stage, set()):
        raise HTTPException(409, f"Cannot move from {p.stage} to {to}")
    _guard(db, p, to)
    frm, p.stage = p.stage, to
    if to == "closed":
        p.completed_at = models.utcnow()
    events.record(db, p, actor, "stage_changed", f"Project moved to {to.replace('_', ' ')}", {"from": frm, "to": to, "reason": reason})
    events.notify(db, p, "stage_changed", f"{p.name}: {to.replace('_', ' ')}")


def try_auto_fund(db: Session, p: models.Project) -> None:
    """Called after a verified payment: agreed -> funded once the deposit has landed."""
    dep = finance.deposit_kobo(p)
    if p.stage == "agreed" and dep > 0 and finance.received_kobo(p) >= dep:
        advance(db, p, "funded", "system", "deposit received")
