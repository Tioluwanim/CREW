"""Feeds the pure ReconciliationEngine with data from the DB and the provider, and persists what it finds.

External side, in order of preference:
  1. the provider's own statement   (capabilities.statement)  -> full reconciliation
  2. our stored webhook log         (fallback)                -> weaker: it can only prove what the provider TOLD us,
                                                                 so run.source says `webhook_log` and it cannot detect
                                                                 money the provider never announced.
Auto-posting an unrecorded credit is OFF by default: touching money records should be a human decision."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.payments import registry
from app.payments.domain import (
    CollectionStatus, Direction, ProviderTransaction, TxnStatus, VerificationResult, WebhookEventType, as_utc,
)
from app.payments.errors import NotSupported, ProviderError
from app.payments.reconciliation import DiscrepancyKind, InternalEntry, Policy, ReconciliationEngine, Severity
from app.services import events, payments


def _internal(db: Session, provider: str, since: datetime, until: datetime) -> list[InternalEntry]:
    out: list[InternalEntry] = []
    pays = db.scalars(select(models.Payment).where(models.Payment.provider == provider)).all()
    va_num = {v.id: v.account_number for v in db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.provider == provider))}
    for p in pays:
        at = as_utc(p.verified_at or p.created_at)
        if not (since <= at < until):
            continue
        out.append(InternalEntry(key=p.reference, direction=Direction.INBOUND, amount_kobo=p.amount_kobo, status=p.status, occurred_at=at, kind="collection",
                                 provider_ref=p.provider_ref, account_number=va_num.get(p.virtual_account_id), project_id=p.project_id, entry_id=p.id))
    for o in db.scalars(select(models.Payout).where(models.Payout.provider == provider)):
        at = as_utc(o.created_at)
        if since <= at < until and o.status in ("completed", "pending"):
            out.append(InternalEntry(key=o.reference, direction=Direction.OUTBOUND, amount_kobo=o.amount_kobo, status=o.status, occurred_at=at, kind="payout",
                                     provider_ref=o.provider_ref, project_id=o.project_id, entry_id=o.id))
    return out


def _external(db: Session, provider: str, since: datetime, until: datetime) -> tuple[list[ProviderTransaction], str]:
    prov = registry.get(provider)
    if not prov.capabilities.statement and not prov.capabilities.webhooks:
        # Nothing to compare against. Reporting "balanced" here would be a lie of omission.
        raise ValueError(f"{provider} cannot be reconciled: it offers neither a statement nor webhooks")
    if prov.capabilities.statement:
        return list(prov.list_transactions(since, until)), "statement"
    rows = db.scalars(select(models.ProviderEvent).where(models.ProviderEvent.provider == provider, models.ProviderEvent.occurred_at >= since,
                                                          models.ProviderEvent.occurred_at < until)).all()
    T, txns = WebhookEventType, []
    for r in rows:
        if r.type in (T.COLLECTION_SUCCEEDED.value, T.VIRTUAL_ACCOUNT_CREDIT.value) and r.amount_kobo:
            txns.append(ProviderTransaction(r.provider_ref or r.event_id, Direction.INBOUND, r.amount_kobo, TxnStatus.SUCCESSFUL, as_utc(r.occurred_at), r.reference, r.account_number))
        elif r.type == T.PAYOUT_COMPLETED.value and r.amount_kobo:
            txns.append(ProviderTransaction(r.provider_ref or r.event_id, Direction.OUTBOUND, r.amount_kobo, TxnStatus.SUCCESSFUL, as_utc(r.occurred_at), r.reference))
    return txns, "webhook_log"


def run(db: Session, provider: str, *, hours: int = 48, autopost: bool = False, now: datetime | None = None,
        policy: Policy = Policy()) -> models.ReconciliationRun:
    now = now or models.utcnow()
    since, until = now - timedelta(hours=hours), now + timedelta(minutes=1)
    internal = _internal(db, provider, since, until)
    external, source = _external(db, provider, since, until)
    result = ReconciliationEngine(policy=policy).reconcile(internal, external, since=since, until=until, now=now)

    run_ = models.ReconciliationRun(provider=provider, source=source, since=since, until=until, started_at=now, internal_count=len(internal), external_count=len(external),
                                    matched_count=len(result.matched), discrepancy_count=len(result.discrepancies),
                                    critical_count=sum(d.severity == Severity.CRITICAL for d in result.discrepancies), balanced=result.balanced,
                                    totals={"internalInKobo": result.internal_in_kobo, "externalInKobo": result.external_in_kobo,
                                            "internalOutKobo": result.internal_out_kobo, "externalOutKobo": result.external_out_kobo})
    db.add(run_)
    db.flush()

    for i, _e in result.matched:   # matched money is reconciled
        if i.kind == "collection" and i.entry_id and i.status == "verified":
            p = db.get(models.Payment, i.entry_id)
            if p and not p.reconciled_at:
                p.reconciled_at = now

    seen: set[str] = set()
    va_owner = {v.account_number: v for v in db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.provider == provider))}
    for d in result.discrepancies:
        seen.add(d.fingerprint)
        proj_id = d.internal.project_id if d.internal else None
        if not proj_id and d.external and d.external.account_number in va_owner:
            proj_id = va_owner[d.external.account_number].project_id
        owner = db.get(models.Project, proj_id).owner_id if proj_id else None
        item = db.scalars(select(models.ReconciliationItem).where(models.ReconciliationItem.fingerprint == d.fingerprint, models.ReconciliationItem.status == "open")).first()
        if item:
            item.last_run_id, item.severity, item.message = run_.id, d.severity.value, d.message
            continue
        db.add(models.ReconciliationItem(
            fingerprint=d.fingerprint, provider=provider, first_run_id=run_.id, last_run_id=run_.id, kind=d.kind.value, severity=d.severity.value, message=d.message,
            project_id=proj_id, owner_id=owner, internal_key=d.internal.key if d.internal else None, external_ref=d.external.provider_ref if d.external else None,
            external_account=d.external.account_number if d.external else None, external_amount_kobo=d.external.amount_kobo if d.external else None,
            external_at=d.external.occurred_at if d.external else None, delta_kobo=d.delta_kobo))
        if d.severity == Severity.CRITICAL and proj_id:
            events.record(db, db.get(models.Project, proj_id), "system", "reconciliation_flag", "Payment record needs review", {"kind": d.kind.value}, client_visible=False)
            events.notify(db, db.get(models.Project, proj_id), "reconciliation_flag", "Payment needs review", d.message)

    # anything that was open, sits inside this window, and is no longer reported has healed on its own (e.g. a late statement line)
    for item in db.scalars(select(models.ReconciliationItem).where(models.ReconciliationItem.provider == provider, models.ReconciliationItem.status == "open")):
        if item.fingerprint not in seen and item.last_run_id != run_.id:
            item.status, item.resolved_at, item.resolution_note = "auto_resolved", now, "no longer reported by a later run"

    if autopost:
        for item in db.scalars(select(models.ReconciliationItem).where(models.ReconciliationItem.provider == provider, models.ReconciliationItem.status == "open",
                                                                        models.ReconciliationItem.kind == DiscrepancyKind.UNRECORDED_AT_PLATFORM.value)):
            if item.external_account in va_owner and item.external_amount_kobo:
                resolve_credit(db, item, note="auto-posted by reconciliation")
    db.commit()
    return run_


def resolve_credit(db: Session, item: models.ReconciliationItem, project_id: str | None = None, note: str = "") -> models.Payment:
    """Ops decision: book an unrecorded provider credit to a project. Uses the same path as a live webhook, so all the
    normal rules (outstanding cap, closed project, expected amount) still apply - money that fails them is held."""
    va = db.scalars(select(models.VirtualAccount).where(models.VirtualAccount.provider == item.provider, models.VirtualAccount.account_number == item.external_account)).first()
    if project_id and (not va or va.project_id != project_id):
        raise ValueError("project does not own that virtual account")
    if not va:
        raise ValueError("no virtual account for this credit; resolve it manually with 'ignore' and a note")
    from app.payments.domain import WebhookEvent
    ev = WebhookEvent(event_id=f"recon-{item.external_ref}", type=WebhookEventType.VIRTUAL_ACCOUNT_CREDIT, occurred_at=as_utc(item.external_at or models.utcnow()),
                      provider_ref=item.external_ref, amount_kobo=item.external_amount_kobo, account_number=item.external_account)
    outcome, pay = payments.credit_received(db, va, ev)
    item.status, item.resolved_at = "resolved", models.utcnow()
    item.resolution_note = f"{note} ({outcome})".strip()
    return pay
