"""Payment orchestration: talks to providers ONLY through app.payments (the port), never to a specific fintech.

  create_intent / verify_payment / settle      collections
  open_virtual_account / credit_received       virtual accounts (client pays by transfer)
  release_milestones / complete_payout         paying the creator after approval
  reconcile                                    per-project ledger check (the cross-provider engine is reconcile_runner)

Every function resolves the provider from the ROW it is handling (`payment.provider`), not from current config, so
switching PAYMENT_PROVIDER never strands in-flight money."""
import secrets
from contextlib import contextmanager
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.payments import registry
from app.payments.domain import (
    CollectionMethod, CollectionRequest, CollectionSession, CollectionStatus, Customer, PayoutDestination, PayoutRequest, PayoutResult,
    PayoutStatus, VerificationResult, VirtualAccountRequest, WebhookEvent,
)
from app.payments.errors import (
    MalformedPayload, NotSupported, ProviderAuthError, ProviderError, ProviderNotConfigured, ProviderRejected, ProviderUnavailable, SignatureInvalid,
)
from app.services import events, lifecycle, messaging


@contextmanager
def provider_errors():
    """Turn the ProviderError family into the HTTP errors the API contract promises."""
    try:
        yield
    except NotSupported as e:
        raise HTTPException(501, f"This payment provider does not support that ({e})")
    except SignatureInvalid:
        raise HTTPException(401, "Bad signature")
    except MalformedPayload as e:
        raise HTTPException(400, f"Invalid payload: {e}")
    except ProviderRejected as e:
        raise HTTPException(422, f"Payment provider refused the request: {e}")
    except (ProviderNotConfigured, ProviderUnavailable, ProviderAuthError, ProviderError) as e:
        raise HTTPException(502, str(e))


def new_reference(provider) -> str:
    return provider.reference_prefix + secrets.token_hex(6).upper()


def customer_for(project: models.Project) -> Customer:
    return Customer(name=project.client.name, email=project.client.email, phone=project.client.phone)


# ------------------------------------------------------------------------------------------------ collections
def create_intent(db: Session, project: models.Project, invoice: models.Invoice | None, amount_kobo: int,
                  method: CollectionMethod = CollectionMethod.CHECKOUT, via: str = "link") -> tuple[models.Payment, CollectionSession]:
    prov = registry.for_collections()
    if method == CollectionMethod.CHECKOUT and not prov.capabilities.checkout:
        method = CollectionMethod.VIRTUAL_ACCOUNT if prov.capabilities.virtual_accounts else CollectionMethod.TRANSFER_INSTRUCTIONS
    ref = new_reference(prov)
    with provider_errors():
        session = prov.create_collection(CollectionRequest(reference=ref, amount_kobo=amount_kobo, customer=customer_for(project),
                                                           narration=f"{project.name}", method=method, metadata={"projectId": project.id}))
    pay = models.Payment(project_id=project.id, invoice_id=invoice.id if invoice else None, reference=session.reference, provider_ref=session.provider_ref,
                         amount_kobo=amount_kobo, status="pending", method=via, provider=prov.name)
    db.add(pay)
    db.flush()
    events.record(db, project, "client" if via == "link" else "creator", "payment_initiated", "Payment initiated", {"reference": pay.reference})
    return pay, session


def _allocate(db: Session, project: models.Project, amount_kobo: int) -> None:
    """Waterfall a verified payment onto milestones in order."""
    left = amount_kobo
    for m in project.milestones:
        room = m.amount_kobo - m.funded_kobo
        if room <= 0 or left <= 0:
            continue
        take = min(room, left)
        m.funded_kobo += take
        left -= take
        if m.funded_kobo >= m.amount_kobo and m.status == "pending":
            m.status = "funded"


