"""Client-facing messages via a transactional outbox.

Every message is stored first (queued), then delivered; failures are kept for retry and audit.
Senders:
  * SmtpSender    - real, stdlib smtplib, used when SMTP_HOST is set.
  * ConsoleSender - development fallback. Writes to the log and marks the message `logged`
                    (NOT `sent`) so nobody mistakes it for real delivery.
  * SMS           - no provider is wired. SMS messages fail with a clear error until one is added
                    (implement `Sender` for your provider and return it from `sender_for`).
Messages are always creator-initiated (send/remind); nothing is auto-sent to clients."""
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.services import events
from intelligence.dates import today_lagos

log = logging.getLogger("crew.messaging")
MAX_ATTEMPTS = 5


class SenderUnavailable(Exception):
    pass


class Sender(Protocol):
    name: str
    def send(self, msg: models.Message) -> None: ...


class ConsoleSender:
    name = "console"

    def send(self, msg: models.Message) -> None:
        log.info("[console mail] kind=%s subject=%r (recipient not logged)", msg.kind, msg.subject)


class SmtpSender:
    name = "smtp"

    def send(self, msg: models.Message) -> None:
        s = get_settings()
        m = EmailMessage()
        m["From"], m["To"], m["Subject"] = s.smtp_from or s.smtp_user, msg.recipient, msg.subject
        m.set_content(msg.body)
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            if s.smtp_starttls:
                smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(m)


def sender_for(channel: str) -> Sender:
    if channel == "email":
        return SmtpSender() if get_settings().smtp_host else ConsoleSender()
    raise SenderUnavailable(f"No provider configured for channel '{channel}'")


# ---------------------------------------------------------------- composing
def _share_token(db: Session, p: models.Project) -> str:
    link = db.scalars(select(models.ShareLink).where(models.ShareLink.project_id == p.id, models.ShareLink.revoked.is_(False))).first()
    if not link:
        link = models.ShareLink(project_id=p.id)
        db.add(link)
        db.flush()
    return link.token


def _business(db: Session, p: models.Project) -> str:
    pr = db.scalars(select(models.CreativeProfile).where(models.CreativeProfile.user_id == p.owner_id)).first()
    return (pr.business_name or pr.owner_name or "Your service provider") if pr else "Your service provider"


def _enqueue(db: Session, p: models.Project, kind: str, subject: str, body: str, dedupe_key: str) -> models.Message | None:
    if not p.client.email:
        return None
    if db.scalars(select(models.Message).where(models.Message.dedupe_key == dedupe_key)).first():
        return None
    msg = models.Message(owner_id=p.owner_id, project_id=p.id, kind=kind, recipient=p.client.email, subject=subject, body=body, dedupe_key=dedupe_key)
    try:
        with db.begin_nested():
            db.add(msg)
            db.flush()
    except IntegrityError:
        return None
    return msg


def queue_invoice(db: Session, inv: models.Invoice, reminder: bool = False) -> models.Message | None:
    p, biz = inv.project, _business(db, inv.project)
    link = f"{get_settings().public_app_url}/c/{_share_token(db, p)}?invoice={inv.id}"
    amount = f"₦{inv.amount_kobo // 100:,}"
    if reminder:
        subject, lead, kind, key = f"Reminder: {amount} due for {p.name}", f"A friendly reminder that {amount} for {p.name} is due on {inv.due_date.isoformat()}.", "invoice_reminder", f"reminder:{inv.id}:{today_lagos().isoformat()}"
    else:
        subject, lead, kind, key = f"Invoice from {biz}: {amount} for {p.name}", f"{biz} has sent you an invoice for {amount} ({inv.kind}) for {p.name}, due {inv.due_date.isoformat()}.", "invoice_sent", f"invoice_sent:{inv.id}"
    body = f"Hello {p.client.name},\n\n{lead}\n\nView the project, pay and follow progress here:\n{link}\n\nThank you,\n{biz}\n"
    return _enqueue(db, p, kind, subject, body, key)


def queue_receipt(db: Session, pay: models.Payment) -> models.Message | None:
    p = db.get(models.Project, pay.project_id)
    biz = _business(db, p)
    amount = f"₦{pay.amount_kobo // 100:,}"
    body = f"Hello {p.client.name},\n\nWe received your payment of {amount} for {p.name}. Reference: {pay.reference}.\n\nThank you,\n{biz}\n"
    return _enqueue(db, p, "payment_receipt", f"Payment received: {amount} for {p.name}", body, f"receipt:{pay.reference}")


# ---------------------------------------------------------------- delivery
def deliver_pending(db: Session, project_id: str | None = None, limit: int = 50) -> dict:
    q = select(models.Message).where(models.Message.status.in_(["queued", "failed"]), models.Message.attempts < MAX_ATTEMPTS)
    if project_id:
        q = q.where(models.Message.project_id == project_id)
    out = {"sent": 0, "logged": 0, "failed": 0}
    for msg in db.scalars(q.order_by(models.Message.created_at).limit(limit)).all():
        msg.attempts += 1
        try:
            sender = sender_for(msg.channel)
            sender.send(msg)
            msg.status = "sent" if sender.name != "console" else "logged"
            msg.sent_at, msg.last_error = models.utcnow(), None
            out[msg.status] += 1
            p = db.get(models.Project, msg.project_id)
            events.record(db, p, "system", "message_sent", f"{msg.kind.replace('_', ' ').capitalize()} emailed to client",
                          {"messageId": msg.id, "channel": msg.channel, "delivery": sender.name})
        except Exception as e:  # keep for retry; never leak SMTP credentials into the error
            msg.status, msg.last_error = "failed", type(e).__name__ + (f": {e}" if isinstance(e, SenderUnavailable) else "")
            out["failed"] += 1
    db.commit()
    return out
