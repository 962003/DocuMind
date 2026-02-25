import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit, require_api_key
from app.core.config import settings
from app.db.session import get_db
from app.schemas.upload import UploadResponse
from app.services.ingestion import ingest_pdf

router = APIRouter(tags=["upload"])
route_dependencies = [Depends(enforce_rate_limit)]
if settings.BACKEND_API_KEY:
    route_dependencies.append(Depends(require_api_key))

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=UploadResponse, dependencies=route_dependencies)
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload")

    if len(contents) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max upload size of {settings.MAX_UPLOAD_MB} MB",
        )

    safe_name = os.path.basename(file.filename)
    stored_name = f"{uuid.uuid4()}_{safe_name}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    try:
        document_id, chunk_count = ingest_pdf(db=db, file_path=file_path, original_filename=file.filename)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc

    return UploadResponse(
        message="PDF uploaded and indexed successfully",
        chunks_created=chunk_count,
        document_id=document_id,
        index_status="completed" if chunk_count > 0 else "failed",
    )
