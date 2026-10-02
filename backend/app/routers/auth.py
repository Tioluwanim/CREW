from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.db import get_db
from app.deps import current_user
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.TokenOut, response_model_by_alias=True, status_code=201)
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    if db.scalars(select(models.User).where(models.User.email == body.email.lower())).first():
        raise HTTPException(409, "Email already registered")
    user = models.User(email=body.email.lower(), password_hash=hash_password(body.password))
    user.profile = models.CreativeProfile(business_name=body.business_name, craft=body.craft, location=body.location,
                                          owner_name=body.owner_name, typical_deposit_pct=body.typical_deposit_pct,
                                          starting_cash_kobo=body.starting_cash * 100)
    db.add(user)
    db.commit()
    return schemas.TokenOut(access_token=create_token(user.id, user.token_version))


MAX_FAILED_LOGINS, LOCK_MINUTES = 5, 15


@router.post("/login", response_model=schemas.TokenOut, response_model_by_alias=True)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.scalars(select(models.User).where(models.User.email == body.email.lower())).first()
    now = models.utcnow()
    if user and user.locked_until and user.locked_until.replace(tzinfo=now.tzinfo) > now:
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
    if not user or not verify_password(body.password, user.password_hash):
        if user:
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED_LOGINS:
                user.locked_until, user.failed_logins = now + timedelta(minutes=LOCK_MINUTES), 0
            db.commit()
        raise HTTPException(401, "Invalid credentials")
    user.failed_logins, user.locked_until = 0, None
    db.commit()
    return schemas.TokenOut(access_token=create_token(user.id, user.token_version))


@router.post("/change-password", response_model=schemas.TokenOut, response_model_by_alias=True)
def change_password(body: schemas.ChangePasswordIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Verifies the current password, bumps the token version (every old token stops working) and returns a fresh token."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(401, "Current password is incorrect")
    user.password_hash, user.token_version = hash_password(body.new_password), user.token_version + 1
    db.commit()
    return schemas.TokenOut(access_token=create_token(user.id, user.token_version))


@router.post("/logout-all", status_code=204)
def logout_all(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()


@router.post("/demo", response_model=schemas.TokenOut, response_model_by_alias=True)
def demo_login(db: Session = Depends(get_db)):
    """Only when CREW_DEMO_MODE=true: token for the seeded Amara Studio workspace."""
    if not get_settings().demo_mode:
        raise HTTPException(404, "not found")
    user = db.scalars(select(models.User).where(models.User.email == "amara@crew.demo")).first()
    if not user:
        raise HTTPException(404, "Demo data not seeded - run `python -m scripts.seed`")
    return schemas.TokenOut(access_token=create_token(user.id, user.token_version))


@router.get("/me")
def me(user: models.User = Depends(current_user)):
    return {"id": user.id, "email": user.email}
