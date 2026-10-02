"""python -m scripts.sweep   - run scheduled follow-ups and retry queued/failed emails once (cron-friendly)."""
from app.db import SessionLocal
from app.services import messaging, sweeps

with SessionLocal() as db:
    print(sweeps.run(db), {"messages": messaging.deliver_pending(db)})
