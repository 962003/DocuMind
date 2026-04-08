import os
import uuid
import logging
from typing import List

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import DocumentChunk, PDFDocument
from app.services.embeddings import embed_documents

logger = logging.getLogger(__name__)


def _ingest_into_existing_record(db: Session, pdf_record: PDFDocument, file_path: str) -> int:
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    if not documents:
        pdf_record.index_status = "failed"
        pdf_record.error_message = "No pages found in PDF"
        db.commit()
        return 0

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(documents)
    chunk_texts: List[str] = [chunk.page_content for chunk in chunks]

    vectors = embed_documents(chunk_texts)
    if not vectors:
        pdf_record.index_status = "failed"
        pdf_record.error_message = "Embedding generation returned no vectors"
        db.commit()
        return 0

    if len(vectors[0]) != settings.EMBEDDING_DIMS:
        pdf_record.index_status = "failed"
        pdf_record.error_message = (
            f"Embedding dimension mismatch. Expected {settings.EMBEDDING_DIMS}, got {len(vectors[0])}"
        )
        db.commit()
        return 0

    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        chunk_record = DocumentChunk(
            document_id=pdf_record.id,
            chunk_index=idx,
            content=chunk.page_content,
            embedding=vector,
        )
        db.add(chunk_record)

    pdf_record.chunk_count = len(chunks)
    pdf_record.index_status = "completed"
    pdf_record.error_message = None
    db.commit()
    return len(chunks)


def ingest_pdf(db: Session, file_path: str, original_filename: str) -> tuple[uuid.UUID, int]:
    file_size = os.path.getsize(file_path)
    pdf_record = PDFDocument(
        filename=original_filename,
        file_size=file_size,
        chunk_count=0,
        index_status="processing",
    )
    db.add(pdf_record)
    db.flush()

    chunk_count = _ingest_into_existing_record(db=db, pdf_record=pdf_record, file_path=file_path)
    return pdf_record.id, chunk_count


def process_pdf_document_job(document_id: str, file_path: str) -> None:
    db = SessionLocal()
    parsed_id = uuid.UUID(document_id)
    try:
        pdf_record = db.get(PDFDocument, parsed_id)
        if not pdf_record:
            return
        pdf_record.index_status = "processing"
        pdf_record.error_message = None
        db.commit()
        _ingest_into_existing_record(db=db, pdf_record=pdf_record, file_path=file_path)
    except Exception as exc:
        db.rollback()
        pdf_record = db.get(PDFDocument, parsed_id)
        if pdf_record:
            pdf_record.index_status = "failed"
            pdf_record.error_message = str(exc)[:2000]
            db.commit()
        raise
    finally:
        db.close()
