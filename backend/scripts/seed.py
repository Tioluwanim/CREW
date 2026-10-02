"""python -m scripts.seed   (run from backend/)"""
from app.db import SessionLocal, init_db
from app.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo

init_db()
with SessionLocal() as db:
    seed_demo(db)
print(f"Seeded. Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD}  (set CREW_DEMO_MODE=true for POST /api/auth/demo)")
