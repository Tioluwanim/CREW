"""Pydantic models. Wire format is camelCase to match openapi.yaml; money is integer naira."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)




class RegisterIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8)
    business_name: str = ""
    craft: str = ""
    location: str = ""
    owner_name: str = ""
    typical_deposit_pct: int = Field(50, ge=0, le=100)
    starting_cash: int = Field(0, ge=0)


class LoginIn(CamelModel):
    email: EmailStr
    password: str


class ChangePasswordIn(CamelModel):
    current_password: str
    new_password: str = Field(min_length=8)


class DeleteAccountIn(CamelModel):
    password: str
    confirm: Literal["DELETE"]


class TokenOut(CamelModel):
    access_token: str
    token_type: str = "bearer"


class CostIn(CamelModel):
    label: str
    category: str = "other"
    amount: int = Field(ge=0)
    estimated_amount: int | None = Field(None, ge=0)  # what you originally budgeted; amount is the actual/current figure
    funded_by: Literal["creator", "client"] = "creator"
    paid_on_day: int = Field(0, ge=0)


class CostPatch(CamelModel):
    label: str | None = None
    category: str | None = None
    amount: int | None = Field(None, ge=0)
    estimated_amount: int | None = Field(None, ge=0)
    funded_by: Literal["creator", "client"] | None = None
    paid_on_day: int | None = Field(None, ge=0)


class DeliverableIn(CamelModel):
    title: str
    description: str = ""
    due_date: date | None = None


class MilestoneIn(CamelModel):
    title: str
    amount: int = Field(gt=0)
    deliverable_index: int | None = None  # index into the deliverables list of the same request


class ProjectIn(CamelModel):
    name: str
    client_name: str
    client_email: str | None = None
    client_phone: str | None = None
    craft: str = ""
    revenue: int = Field(gt=0)
    deposit_pct: int = Field(0, ge=0, le=100)
    expected_payment_days: int = Field(14, ge=0)
    revisions_included: int = Field(2, ge=0)
    start_date: date | None = None
    costs: list[CostIn] = []
    deliverables: list[DeliverableIn] = []
    milestones: list[MilestoneIn] = []


class ProjectPatch(CamelModel):
    name: str | None = None
    craft: str | None = None
    revenue: int | None = Field(None, gt=0)
    deposit_pct: int | None = Field(None, ge=0, le=100)
    expected_payment_days: int | None = Field(None, ge=0)
    revisions_included: int | None = Field(None, ge=0)


class TransitionIn(CamelModel):
    to: Literal["agreed", "in_progress", "in_review", "closed"]


class ChangeRequestIn(CamelModel):
    title: str
    description: str = ""
    amount: int = Field(ge=0)


class RevisionIn(CamelModel):
    note: str = Field(min_length=1)


class InvoiceIn(CamelModel):
    kind: Literal["deposit", "balance", "milestone", "change"] = "deposit"
    milestone_id: str | None = None
    due_in_days: int = Field(7, ge=0)


class PaymentVerifyIn(CamelModel):
    payment_reference: str
    invoice_id: str | None = None
    amount: int = Field(ge=0)
    currency: Literal["NGN"] = "NGN"


class ProfilePatch(CamelModel):
    business_name: str | None = None
    craft: str | None = None
    location: str | None = None
    owner_name: str | None = None
    typical_deposit_pct: int | None = Field(None, ge=0, le=100)
    starting_cash: int | None = Field(None, ge=0)


class ConsentIO(CamelModel):
    project_activity: bool
    payment_activity: bool
    business_patterns: bool
    sharing_level: Literal["never", "ask_each_time", "specific_partners"]


class PublicApprove(CamelModel):
    deliverable_id: str | None = None  # omit to approve every delivered deliverable


class PublicRevision(CamelModel):
    deliverable_id: str
    note: str = Field(min_length=1)


class PublicPayIn(CamelModel):
    invoice_id: str | None = None
    method: Literal["checkout", "virtual_account", "transfer"] = "checkout"
    amount: int | None = Field(None, gt=0)


class PayoutAccountIn(CamelModel):
    bank_code: str = Field(min_length=2, max_length=10)
    account_number: str = Field(pattern=r"^\d{10}$")
    account_name: str = Field(min_length=2)


class SandboxTransferIn(CamelModel):
    project_id: str
    amount: int = Field(gt=0)
    event_id: str | None = None


class ChatIn(CamelModel):
    message: str
    project_id: str | None = None


class WebhookIn(CamelModel):
    reference: str
    status: Literal["verified", "failed"]
    amount_kobo: int = Field(ge=0)
