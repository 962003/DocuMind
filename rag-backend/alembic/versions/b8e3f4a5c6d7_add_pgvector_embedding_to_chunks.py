"""add pgvector embedding to document_chunks

Revision ID: b8e3f4a5c6d7
Revises: a7f9c2d1e4b3
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa

revision = "b8e3f4a5c6d7"
down_revision = "a7f9c2d1e4b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column(
        "document_chunks",
        sa.Column("embedding", sa.dialects.postgresql.ARRAY(sa.Float), nullable=True),
    )
    # Change column type to vector(384) using raw SQL since Alembic doesn't natively support pgvector
    op.execute("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)")
    # Create an index for fast cosine similarity search
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding "
        "ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding")
    op.drop_column("document_chunks", "embedding")
