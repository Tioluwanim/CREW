"""Append-only, hash-chained evidence timeline + notifications."""
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def _ts(dt) -> str:
    """Stable across DBs: SQLite drops tzinfo, so always hash naive-UTC."""
    from datetime import timezone
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat()


def _digest(prev: str, project_id: str, actor: str, kind: str, label: str, meta: dict, ts: str) -> str:
    body = json.dumps([prev, project_id, actor, kind, label, meta, ts], sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode()).hexdigest()


def record(db: Session, project: models.Project, actor: str, kind: str, label: str,
           meta: dict | None = None, client_visible: bool = True) -> models.ActivityEvent:
    last = db.scalars(select(models.ActivityEvent).where(models.ActivityEvent.project_id == project.id)
                      .order_by(models.ActivityEvent.seq.desc()).limit(1)).first()
    prev = last.hash if last else ""
    ev = models.ActivityEvent(project_id=project.id, actor=actor, kind=kind, label=label,
                              meta=meta or {}, client_visible=client_visible, created_at=models.utcnow(), prev_hash=prev)
    ev.hash = _digest(prev, project.id, actor, kind, label, ev.meta, _ts(ev.created_at))
    db.add(ev)
    db.flush()
    return ev


def verify_chain(db: Session, project: models.Project) -> dict:
    events = db.scalars(select(models.ActivityEvent).where(models.ActivityEvent.project_id == project.id)
                        .order_by(models.ActivityEvent.seq)).all()
    prev = ""
    for ev in events:
        ts = _ts(ev.created_at)
        if ev.prev_hash != prev or ev.hash != _digest(prev, ev.project_id, ev.actor, ev.kind, ev.label, ev.meta, ts):
            return {"intact": False, "brokenAt": ev.id, "events": len(events)}
        prev = ev.hash
    return {"intact": True, "brokenAt": None, "events": len(events), "head": prev or None}


def notify(db: Session, project: models.Project, kind: str, title: str, body: str = "") -> None:
    db.add(models.Notification(user_id=project.owner_id, project_id=project.id, kind=kind, title=title, body=body))
