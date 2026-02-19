from pydantic import BaseModel
from uuid import UUID


class UploadResponse(BaseModel):
    message: str
    chunks_created: int
    document_id: UUID
    index_status: str
