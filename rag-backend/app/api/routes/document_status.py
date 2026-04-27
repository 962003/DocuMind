from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit, get_current_user
from app.db.session import get_db
from app.models import PDFDocument, User
from app.schemas.document_status import DocumentStatusResponse

router = APIRouter(tags=["document-status"])
route_dependencies = [Depends(enforce_rate_limit)]


@router.get(
    "/document-status/{document_id}",
    response_model=DocumentStatusResponse,
    dependencies=route_dependencies,
)
def document_status(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.get(PDFDocument, document_id)
    if not document or document.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentStatusResponse(
        document_id=document.id,
        filename=document.filename,
        index_status=document.index_status,
        chunks_created=document.chunk_count,
        error_message=document.error_message,
        uploaded_at=document.uploaded_at,
    )
