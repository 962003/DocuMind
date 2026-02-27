import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit
from app.core.config import settings
from app.db.session import get_db
from app.models import PDFDocument
from app.schemas.upload import UploadResponse
from app.services.ingestion import process_pdf_document_job

router = APIRouter(tags=["upload"])
route_dependencies = [Depends(enforce_rate_limit)]

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

    pdf_record = PDFDocument(
        filename=file.filename,
        file_size=len(contents),
        chunk_count=0,
        index_status="processing",
    )
    db.add(pdf_record)
    db.commit()
    db.refresh(pdf_record)

    try:
        if settings.INGESTION_USE_QUEUE:
            from app.worker.tasks import process_pdf_document_task

            process_pdf_document_task.delay(str(pdf_record.id), file_path)
        else:
            process_pdf_document_job(str(pdf_record.id), file_path)
    except Exception as exc:
        db.refresh(pdf_record)
        detail = pdf_record.error_message or str(exc)
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {detail}") from exc

    db.refresh(pdf_record)

    return UploadResponse(
        message=(
            "Document uploaded successfully. Indexing started."
            if settings.INGESTION_USE_QUEUE
            else "Document uploaded and indexed successfully."
        ),
        chunks_created=pdf_record.chunk_count,
        document_id=pdf_record.id,
        index_status=pdf_record.index_status,
    )
