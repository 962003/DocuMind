from pydantic import BaseModel, Field
from uuid import UUID


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, description="User question")
    document_id: UUID = Field(..., description="Uploaded document UUID")
    top_k: int = Field(default=5, ge=1, le=10)


class AskResponse(BaseModel):
    answer: str
    document_id: UUID
