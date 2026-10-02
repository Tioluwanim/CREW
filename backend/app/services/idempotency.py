"""Idempotency-Key support for create endpoints, so a retried request (flaky mobile network) never
creates a second project/invoice/payment intent.

Same key + same request -> the stored response is replayed. Same key + different request -> 422.
The key row is written in the SAME transaction as the work, so a crash can't leave one without the other."""
import hashlib
import json
from typing import Any, Callable

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models


def fingerprint(path: str, body: Any) -> str:
    return hashlib.sha256((path + json.dumps(body, sort_keys=True, default=str)).encode()).hexdigest()


def _lookup(db: Session, scope: str, key: str):
    return db.scalars(select(models.IdempotencyKey).where(models.IdempotencyKey.scope == scope, models.IdempotencyKey.key == key)).first()


def run(db: Session, scope: str, key: str | None, fp: str, fn: Callable[[], Any], status: int = 200):
    """fn() does the work WITHOUT committing and returns a JSON-serialisable payload."""
    if key is not None and not (1 <= len(key) <= 200):
        raise HTTPException(422, "Idempotency-Key must be 1-200 characters")

    def replay(row):
        if row.request_hash != fp:
            raise HTTPException(422, "Idempotency-Key was already used with a different request")
        return JSONResponse(row.response, status_code=row.status_code, headers={"Idempotent-Replay": "true"})

    if key is None:
        payload = fn()
        db.commit()
        return JSONResponse(payload, status_code=status)
    if (row := _lookup(db, scope, key)):
        return replay(row)
    payload = fn()
    db.add(models.IdempotencyKey(scope=scope, key=key, request_hash=fp, status_code=status, response=json.loads(json.dumps(payload, default=str))))
    try:
        db.commit()
    except IntegrityError:  # a concurrent request with the same key won the race
        db.rollback()
        return replay(_lookup(db, scope, key))
    return JSONResponse(payload, status_code=status)


def purge_old(db: Session, hours: int = 24) -> int:
    from datetime import timedelta
    cutoff = models.utcnow() - timedelta(hours=hours)
    rows = db.scalars(select(models.IdempotencyKey).where(models.IdempotencyKey.created_at < cutoff)).all()
    for r in rows:
        db.delete(r)
    return len(rows)