def settle(db: Session, pay: models.Payment, result: VerificationResult) -> models.Payment:
    """Idempotent: a payment that is already verified is never re-applied."""
    if pay.status == "verified":
        return pay
    project = db.get(models.Project, pay.project_id)
    if result.status == CollectionStatus.SUCCEEDED:
        if result.amount_kobo is None or result.amount_kobo != pay.amount_kobo:
            pay.status = "unverified"
            events.record(db, project, "provider", "payment_mismatch", "Payment amount did not match", {"reference": pay.reference}, client_visible=False)
            return pay
        pay.status, pay.verified_at = "verified", result.paid_at or models.utcnow()
        pay.provider_ref = result.provider_ref or pay.provider_ref
        _allocate(db, project, pay.amount_kobo)
        inv = db.get(models.Invoice, pay.invoice_id) if pay.invoice_id else None
        if inv:
            paid = sum(p.amount_kobo for p in project.payments if p.invoice_id == inv.id and p.status == "verified")
            if paid >= inv.amount_kobo:
                inv.status = "paid"
        db.add(models.Transaction(owner_id=project.owner_id, project_id=project.id, direction="inflow", amount_kobo=pay.amount_kobo,
                                  occurred_on=pay.verified_at.date(), category="client_payment", source=pay.provider, source_ref=f"pay:{pay.reference}"))
        events.record(db, project, "provider", "payment_verified", "Payment verified", {"reference": pay.reference, "amountKobo": pay.amount_kobo})
        events.notify(db, project, "payment_verified", "Payment verified", f"{project.name}: ₦{pay.amount_kobo // 100:,} received")
        lifecycle.try_auto_fund(db, project)
        messaging.queue_receipt(db, pay)
    elif result.status == CollectionStatus.FAILED:
        pay.status = "failed"
        events.record(db, project, "provider", "payment_failed", "Payment failed", {"reference": pay.reference})
    return pay


def verify_payment(db: Session, pay: models.Payment) -> models.Payment:
    prov = registry.get(pay.provider)          # the provider that OWNS this payment, whatever is configured now
    with provider_errors():
        result = prov.verify_collection(pay.reference, pay.amount_kobo)
    return settle(db, pay, result)


# ------------------------------------------------------------------------------------------------ virtual accounts
def open_virtual_account(db: Session, project: models.Project, expected_kobo: int | None = None) -> models.VirtualAccount:
    """One open account per project per provider. Repeat calls return the same account."""
    prov = registry.for_collections()
    if not prov.capabilities.virtual_accounts:
        raise HTTPException(501, f"{prov.name} does not offer virtual accounts")
    existing = db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.project_id == project.id, models.VirtualAccount.provider == prov.name,
                                                              models.VirtualAccount.status == "open")).first()
    if existing:
        return existing
    # Stable per project so a retried call is idempotent at the provider; a new "generation" only after the previous one was closed.
    generation = len(db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.project_id == project.id, models.VirtualAccount.provider == prov.name)).all())
    ref = f"{prov.reference_prefix}VA-{project.id}" + (f"-g{generation}" if generation else "")
    with provider_errors():
        va = prov.open_virtual_account(VirtualAccountRequest(reference=ref, customer=customer_for(project), expected_amount_kobo=expected_kobo, narration=project.name,
                                                             metadata={"projectId": project.id}))
    row = models.VirtualAccount(project_id=project.id, provider=prov.name, reference=va.reference, provider_ref=va.provider_ref, account_number=va.details.account_number,
                                account_name=va.details.account_name, bank_name=va.details.bank_name, bank_code=va.details.bank_code,
                                expected_amount_kobo=expected_kobo, status=va.status.value, expires_at=va.details.expires_at)
    db.add(row)
    db.flush()
    events.record(db, project, "system", "virtual_account_opened", "Bank transfer details created for the client", {"bank": va.details.bank_name}, client_visible=True)
    return row


def close_virtual_account(db: Session, project: models.Project) -> int:
    n = 0
    for row in db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.project_id == project.id, models.VirtualAccount.status == "open")):
        with provider_errors():
            registry.get(row.provider).close_virtual_account(row.reference)
        row.status = "closed"
        n += 1
    if n:
        events.record(db, project, "creator", "virtual_account_closed", "Bank transfer details closed", client_visible=False)
    return n


