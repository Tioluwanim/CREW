import time
from collections import defaultdict, deque

from sqlalchemy import select
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.db import get_db
from app.security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> models.User:
    decoded = decode_token(creds.credentials) if creds else None
    user = db.get(models.User, decoded[0]) if decoded else None
    if user and user.token_version != decoded[1]:
        user = None  # token issued before a password change / logout-all
    if not user and not creds and get_settings().demo_auto_auth:
        # Dev-only bridge so the frontend can run against the API before it sends tokens.
        user = db.scalars(select(models.User).where(models.User.email == "amara@crew.demo")).first()
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def owned_project(project_id: str, user: models.User, db: Session) -> models.Project:
    """404 (not 403) for other people's projects so ids can't be probed."""
    p = db.get(models.Project, project_id)
    if not p or p.owner_id != user.id:
        raise HTTPException(404, "not found")
    return p


class RateLimiter:
    """Small in-memory sliding-window limiter for the public (no-signup) client routes.
    Swap for Redis when running more than one process."""

    def __init__(self, limit: int, window_s: int):
        self.limit, self.window, self.hits = limit, window_s, defaultdict(deque)

    def __call__(self, request: Request):
        key = request.client.host if request.client else "anon"
        now, q = time.monotonic(), self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(429, "Too many requests")
        q.append(now)


public_limiter = RateLimiter(limit=120, window_s=60)
