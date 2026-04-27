"""add name column to users

Revision ID: d1a2b3c4e5f6
Revises: c9d1e2f3a4b5
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "d1a2b3c4e5f6"
down_revision = "c9d1e2f3a4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "name")