def credit_received(db: Session, va: models.VirtualAccount, ev: WebhookEvent) -> tuple[str, models.Payment | None]:
    """A payer transferred money into `va`. Returns (outcome, payment). Money that doesn't fit the rules is HELD, never lost or guessed at."""
    project = db.get(models.Project, va.project_id)
    prov = registry.get(va.provider)
    if ev.amount_kobo is None or ev.amount_kobo <= 0:
        return "error", None
    ref = f"{prov.reference_prefix}VA-{ev.event_id}"[:80]
    pay = db.scalars(select(models.Payment).where(models.Payment.reference == ref)).first()
    if pay:
        return "applied", pay
    outstanding = max(0, project.revenue_kobo - sum(p.amount_kobo for p in project.payments if p.status == "verified"))
    pay = models.Payment(project_id=project.id, reference=ref, provider_ref=ev.provider_ref, virtual_account_id=va.id, amount_kobo=ev.amount_kobo,
                         status="pending", method="virtual_account", provider=va.provider)
    db.add(pay)
    db.flush()
    db.expire(project, ["payments"])   # `outstanding` above loaded the collection before this row existed; auto-funding must see it
    reason = None
    if va.status != "open":
        reason = "the account was already closed"
    elif project.stage in ("released", "closed"):
        reason = "the project is finished"
    elif va.expected_amount_kobo is not None and ev.amount_kobo != va.expected_amount_kobo:
        reason = f"expected ₦{va.expected_amount_kobo // 100:,}"
    elif ev.amount_kobo > outstanding:
        reason = "more than the outstanding balance"
    if reason:
        pay.status = "unverified"
        events.record(db, project, "provider", "payment_held", f"Transfer of ₦{ev.amount_kobo // 100:,} held for review ({reason})", {"reference": ref}, client_visible=False)
        events.notify(db, project, "payment_held", "Transfer held for review", f"{project.name}: ₦{ev.amount_kobo // 100:,} - {reason}")
        return "held", pay
    settle(db, pay, VerificationResult(CollectionStatus.SUCCEEDED, ev.amount_kobo, ev.provider_ref, ev.occurred_at))
    return "applied", pay


# ------------------------------------------------------------------------------------------------ payouts
def payout_destination(db: Session, project: models.Project, prov) -> PayoutDestination | None:
    pr = db.scalars(select(models.CreativeProfile).where(models.CreativeProfile.user_id == project.owner_id)).first()
    if pr and pr.payout_account_number and pr.payout_bank_code:
        return PayoutDestination(pr.payout_bank_code, pr.payout_account_number, pr.payout_account_name or "")
    if prov.capabilities.requires_payout_destination:
        raise HTTPException(422, "Add your payout bank account before funds can be released")
    return None


def _finish_project_if_all_released(db: Session, project: models.Project) -> None:
    if project.milestones and all(m.status == "released" for m in project.milestones) and project.stage == "approved":
        lifecycle.advance(db, project, "released", "system", "all milestones released")


