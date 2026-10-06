"""Workspace-level (cross-project) numbers: cash position, forecast, dashboard."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.services import finance
from app.services.finance import CHECKPOINTS, naira
from intelligence.dates import today_lagos

OPEN_STAGES = ("brief", "agreed", "funded", "in_progress", "in_review", "approved")


def user_projects(db: Session, user_id: str) -> list[models.Project]:
    return list(db.scalars(select(models.Project).where(models.Project.owner_id == user_id).order_by(models.Project.created_at.desc())))


def cash_position_kobo(db: Session, user: models.User) -> int:
    """starting cash + verified receipts - creator-funded costs already due (date <= today)."""
    today = today_lagos()
    cash = user.profile.starting_cash_kobo if user.profile else 0
    for p in user_projects(db, user.id):
        cash += finance.received_kobo(p)
        cash -= sum(c.amount_kobo for c in finance.creator_costs(p) if p.start_date + timedelta(days=c.paid_on_day) <= today)
        # verified money still held for milestones not yet released is not spendable
        cash -= sum(m.funded_kobo for m in p.milestones if m.status == "funded")
    return cash


def _future_events(p: models.Project, today, balance_delay_days: int = 0):
    ev = []
    dep = finance.deposit_kobo(p)
    received = finance.received_kobo(p)
    dep_left = max(0, dep - received)
    bal_left = max(0, (p.revenue_kobo - dep) - max(0, received - dep))
    if dep_left:
        ev.append((max(p.start_date, today), dep_left))
    if bal_left:
        ev.append((max(p.start_date + timedelta(days=p.expected_payment_days + balance_delay_days), today), bal_left))
    for c in finance.creator_costs(p):
        d = p.start_date + timedelta(days=c.paid_on_day)
        if d > today:
            ev.append((d, -c.amount_kobo))
    return ev


def forecast_points(db: Session, user: models.User, balance_delay_days: int = 0) -> list[dict]:
    """Cash checkpoints. `balance_delay_days` > 0 assumes clients pay the final balance that many days late."""
    today = today_lagos()
    opening = cash_position_kobo(db, user)
    events = [e for p in user_projects(db, user.id) if p.stage in OPEN_STAGES for e in _future_events(p, today, balance_delay_days)]
    pts = []
    for off in CHECKPOINTS:
        end = today + timedelta(days=off)
        cum, inflow, outflow = opening, 0, 0
        for d, amt in sorted(events, key=lambda e: (e[0], -e[1])):
            if d > end:
                continue
            cum += amt
            inflow += max(amt, 0)
            outflow += max(-amt, 0)
        pts.append({"label": "Today" if off == 0 else f"+{off} days", "date": end.isoformat(),
                    "projectedBalance": naira(cum), "inflow": naira(inflow), "outflow": naira(outflow)})
    return pts


def dashboard(db: Session, user: models.User) -> dict:
    today = today_lagos()
    projs = user_projects(db, user.id)
    open_ = [p for p in projs if p.stage in OPEN_STAGES]
    due = 0
    for p in open_:
        for i in p.invoices:
            if i.status in ("sent", "draft") and today <= i.due_date <= today + timedelta(days=7):
                paid = sum(x.amount_kobo for x in p.payments if x.invoice_id == i.id and x.status == "verified")
                due += max(0, i.amount_kobo - paid)
    pts = forecast_points(db, user)
    low = min(p["projectedBalance"] for p in pts)
    return {
        "cashPosition": naira(cash_position_kobo(db, user)),
        "owed": naira(sum(max(0, p.revenue_kobo - finance.received_kobo(p)) for p in open_)),
        "dueThisWeek": naira(due),
        "activeProjects": len(open_),
        "cashGap": max(0, -low),
    }
