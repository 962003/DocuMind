from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit, get_current_user
from app.db.session import get_db
from app.models import PDFDocument, User
from app.schemas.document_status import DocumentListResponse, DocumentSummary

router = APIRouter(tags=["documents"])
route_dependencies = [Depends(enforce_rate_limit)]


@router.get("/documents", response_model=DocumentListResponse, dependencies=route_dependencies)
def list_user_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(PDFDocument)
        .filter(PDFDocument.owner_id == current_user.id)
        .order_by(PDFDocument.uploaded_at.desc())
        .all()
    )
    documents = [
        DocumentSummary(
            document_id=row.id,
            filename=row.filename,
            index_status=row.index_status,
            chunk_count=row.chunk_count,
            uploaded_at=row.uploaded_at,
        )
        for row in rows
    ]
    return DocumentListResponse(documents=documents)