def release_milestones(db: Session, project: models.Project) -> dict:
    """Pay out every funded milestone whose deliverable is approved. Retry-safe: the payout reference is derived from the
    milestone, so repeating a request after a timeout can never pay twice."""
    if project.stage not in ("approved", "released"):
        raise HTTPException(409, "Funds are released only after the client approves delivery")
    prov = registry.for_payouts()
    if not prov.capabilities.payouts:
        raise HTTPException(501, f"{prov.name} does not support payouts")
    dest = payout_destination(db, project, prov)
    dmap = {d.id: d for d in project.deliverables}
    done, pending, failed = [], [], []
    for m in project.milestones:
        approved = dmap[m.deliverable_id].status == "approved" if m.deliverable_id in dmap else True
        if m.status != "funded" or not approved:
            continue
        # Deterministic per milestone, so a retry after a timeout can't pay twice. A payout that definitively FAILED gets a new
        # attempt suffix - providers that dedupe on reference would otherwise replay the failure forever.
        attempts = len(db.scalars(select(models.Payout).where(models.Payout.milestone_id == m.id, models.Payout.status == "failed")).all())
        ref = f"{prov.reference_prefix}OUT-{m.id}" + (f"-r{attempts}" if attempts else "")
        try:
            with provider_errors():
                res: PayoutResult = prov.initiate_payout(PayoutRequest(reference=ref, amount_kobo=m.amount_kobo, destination=dest,
                                                                       narration=f"{project.name} - {m.title}", metadata={"projectId": project.id, "milestoneId": m.id}))
        except HTTPException as e:
            failed.append({"milestoneId": m.id, "error": e.detail})
            continue
        payout = db.scalars(select(models.Payout).where(models.Payout.reference == ref)).first() or models.Payout(
            project_id=project.id, milestone_id=m.id, amount_kobo=m.amount_kobo, reference=ref, provider=prov.name)
        payout.provider_ref, payout.status = res.provider_ref, res.status.value
        db.add(payout)
        db.flush()
        if res.status == PayoutStatus.COMPLETED:
            _mark_released(db, project, m, payout)
            done.append(payout)
        elif res.status == PayoutStatus.PENDING:
            m.status = "releasing"
            events.record(db, project, "provider", "payout_pending", f"Payout of ₦{m.amount_kobo // 100:,} for {m.title} is processing", {"reference": ref})
            pending.append(payout)
        else:
            payout.failure_reason = res.failure_reason
            failed.append({"milestoneId": m.id, "error": res.failure_reason or "payout failed"})
    if failed and not (done or pending):
        raise HTTPException(502, f"Payout failed: {failed[0]['error']}")
    if done:
        events.notify(db, project, "funds_released", "Funds released", f"{project.name}: ₦{sum(o.amount_kobo for o in done) // 100:,}")
    _finish_project_if_all_released(db, project)
    return {"released": done, "pending": pending, "failed": failed}


def _mark_released(db: Session, project: models.Project, m: models.Milestone, payout: models.Payout) -> None:
    m.status, m.released_at = "released", models.utcnow()
    payout.status = "completed"
    db.add(models.Transaction(owner_id=project.owner_id, project_id=project.id, direction="outflow", amount_kobo=payout.amount_kobo,
                              occurred_on=m.released_at.date(), category="creator_payout", source=payout.provider, source_ref=f"out:{payout.reference}"))
    events.record(db, project, "provider", "funds_released", f"Released ₦{m.amount_kobo // 100:,} for {m.title}", {"reference": payout.reference})


def complete_payout(db: Session, payout: models.Payout, ok: bool, reason: str | None = None) -> str:
    """Final state of an async payout (from a webhook or a status poll). Idempotent."""
    project, m = db.get(models.Project, payout.project_id), db.get(models.Milestone, payout.milestone_id)
    if payout.status in ("completed", "failed") and m.status in ("released", "funded"):
        return payout.status
    if ok:
        _mark_released(db, project, m, payout)
        events.notify(db, project, "funds_released", "Funds released", f"{project.name}: ₦{payout.amount_kobo // 100:,}")
        _finish_project_if_all_released(db, project)
    else:
        payout.status, payout.failure_reason = "failed", reason
        m.status = "funded"   # money is still held; the creator can fix the account and release again
        events.record(db, project, "provider", "payout_failed", f"Payout for {m.title} failed", {"reason": reason or ""})
        events.notify(db, project, "payout_failed", "Payout failed", f"{project.name}: {reason or 'the bank rejected it'}")
    return payout.status


# ------------------------------------------------------------------------------------------------ per-project ledger check
def reconcile(project: models.Project) -> dict:
    """Internal ledger check: what was invoiced vs. verified vs. held vs. released."""
    invoiced = sum(i.amount_kobo for i in project.invoices if i.status != "void")
    verified = sum(p.amount_kobo for p in project.payments if p.status == "verified")
    released = sum(m.amount_kobo for m in project.milestones if m.status == "released")
    return {
        "priceNaira": project.revenue_kobo // 100, "invoicedNaira": invoiced // 100, "receivedNaira": verified // 100,
        "heldNaira": (verified - released) // 100, "releasedNaira": released // 100,
        "outstandingNaira": max(0, project.revenue_kobo - verified) // 100,
        "unverifiedPayments": [p.reference for p in project.payments if p.status in ("pending", "unverified")],
        "balanced": verified >= released and invoiced <= project.revenue_kobo,
    }
