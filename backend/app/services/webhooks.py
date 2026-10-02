"""Provider-agnostic webhook intake: authenticate -> parse to canonical events -> store once -> apply.

Design rules:
  * authenticate BEFORE parsing anything (adapter.verify_webhook);
  * each event is stored once under (provider, event_id): a replay is acknowledged and ignored;
  * an event we cannot match (unknown reference / account) is stored as `unmatched` and still answered 200 -
    a non-2xx would make the provider retry forever; reconciliation surfaces it instead."""
from typing import Mapping

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.payments import registry
from app.payments.domain import CollectionStatus, VerificationResult, WebhookEvent, WebhookEventType
from app.services import payments
from app.services.payments import provider_errors


def _store(db: Session, provider: str, ev: WebhookEvent) -> models.ProviderEvent | None:
    row = models.ProviderEvent(provider=provider, event_id=ev.event_id, type=ev.type.value, reference=ev.reference, provider_ref=ev.provider_ref,
                               account_number=ev.account_number, amount_kobo=ev.amount_kobo, occurred_at=ev.occurred_at)
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError:
        return None   # replay
    return row


def _apply(db: Session, provider: str, ev: WebhookEvent) -> tuple[str, str | None]:
    T = WebhookEventType
    if ev.type == T.IGNORED:
        return "applied", "ignored event type"
    if ev.type in (T.COLLECTION_SUCCEEDED, T.COLLECTION_FAILED):
        pay = db.scalars(select(models.Payment).where(models.Payment.reference == ev.reference, models.Payment.provider == provider).with_for_update()).first() if ev.reference else None
        if not pay:
            return "unmatched", "no payment with that reference"
        ok = ev.type == T.COLLECTION_SUCCEEDED
        payments.settle(db, pay, VerificationResult(CollectionStatus.SUCCEEDED if ok else CollectionStatus.FAILED, ev.amount_kobo, ev.provider_ref, ev.occurred_at))
        return ("applied" if pay.status != "unverified" else "held"), pay.status
    if ev.type == T.VIRTUAL_ACCOUNT_CREDIT:
        va = db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.provider == provider, models.VirtualAccount.account_number == ev.account_number)).first() if ev.account_number else None
        if not va:
            return "unmatched", "no virtual account with that number"
        outcome, _ = payments.credit_received(db, va, ev)
        return outcome, None
    if ev.type in (T.PAYOUT_COMPLETED, T.PAYOUT_FAILED, T.PAYOUT_REVERSED):
        payout = db.scalars(select(models.Payout).where(models.Payout.reference == ev.reference, models.Payout.provider == provider).with_for_update()).first() if ev.reference else None
        if not payout:
            return "unmatched", "no payout with that reference"
        payments.complete_payout(db, payout, ev.type == T.PAYOUT_COMPLETED, ev.failure_reason)
        return "applied", payout.status
    return "unmatched", "unhandled event type"


def handle(db: Session, provider_name: str, headers: Mapping[str, str], raw: bytes) -> dict:
    if provider_name not in registry.known():
        raise HTTPException(404, "not found")   # don't echo the registry to the public internet
    with provider_errors():
        prov = registry.get(provider_name)
        prov.verify_webhook({k.lower(): v for k, v in headers.items()}, raw)
        events_ = prov.parse_webhook(raw)
    results = []
    for ev in events_:
        row = _store(db, provider_name, ev)
        if row is None:   # replay: acknowledge with what we recorded the first time
            first = db.scalars(select(models.ProviderEvent).where(models.ProviderEvent.provider == provider_name, models.ProviderEvent.event_id == ev.event_id)).first()
            results.append({"eventId": ev.event_id, "outcome": "duplicate", "detail": first.note if first else None})
            continue
        outcome, note = _apply(db, provider_name, ev)
        row.outcome, row.note = outcome, note
        results.append({"eventId": ev.event_id, "outcome": outcome, "detail": note})
    db.commit()
    return {"received": len(events_), "events": results}
