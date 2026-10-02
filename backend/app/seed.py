"""Demo data matching src/data/demoPersona.ts (Amara Studio's Aso-ebi order, ₦480,000, 40% deposit, 18 days)."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.security import hash_password
from app.services import events
from intelligence.dates import today_lagos

DEMO_EMAIL, DEMO_PASSWORD = "amara@crew.demo", "crew-demo-1234"


def seed_demo(db: Session) -> models.User:
    if (u := db.scalars(select(models.User).where(models.User.email == DEMO_EMAIL)).first()):
        return u
    today = today_lagos()
    u = models.User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
    u.profile = models.CreativeProfile(business_name="Amara Studio", craft="Fashion Designer", location="Lagos, Nigeria", owner_name="Amara",
                                       typical_deposit_pct=56, starting_cash_kobo=324_500 * 100)
    db.add(u)
    db.flush()
    teni = models.Client(owner_id=u.id, name="Teni", email="teni@example.com")
    bisi = models.Client(owner_id=u.id, name="Bisi", email="bisi@example.com")
    db.add_all([teni, bisi])
    db.flush()

    # Active project - the running demo
    p = models.Project(id="project-asoebi", owner_id=u.id, client_id=teni.id, name="Aso-ebi order", craft="Fashion Designer",
                       revenue_kobo=480_000 * 100, deposit_pct=40, expected_payment_days=18, stage="brief", start_date=today)
    db.add(p)
    db.flush()
    for cid, label, cat, amt in [("cost-materials", "Materials", "materials", 210_000), ("cost-labour", "Labour", "labour", 80_000),
                                 ("cost-transport", "Transport", "transport", 20_000), ("cost-other", "Other costs", "other", 15_000)]:
        db.add(models.Cost(id=cid, project_id=p.id, label=label, category=cat, amount_kobo=amt * 100, funded_by="creator", paid_on_day=0))
    d1 = models.Deliverable(project_id=p.id, title="10 Aso-ebi outfits (fitted)", position=0, due_date=today + timedelta(days=14))
    db.add(d1)
    db.flush()
    db.add_all([models.Milestone(project_id=p.id, title="Deposit", amount_kobo=192_000 * 100, position=0),
                models.Milestone(project_id=p.id, title="Balance on delivery", amount_kobo=288_000 * 100, deliverable_id=d1.id, position=1)])
    db.add(models.ShareLink(project_id=p.id, token="demo-share-token-amara"))
    db.flush()
    events.record(db, p, "creator", "project_created", "Project created for Teni")

    # Completed history so the genome / priors have data
    for name, rev, cost, days_late, client in [("Bridal shoot outfits", 340_000, 190_000, 3, bisi), ("Owambe set", 260_000, 150_000, 6, teni)]:
        start = today - timedelta(days=60)
        h = models.Project(owner_id=u.id, client_id=client.id, name=name, craft="Fashion Designer", revenue_kobo=rev * 100, deposit_pct=50,
                           expected_payment_days=14, stage="closed", start_date=start, completed_at=models.utcnow())
        db.add(h)
        db.flush()
        db.add(models.Cost(project_id=h.id, label="Materials", category="materials", amount_kobo=cost * 100, paid_on_day=0))
        paid_at = models.utcnow() - timedelta(days=60 - (14 + days_late))
        db.add(models.Payment(project_id=h.id, reference=f"SBX-SEED-{h.id[-6:]}", amount_kobo=rev * 100, status="verified",
                              method="link", provider="sandbox", verified_at=paid_at))
        db.add(models.Milestone(project_id=h.id, title="Full payment", amount_kobo=rev * 100, funded_kobo=rev * 100, status="released"))
        events.record(db, h, "system", "project_closed", "Completed (seed)")

    db.add_all([
        models.Feedback(name="Tolu A.", craft="Photographer", location="Lagos", quote="I finally know what a job really earns me.", verified=False, source="Design-partner interview (illustrative)"),
        models.Feedback(name="Kemi O.", craft="Fashion Designer", location="Ibadan", quote="Clients pay the deposit faster when the link is clear.", verified=False, source="Design-partner interview (illustrative)"),
    ])
    db.commit()
    return u
