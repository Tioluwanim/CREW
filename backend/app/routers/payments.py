"""Payment endpoints. Provider-agnostic: nothing here names a fintech."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.db import get_db
from app.deps import current_user, owned_project
from app.payments import registry
from app.payments.errors import ProviderError
from app.services import events, payments, webhooks
from app.services.payments import provider_errors
from app.services.serializers import verification_out
from intelligence import money

router = APIRouter(tags=["Payments"])


def _caps(prov) -> dict:
    c = prov.capabilities
    return {"checkout": c.checkout, "virtualAccounts": c.virtual_accounts, "transferInstructions": c.transfer_instructions, "payouts": c.payouts,
            "statement": c.statement, "accountNameLookup": c.account_name_lookup, "webhooks": c.webhooks, "amountUnit": c.amount_unit}


@router.get("/payments/providers")
def providers(user: models.User = Depends(current_user)):
    """Which provider handles new payments/payouts, and what each registered adapter can do."""
    s = get_settings()
    out = {}
    for n in registry.known():
        p = registry.get(n)
        out[n] = _caps(p)
    return {"collections": s.payment_provider, "payouts": s.payout_provider or s.payment_provider, "providers": out}


@router.post("/payments/verify")
def verify(body: schemas.PaymentVerifyIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Ask the owning provider for the truth about a payment reference. Idempotent per reference."""
    amount_kobo = money.naira_to_kobo(body.amount)
    pay = db.scalars(select(models.Payment).where(models.Payment.reference == body.payment_reference).with_for_update()).first()
    if pay:
        owned_project(pay.project_id, user, db)
        if pay.amount_kobo != amount_kobo:
            raise HTTPException(400, "Amount does not match the payment on record")
    else:
        inv = db.get(models.Invoice, body.invoice_id) if body.invoice_id else None
        if not inv:
            raise HTTPException(400, "Unknown reference - provide a valid invoiceId to register a manual payment")
        owned_project(inv.project_id, user, db)
        with provider_errors():
            prov = registry.for_collections()
        pay = models.Payment(project_id=inv.project_id, invoice_id=inv.id, reference=body.payment_reference, amount_kobo=amount_kobo,
                             status="unverified", method="manual", provider=prov.name)
        db.add(pay)
        db.flush()
    payments.verify_payment(db, pay)
    db.commit()
    return verification_out(pay)


@router.get("/payments/{payment_id}")
def get_payment(payment_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    pay = db.get(models.Payment, payment_id) or db.scalars(select(models.Payment).where(models.Payment.reference == payment_id)).first()
    if not pay:
        raise HTTPException(404, "not found")
    owned_project(pay.project_id, user, db)
    return verification_out(pay)


# ---------------------------------------------------------------------------------------------- webhooks
@router.post("/webhooks/payments/{provider}")
async def provider_webhook(provider: str, request: Request, db: Session = Depends(get_db)):
    """One URL per provider: give the fintech `https://<host>/api/webhooks/payments/<provider-name>`."""
    return webhooks.handle(db, provider, dict(request.headers), await request.body())


@router.post("/webhooks/payments")
async def legacy_webhook(request: Request, db: Session = Depends(get_db)):
    """Back-compat alias for the currently configured collections provider."""
    out = webhooks.handle(db, get_settings().payment_provider, dict(request.headers), await request.body())
    return out | {"status": out["events"][0].get("detail") if out["events"] else None}


# ---------------------------------------------------------------------------------------------- virtual accounts
def _va_out(v: models.VirtualAccount) -> dict:
    return {"id": v.id, "provider": v.provider, "accountNumber": v.account_number, "accountName": v.account_name, "bankName": v.bank_name,
            "bankCode": v.bank_code, "status": v.status, "expectedAmount": v.expected_amount_kobo // 100 if v.expected_amount_kobo is not None else None,
            "expiresAt": v.expires_at.isoformat() if v.expires_at else None}


@router.post("/projects/{project_id}/virtual-account", status_code=201)
def open_va(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Bank-transfer details for this project's client. Repeat calls return the same open account."""
    p = owned_project(project_id, user, db)
    va = payments.open_virtual_account(db, p)
    db.commit()
    return _va_out(va)


@router.get("/projects/{project_id}/virtual-account")
def get_va(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    rows = db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.project_id == p.id).order_by(models.VirtualAccount.created_at.desc())).all()
    return [_va_out(v) for v in rows]


@router.delete("/projects/{project_id}/virtual-account", status_code=204)
def close_va(project_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(project_id, user, db)
    payments.close_virtual_account(db, p)
    db.commit()


# ---------------------------------------------------------------------------------------------- payout destination
def _mask(n: str | None) -> str | None:
    return f"******{n[-4:]}" if n else None


def _payout_out(pr: models.CreativeProfile) -> dict:
    return {"bankCode": pr.payout_bank_code, "accountNumber": _mask(pr.payout_account_number), "accountName": pr.payout_account_name, "verified": pr.payout_account_verified}


@router.get("/profile/payout-account")
def get_payout_account(user: models.User = Depends(current_user)):
    return _payout_out(user.profile)


@router.put("/profile/payout-account")
def set_payout_account(body: schemas.PayoutAccountIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    """Where released funds are sent. If the payout provider can look up account names, the registered name replaces whatever
    was typed, so a mistyped number can't silently pay a stranger."""
    pr, prov = user.profile, registry.for_payouts()
    name, verified = body.account_name, False
    if prov.capabilities.account_name_lookup:
        with provider_errors():
            name, verified = prov.resolve_account(body.bank_code, body.account_number).account_name, True
    pr.payout_bank_code, pr.payout_account_number, pr.payout_account_name, pr.payout_account_verified = body.bank_code, body.account_number, name, verified
    db.commit()
    return _payout_out(pr)
