from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import shutil
from sqlalchemy.orm import Session

from rag.ingestion import ingest_pdf
from api.database import get_db
from api.models import PDFDocument

router = APIRouter()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # File size in bytes
    file_size = os.path.getsize(file_path)

    # Ingest into Elasticsearch
    chunk_count = ingest_pdf(file_path)

    # Save metadata in Postgres
    pdf_record = PDFDocument(
        filename=file.filename,
        file_size=file_size,
        chunk_count=chunk_count
    )

    db.add(pdf_record)
    db.commit()
    db.refresh(pdf_record)

    return {
        "message": "PDF uploaded and indexed successfully",
        "chunks_created": chunk_count,
        "id": str(pdf_record.id)
    }