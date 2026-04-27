"""add users table and owner_id on pdf_documents

Revision ID: c9d1e2f3a4b5
Revises: b8e3f4a5c6d7
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = "c9d1e2f3a4b5"
down_revision = "b8e3f4a5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Wipe existing documents (cascades to chunks and chats) since they have no owner.
    op.execute("TRUNCATE TABLE pdf_documents CASCADE")

    op.add_column(
        "pdf_documents",
        sa.Column("owner_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_pdf_documents_owner_id_users",
        source_table="pdf_documents",
        referent_table="users",
        local_cols=["owner_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_pdf_documents_owner_id", "pdf_documents", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_pdf_documents_owner_id", table_name="pdf_documents")
    op.drop_constraint("fk_pdf_documents_owner_id_users", "pdf_documents", type_="foreignkey")
    op.drop_column("pdf_documents", "owner_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
