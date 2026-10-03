"""Add explicit currency and international client context.

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("projects", "costs", "milestones", "invoices", "payments", "payouts", "transactions"):
        op.add_column(table, sa.Column("currency", sa.String(length=3), nullable=False, server_default="NGN"))
    op.add_column("clients", sa.Column("country", sa.String(), nullable=True))
    op.add_column("clients", sa.Column("preferred_currency", sa.String(length=3), nullable=True))
    op.add_column("clients", sa.Column("billing_currency", sa.String(length=3), nullable=True))
    op.add_column("clients", sa.Column("timezone", sa.String(), nullable=True))


def downgrade() -> None:
    for table in ("transactions", "payouts", "payments", "invoices", "milestones", "costs", "projects"):
        op.drop_column(table, "currency")
    op.drop_column("clients", "timezone")
    op.drop_column("clients", "billing_currency")
    op.drop_column("clients", "preferred_currency")
    op.drop_column("clients", "country")
