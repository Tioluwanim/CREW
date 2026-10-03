"""Persistence layer. Every monetary column is integer KOBO; the API converts to
integer naira at the boundary (see intelligence/money.py and docs/NTELLIGENCE_ENGINE.md)."""
from __future__ import annotations

import secrets
from datetime import date, datetime, timezone

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("usr"))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    token_version: Mapped[int] = mapped_column(Integer, default=0)  # bump to invalidate every issued token
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    profile: Mapped["CreativeProfile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class CreativeProfile(Base):
    __tablename__ = "profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("prof"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    business_name: Mapped[str] = mapped_column(String, default="")
    craft: Mapped[str] = mapped_column(String, default="")
    location: Mapped[str] = mapped_column(String, default="")
    owner_name: Mapped[str] = mapped_column(String, default="")
    typical_deposit_pct: Mapped[int] = mapped_column(Integer, default=50)
    starting_cash_kobo: Mapped[int] = mapped_column(BigInteger, default=0)
    # Consent (frontend `Consent` type)
    consent_project_activity: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_payment_activity: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_business_patterns: Mapped[bool] = mapped_column(Boolean, default=False)
    sharing_level: Mapped[str] = mapped_column(String, default="never")
    # Where released funds are paid. Encrypt at rest before production (KMS / pgcrypto); never returned unmasked.
    payout_bank_code: Mapped[str | None] = mapped_column(String, nullable=True)
    payout_account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    payout_account_name: Mapped[str | None] = mapped_column(String, nullable=True)
    payout_account_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User] = relationship(back_populates="profile")


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("cli"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    preferred_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    billing_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    projects: Mapped[list["Project"]] = relationship(back_populates="client")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("prj"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"))
    name: Mapped[str] = mapped_column(String)
    craft: Mapped[str] = mapped_column(String, default="")
    revenue_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    deposit_pct: Mapped[int] = mapped_column(Integer, default=0)
    expected_payment_days: Mapped[int] = mapped_column(Integer, default=14)
    revisions_included: Mapped[int] = mapped_column(Integer, default=2)
    stage: Mapped[str] = mapped_column(String, default="brief")  # see services/lifecycle.py
    start_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    client: Mapped[Client] = relationship(back_populates="projects")
    costs: Mapped[list["Cost"]] = relationship(back_populates="project", cascade="all, delete-orphan", order_by="Cost.created_at")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="project", cascade="all, delete-orphan", order_by="Deliverable.position")
    milestones: Mapped[list["Milestone"]] = relationship(back_populates="project", cascade="all, delete-orphan", order_by="Milestone.position")
    change_requests: Mapped[list["ChangeRequest"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    events: Mapped[list["ActivityEvent"]] = relationship(back_populates="project", cascade="all, delete-orphan", order_by="ActivityEvent.seq")


class Cost(Base):
    __tablename__ = "costs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("cost"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    label: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, default="other")  # free-form (docs/DECISIONS.md #1)
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    estimated_amount_kobo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # original quote, for overrun tracking
    funded_by: Mapped[str] = mapped_column(String, default="creator")  # creator | client
    paid_on_day: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    project: Mapped[Project] = relationship(back_populates="costs")


class Deliverable(Base):
    __tablename__ = "deliverables"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("dlv"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | delivered | approved | revision_requested
    position: Mapped[int] = mapped_column(Integer, default=0)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence_url: Mapped[str | None] = mapped_column(String, nullable=True)
    project: Mapped[Project] = relationship(back_populates="deliverables")
    revisions: Mapped[list["Revision"]] = relationship(back_populates="deliverable", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("mst"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    deliverable_id: Mapped[str | None] = mapped_column(ForeignKey("deliverables.id"), nullable=True)
    change_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    funded_kobo: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | funded | released
    position: Mapped[int] = mapped_column(Integer, default=0)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    project: Mapped[Project] = relationship(back_populates="milestones")


class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("rev"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    deliverable_id: Mapped[str] = mapped_column(ForeignKey("deliverables.id"))
    number: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(Text)
    requested_by: Mapped[str] = mapped_column(String, default="client")
    status: Mapped[str] = mapped_column(String, default="open")  # open | resolved
    within_scope: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deliverable: Mapped[Deliverable] = relationship(back_populates="revisions")


class ChangeRequest(Base):
    __tablename__ = "change_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("chg"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    amount_kobo: Mapped[int] = mapped_column(BigInteger, default=0)
    requested_by: Mapped[str] = mapped_column(String, default="creator")
    status: Mapped[str] = mapped_column(String, default="proposed")  # proposed | accepted | declined
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    project: Mapped[Project] = relationship(back_populates="change_requests")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("inv"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    kind: Mapped[str] = mapped_column(String, default="deposit")  # deposit | balance | milestone | change
    milestone_id: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String, default="draft")  # draft | pending_approval | sent | paid | void
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    project: Mapped[Project] = relationship(back_populates="invoices")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("reference", name="uq_payment_reference"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("pay"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    reference: Mapped[str] = mapped_column(String, index=True)
    provider_ref: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    virtual_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | unverified | verified | failed
    method: Mapped[str] = mapped_column(String, default="link")  # manual | link | virtual_account
    provider: Mapped[str] = mapped_column(String, default="sandbox")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    project: Mapped[Project] = relationship(back_populates="payments")


class Payout(Base):
    """Release of held funds to the creator after client approval."""
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("out"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    milestone_id: Mapped[str] = mapped_column(String)
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    reference: Mapped[str] = mapped_column(String, unique=True)
    provider: Mapped[str] = mapped_column(String)
    provider_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="completed")  # pending | completed | failed | reversed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ShareLink(Base):
    __tablename__ = "share_links"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("shl"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    token: Mapped[str] = mapped_column(String, unique=True, index=True, default=lambda: secrets.token_urlsafe(24))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivityEvent(Base):
    """Append-only, hash-chained evidence timeline. Never updated or deleted."""
    __tablename__ = "activity_events"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id: Mapped[str] = mapped_column(String, unique=True, default=lambda: new_id("evt"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    actor: Mapped[str] = mapped_column(String)  # creator | client | system | provider
    kind: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    client_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    prev_hash: Mapped[str] = mapped_column(String, default="")
    hash: Mapped[str] = mapped_column(String, default="")
    project: Mapped[Project] = relationship(back_populates="events")


class Transaction(Base):
    """Normalized money-movement ledger: the single table the intelligence layer
    and any future ML pipeline read from (Ecobank/sandbox -> DB -> normalized -> intelligence)."""
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("txn"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    direction: Mapped[str] = mapped_column(String)  # inflow | outflow
    amount_kobo: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    occurred_on: Mapped[date] = mapped_column(Date)
    category: Mapped[str] = mapped_column(String, default="")
    source: Mapped[str] = mapped_column(String)  # sandbox | ecobank | manual
    source_ref: Mapped[str] = mapped_column(String, unique=True)  # idempotency key


class ModelRun(Base):
    __tablename__ = "model_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("run"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    model_version: Mapped[str] = mapped_column(String)
    architecture: Mapped[str] = mapped_column(String)
    dataset_version: Mapped[str] = mapped_column(String)
    training_sample_count: Mapped[int] = mapped_column(Integer, default=0)
    training_cutoff: Mapped[date | None] = mapped_column(Date, nullable=True)
    validation_cutoff: Mapped[date | None] = mapped_column(Date, nullable=True)
    validation_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    artifact_reference: Mapped[str | None] = mapped_column(String, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    predictions: Mapped[list["ModelPrediction"]] = relationship(back_populates="model_run", cascade="all, delete-orphan")


class ModelPrediction(Base):
    __tablename__ = "model_predictions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("pred"))
    model_run_id: Mapped[str] = mapped_column(ForeignKey("model_runs.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    predicted_delay_days: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    prediction_cutoff: Mapped[date] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), default="NGN")
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String, default="advisory")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    model_run: Mapped[ModelRun] = relationship(back_populates="predictions")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ntf"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True)
    kind: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String, default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("fbk"))
    name: Mapped[str] = mapped_column(String)
    craft: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)
    quote: Mapped[str] = mapped_column(Text)
    avatar: Mapped[str] = mapped_column(String, default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String, default="")
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Message(Base):
    """Outbox: every client-facing message is stored before it is sent, so it can be retried and audited."""
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("msg"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    kind: Mapped[str] = mapped_column(String)  # invoice_sent | invoice_reminder | payment_receipt
    channel: Mapped[str] = mapped_column(String, default="email")  # email | sms
    recipient: Mapped[str] = mapped_column(String)
    subject: Mapped[str] = mapped_column(String, default="")
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="queued")  # queued | sent | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("scope", "key", name="uq_idem_scope_key"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("idk"))
    scope: Mapped[str] = mapped_column(String)  # user id, or "share:<token-hash>"
    key: Mapped[str] = mapped_column(String)
    request_hash: Mapped[str] = mapped_column(String)
    status_code: Mapped[int] = mapped_column(Integer)
    response: Mapped[dict | list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class VirtualAccount(Base):
    """A dedicated account number a client transfers to. Provider-agnostic: `provider` says which adapter owns it."""
    __tablename__ = "virtual_accounts"
    __table_args__ = (UniqueConstraint("provider", "account_number", name="uq_va_provider_number"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("va"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    provider: Mapped[str] = mapped_column(String)
    reference: Mapped[str] = mapped_column(String, unique=True)
    provider_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    account_number: Mapped[str] = mapped_column(String, index=True)
    account_name: Mapped[str] = mapped_column(String)
    bank_name: Mapped[str] = mapped_column(String)
    bank_code: Mapped[str | None] = mapped_column(String, nullable=True)
    expected_amount_kobo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String, default="open")  # open | closed | expired
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProviderEvent(Base):
    """Every webhook we accept, once. The unique key makes replays harmless; the row is the audit trail and the
    fallback statement for providers that cannot list transactions."""
    __tablename__ = "provider_events"
    __table_args__ = (UniqueConstraint("provider", "event_id", name="uq_provider_event"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("pev"))
    provider: Mapped[str] = mapped_column(String)
    event_id: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    reference: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    provider_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_kobo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[str] = mapped_column(String, default="received")  # received | applied | unmatched | held | error
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("rrun"))
    provider: Mapped[str] = mapped_column(String, index=True)
    source: Mapped[str] = mapped_column(String)  # statement | webhook_log
    since: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    internal_count: Mapped[int] = mapped_column(Integer, default=0)
    external_count: Mapped[int] = mapped_column(Integer, default=0)
    matched_count: Mapped[int] = mapped_column(Integer, default=0)
    discrepancy_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    balanced: Mapped[bool] = mapped_column(Boolean, default=False)
    totals: Mapped[dict] = mapped_column(JSON, default=dict)


class ReconciliationItem(Base):
    """One open problem. The same problem seen in several runs is ONE item (matched on `fingerprint`)."""
    __tablename__ = "reconciliation_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ritem"))
    fingerprint: Mapped[str] = mapped_column(String, index=True)
    provider: Mapped[str] = mapped_column(String, index=True)
    first_run_id: Mapped[str] = mapped_column(String)
    last_run_id: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(String)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    owner_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    internal_key: Mapped[str | None] = mapped_column(String, nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    external_account: Mapped[str | None] = mapped_column(String, nullable=True)
    external_amount_kobo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    external_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delta_kobo: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String, default="open")  # open | resolved | ignored | auto_resolved
    resolution_note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
