"""add document_chats table

Revision ID: a7f9c2d1e4b3
Revises: 32690390e072
Create Date: 2026-03-04 11:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7f9c2d1e4b3"
down_revision: Union[str, Sequence[str], None] = "32690390e072"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_chats",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["pdf_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_chats_document_id", "document_chats", ["document_id"], unique=False)
    op.create_index("ix_document_chats_created_at", "document_chats", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_document_chats_created_at", table_name="document_chats")
    op.drop_index("ix_document_chats_document_id", table_name="document_chats")
    op.drop_table("document_chats")
