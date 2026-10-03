"""Persist advisory payment-delay model runs and predictions.

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("model_version", sa.String(), nullable=False),
        sa.Column("architecture", sa.String(), nullable=False),
        sa.Column("dataset_version", sa.String(), nullable=False),
        sa.Column("training_sample_count", sa.Integer(), nullable=False),
        sa.Column("training_cutoff", sa.Date(), nullable=True),
        sa.Column("validation_cutoff", sa.Date(), nullable=True),
        sa.Column("validation_metrics", sa.JSON(), nullable=False),
        sa.Column("artifact_reference", sa.String(), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_runs_owner_id", "model_runs", ["owner_id"])
    op.create_table(
        "model_predictions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("model_run_id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("predicted_delay_days", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("prediction_cutoff", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["model_run_id"], ["model_runs.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_predictions_model_run_id", "model_predictions", ["model_run_id"])
    op.create_index("ix_model_predictions_owner_id", "model_predictions", ["owner_id"])
    op.create_index("ix_model_predictions_project_id", "model_predictions", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_model_predictions_project_id", table_name="model_predictions")
    op.drop_index("ix_model_predictions_owner_id", table_name="model_predictions")
    op.drop_index("ix_model_predictions_model_run_id", table_name="model_predictions")
    op.drop_table("model_predictions")
    op.drop_index("ix_model_runs_owner_id", table_name="model_runs")
    op.drop_table("model_runs")
