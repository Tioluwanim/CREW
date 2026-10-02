from app import models
from app.config import get_settings
from app.services import finance
from app.services.finance import naira


def cost_out(c: models.Cost) -> dict:
    return {"id": c.id, "label": c.label, "category": c.category, "amount": naira(c.amount_kobo), "estimatedAmount": naira(c.estimated_amount_kobo) if c.estimated_amount_kobo is not None else None, "fundedBy": c.funded_by, "paidOnDay": c.paid_on_day}


def deliverable_out(d: models.Deliverable) -> dict:
    return {"id": d.id, "title": d.title, "description": d.description, "dueDate": d.due_date.isoformat() if d.due_date else None,
            "status": d.status, "evidenceUrl": d.evidence_url, "revisions": len(d.revisions)}


def milestone_out(m: models.Milestone) -> dict:
    return {"id": m.id, "title": m.title, "amount": naira(m.amount_kobo), "funded": naira(m.funded_kobo), "status": m.status, "deliverableId": m.deliverable_id}


def change_out(c: models.ChangeRequest) -> dict:
    return {"id": c.id, "title": c.title, "description": c.description, "amount": naira(c.amount_kobo), "status": c.status, "requestedBy": c.requested_by}


def event_out(e: models.ActivityEvent, full: bool = False) -> dict:
    out = {"id": e.id, "label": e.label, "timestamp": e.created_at.isoformat()}
    if full:
        out.update(actor=e.actor, kind=e.kind, meta=e.meta, hash=e.hash, prevHash=e.prev_hash, clientVisible=e.client_visible)
    return out


def project_out(p: models.Project) -> dict:
    return {
        "id": p.id, "name": p.name, "clientId": p.client_id, "clientName": p.client.name, "craft": p.craft,
        "revenue": naira(p.revenue_kobo), "depositPct": p.deposit_pct, "costs": [cost_out(c) for c in p.costs],
        "expectedPaymentDays": p.expected_payment_days, "status": finance.public_status(p), "createdAt": p.created_at.isoformat(),
        "activity": [event_out(e) for e in reversed(p.events)],
        "stage": p.stage, "startDate": p.start_date.isoformat(), "revisionsIncluded": p.revisions_included,
        "deliverables": [deliverable_out(d) for d in p.deliverables], "milestones": [milestone_out(m) for m in p.milestones],
        "changeRequests": [change_out(c) for c in p.change_requests],
    }


def invoice_out(i: models.Invoice, token: str | None) -> dict:
    p = i.project
    dep = finance.deposit_kobo(p)
    link = f"{get_settings().public_app_url}/pay/{token}?invoice={i.id}" if token else ""
    return {"id": i.id, "projectId": i.project_id, "clientName": p.client.name, "amount": naira(i.amount_kobo), "depositPct": p.deposit_pct,
            "depositAmount": naira(dep), "balance": naira(p.revenue_kobo - dep), "dueDate": i.due_date.isoformat(),
            "status": i.status, "kind": i.kind, "paymentLink": link}


def payment_out(p: models.Payment) -> dict:
    return {"id": p.id, "invoiceId": p.invoice_id, "projectId": p.project_id, "reference": p.reference, "amount": naira(p.amount_kobo),
            "status": p.status, "method": p.method, "provider": p.provider, "createdAt": p.created_at.isoformat(),
            "verifiedAt": p.verified_at.isoformat() if p.verified_at else None}


def verification_out(p: models.Payment) -> dict:
    out = {"paymentReference": p.reference, "status": "pending" if p.status == "unverified" else p.status,
           "amount": naira(p.amount_kobo), "currency": "NGN"}
    if p.verified_at:
        out["verifiedAt"] = p.verified_at.isoformat()
    return out
