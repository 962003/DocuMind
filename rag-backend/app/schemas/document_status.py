from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentStatusResponse(BaseModel):
    document_id: UUID
    filename: str
    index_status: str
    chunks_created: int
    error_message: str | None
    uploaded_at: datetime | None


class DocumentSummary(BaseModel):
    document_id: UUID
    filename: str
    index_status: str
    chunk_count: int
    uploaded_at: datetime | None


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary] = []
