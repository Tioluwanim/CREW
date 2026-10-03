"""Endpoints defined in openapi.yaml (dashboard, projects, financials, clients, forecast, feedback, profile)
plus project/cost CRUD, notifications and consent."""
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.deps import current_user, owned_project
from app.services import events, finance, idempotency, intelligence_service, portfolio
from app.services.finance import naira
from app.services.serializers import cost_out, project_out
from intelligence import money
from intelligence.currency import to_minor_unit
from intelligence.dates import today_lagos

router = APIRouter()


@router.get("/dashboard", tags=["Projects"])
def get_dashboard(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return portfolio.dashboard(db, user)


@router.get("/projects", tags=["Projects"])
def list_projects(limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0),
                  user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return [project_out(p) for p in portfolio.user_projects(db, user.id)[offset:offset + limit]]


@router.post("/projects", tags=["Projects"], status_code=201)
def create_project(body: schemas.ProjectIn, idempotency_key: str | None = Header(None),
                   user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    fp = idempotency.fingerprint("POST /projects", body.model_dump(mode="json"))
    return idempotency.run(db, user.id, idempotency_key, fp, lambda: _create_project(body, user, db), status=201)


def _create_project(body: schemas.ProjectIn, user: models.User, db: Session) -> dict:
    client = db.scalars(select(models.Client).where(models.Client.owner_id == user.id, models.Client.name == body.client_name)).first()
    if not client:
        client = models.Client(
            owner_id=user.id,
            name=body.client_name,
            email=body.client_email,
            phone=body.client_phone,
            country=body.client_country,
            preferred_currency=body.client_preferred_currency.upper() if body.client_preferred_currency else None,
            billing_currency=body.client_billing_currency.upper() if body.client_billing_currency else None,
            timezone=body.client_timezone,
        )
        db.add(client)
        db.flush()
    currency = body.currency.upper()
    if any(c.currency.upper() != currency for c in body.costs):
        raise HTTPException(422, "All project costs must use the project currency")
    p = models.Project(owner_id=user.id, client_id=client.id, name=body.name, craft=body.craft or (user.profile.craft if user.profile else ""),
                       revenue_kobo=to_minor_unit(body.revenue, currency), currency=currency, deposit_pct=body.deposit_pct,
                       expected_payment_days=body.expected_payment_days, revisions_included=body.revisions_included,
                       start_date=body.start_date or today_lagos())
    db.add(p)
    db.flush()
    p.client = client
    for c in body.costs:
        db.add(models.Cost(project_id=p.id, label=c.label, category=c.category, amount_kobo=to_minor_unit(c.amount, currency), currency=currency,
                           estimated_amount_kobo=to_minor_unit(c.estimated_amount if c.estimated_amount is not None else c.amount, currency),
                           funded_by=c.funded_by, paid_on_day=c.paid_on_day))
    dels = []
    for i, d in enumerate(body.deliverables):
        dl = models.Deliverable(project_id=p.id, title=d.title, description=d.description, due_date=d.due_date, position=i)
        db.add(dl)
        dels.append(dl)
    db.flush()
    if body.milestones:
        if sum(m.amount for m in body.milestones) != body.revenue:
            raise HTTPException(422, "Milestone amounts must add up to the project price")
        for i, m in enumerate(body.milestones):
            did = dels[m.deliverable_index].id if m.deliverable_index is not None and 0 <= m.deliverable_index < len(dels) else None
            db.add(models.Milestone(project_id=p.id, title=m.title, amount_kobo=to_minor_unit(m.amount, currency), currency=currency, deliverable_id=did, position=i))
    else:  # default: deposit + balance
        dep = finance.deposit_kobo(p)
        pos = 0
        if dep:
            db.add(models.Milestone(project_id=p.id, title="Deposit", amount_kobo=dep, currency=currency, position=pos))
            pos += 1
        if p.revenue_kobo - dep:
            db.add(models.Milestone(project_id=p.id, title="Balance", amount_kobo=p.revenue_kobo - dep, currency=currency, position=pos))
    db.flush()
    events.record(db, p, "creator", "project_created", f"Project created for {client.name}")
    events.notify(db, p, "project_created", "Project created", p.name)
    snap = finance.snapshot(_reload(db, p))
    if snap["cashGap"] > 0:
        events.notify(db, p, "cash_gap", "Cash gap detected", f"{p.name}: ₦{snap['cashGap']:,} upfront exposure")
    db.flush()
    return project_out(_reload(db, p))


def _reload(db: Session, p: models.Project) -> models.Project:
    db.expire(p)
    return db.get(models.Project, p.id)


@router.get("/projects/{project_id}", tags=["Projects"])
def get_project(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return project_out(owned_project(project_id, user, db))


@router.patch("/projects/{project_id}", tags=["Projects"])
def patch_project(project_id: str, body: schemas.ProjectPatch, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    if p.stage not in ("brief", "agreed") and (body.revenue is not None or body.deposit_pct is not None):
        raise HTTPException(409, "Price and deposit are locked once the project is funded - use a change request")
    data = body.model_dump(exclude_unset=True)
    if "revenue" in data:
        p.revenue_kobo = money.naira_to_kobo(data.pop("revenue"))
    for k, v in data.items():
        setattr(p, k, v)
    events.record(db, p, "creator", "project_updated", "Project details updated", {"fields": list(body.model_dump(exclude_unset=True))})
    db.commit()
    return project_out(p)


@router.get("/projects/{project_id}/financials", tags=["Financials"])
def project_financials(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return finance.snapshot(owned_project(project_id, user, db))


@router.post("/projects/{project_id}/costs", tags=["Projects"], status_code=201)
def add_cost(project_id: str, body: schemas.CostIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    c = models.Cost(project_id=p.id, label=body.label, category=body.category, amount_kobo=money.naira_to_kobo(body.amount),
                    estimated_amount_kobo=money.naira_to_kobo(body.estimated_amount if body.estimated_amount is not None else body.amount),
                    funded_by=body.funded_by, paid_on_day=body.paid_on_day)
    db.add(c)
    events.record(db, p, "creator", "cost_added", f"Cost added: {body.label}", {"amount": body.amount}, client_visible=False)
    db.commit()
    return cost_out(c)


@router.patch("/projects/{project_id}/costs/{cost_id}", tags=["Projects"])
def patch_cost(project_id: str, cost_id: str, body: schemas.CostPatch, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    c = db.get(models.Cost, cost_id)
    if not c or c.project_id != p.id:
        raise HTTPException(404, "not found")
    d = body.model_dump(exclude_unset=True)
    if "estimated_amount" in d:
        v = d.pop("estimated_amount")
        c.estimated_amount_kobo = money.naira_to_kobo(v) if v is not None else None
    if "amount" in d:
        if c.estimated_amount_kobo is None:  # first time the figure moves: the old one becomes the estimate
            c.estimated_amount_kobo = c.amount_kobo
        c.amount_kobo = money.naira_to_kobo(d.pop("amount"))
    for k, v in d.items():
        setattr(c, k, v)
    events.record(db, p, "creator", "cost_updated", f"Cost updated: {c.label}", client_visible=False)
    db.commit()
    return cost_out(c)


@router.delete("/projects/{project_id}/costs/{cost_id}", tags=["Projects"], status_code=204)
def delete_cost(project_id: str, cost_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    c = db.get(models.Cost, cost_id)
    if not c or c.project_id != p.id:
        raise HTTPException(404, "not found")
    events.record(db, p, "creator", "cost_removed", f"Cost removed: {c.label}", client_visible=False)
    db.delete(c)
    db.commit()


@router.get("/clients", tags=["Clients"])
def list_clients(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for c in db.scalars(select(models.Client).where(models.Client.owner_id == user.id)):
        delays = [d for p in c.projects if (d := intelligence_service.payment_delay_days(p)) is not None]
        out.append({"id": c.id, "name": c.name, "projectIds": [p.id for p in c.projects],
                    "totalBilled": naira(sum(p.revenue_kobo for p in c.projects)),
                    "totalPaid": naira(sum(finance.received_kobo(p) for p in c.projects)),
                    "averagePaymentDays": round(sum(delays) / len(delays), 1) if delays else 0})
    return out


@router.get("/forecast", tags=["Forecast"])
def get_forecast(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return {"points": portfolio.forecast_points(db, user)}


@router.get("/feedback", tags=["Feedback"])
def list_feedback(db: Session = Depends(get_db)):
    return [{"id": f.id, "name": f.name, "craft": f.craft, "location": f.location, "quote": f.quote, "avatar": f.avatar,
             "verified": f.verified, "source": f.source, "date": f.date.isoformat()} for f in db.scalars(select(models.Feedback))]


def _profile_out(user: models.User, db: Session) -> dict:
    pr, projs = user.profile, portfolio.user_projects(db, user.id)
    done = [p for p in projs if p.stage in ("released", "closed")]
    margins = [intelligence_service.FinancialEngine.calculate_profit(finance.to_dto(p))[1] for p in done]
    delays = [d for p in done if (d := intelligence_service.payment_delay_days(p)) is not None]
    base = done or projs
    return {"id": pr.id, "businessName": pr.business_name, "craft": pr.craft, "location": pr.location, "ownerName": pr.owner_name,
            "projectsCompleted": len(done),
            "averageProjectValue": naira(sum(p.revenue_kobo for p in base) // len(base)) if base else 0,
            "typicalDepositPct": round(sum(p.deposit_pct for p in base) / len(base)) if base else pr.typical_deposit_pct,
            "averagePaymentDelayDays": round(sum(delays) / len(delays), 1) if delays else 0,
            "averageMaterialOverrunPct": intelligence_service.material_overrun_pct(db, user.id),
            "averageMarginPct": round(sum(margins) / len(margins) / 100, 1) if margins else 0,
            "startingCash": naira(pr.starting_cash_kobo)}


@router.get("/profile", tags=["Projects"])
def get_profile(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return _profile_out(user, db)


@router.patch("/profile", tags=["Projects"])
def patch_profile(body: schemas.ProfilePatch, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    d = body.model_dump(exclude_unset=True)
    if "starting_cash" in d:
        user.profile.starting_cash_kobo = money.naira_to_kobo(d.pop("starting_cash"))
    for k, v in d.items():
        setattr(user.profile, k, v)
    db.commit()
    return _profile_out(user, db)


@router.get("/consent", tags=["Profile"])
def get_consent(user: models.User = Depends(current_user)):
    p = user.profile
    return {"projectActivity": p.consent_project_activity, "paymentActivity": p.consent_payment_activity,
            "businessPatterns": p.consent_business_patterns, "sharingLevel": p.sharing_level}


@router.put("/consent", tags=["Profile"])
def put_consent(body: schemas.ConsentIO, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = user.profile
    p.consent_project_activity, p.consent_payment_activity = body.project_activity, body.payment_activity
    p.consent_business_patterns, p.sharing_level = body.business_patterns, body.sharing_level
    db.commit()
    return get_consent(user)


@router.get("/notifications", tags=["Notifications"])
def list_notifications(unread_only: bool = False, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(models.Notification).where(models.Notification.user_id == user.id).order_by(models.Notification.created_at.desc()).limit(50)
    if unread_only:
        q = q.where(models.Notification.read.is_(False))
    return [{"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "read": n.read, "projectId": n.project_id,
             "createdAt": n.created_at.isoformat()} for n in db.scalars(q)]


@router.post("/notifications/read-all", tags=["Notifications"], status_code=204)
def read_all(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(models.Notification).where(models.Notification.user_id == user.id, models.Notification.read.is_(False))):
        n.read = True
    db.commit()


@router.post("/notifications/{notification_id}/read", tags=["Notifications"], status_code=204)
def read_one(notification_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(models.Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "not found")
    n.read = True
    db.commit()
