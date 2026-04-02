import os
import uuid
import logging
from typing import List

from elasticsearch import Elasticsearch
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import DocumentChunk, PDFDocument
from app.services.embeddings import get_embeddings

logger = logging.getLogger(__name__)

def _get_es_client() -> Elasticsearch:
    return Elasticsearch(
        settings.ELASTIC_URL,
        http_auth=(settings.ELASTIC_USER, settings.ELASTIC_PASSWORD),
    )


def _ensure_index(es: Elasticsearch, dims: int) -> None:
    if es.indices.exists(index=settings.INDEX_NAME):
        return

    base_properties = {
        "content": {"type": "text"},
        "chunk_id": {"type": "keyword"},
        "chunk_index": {"type": "integer"},
        "document_id": {"type": "keyword"},
    }
    legacy_mapping = {
        "mappings": {
            "properties": {
                **base_properties,
                "embedding": {"type": "dense_vector", "dims": dims},
            }
        },
    }
    hnsw_mapping = {
        "mappings": {
            "properties": {
                **base_properties,
                "embedding": {
                    "type": "dense_vector",
                    "dims": dims,
                    "index": True,
                    "similarity": "cosine",
                    "index_options": {
                        "type": "hnsw",
                        "m": settings.HNSW_M,
                        "ef_construction": settings.HNSW_EF_CONSTRUCTION,
                    },
                },
            }
        },
    }

    if settings.ENABLE_HNSW_INDEX:
        try:
            es.indices.create(index=settings.INDEX_NAME, body=hnsw_mapping)
            return
        except Exception as exc:
            logger.warning("HNSW index mapping not supported; falling back to dense_vector script_score mapping: %s", exc)
            if es.indices.exists(index=settings.INDEX_NAME):
                return

    es.indices.create(index=settings.INDEX_NAME, body=legacy_mapping)


@retry(wait=wait_exponential(multiplier=1, min=1, max=8), stop=stop_after_attempt(3), reraise=True)
def _index_chunk(es: Elasticsearch, document: dict) -> None:
    es.index(index=settings.INDEX_NAME, document=document)


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

    vectors = get_embeddings().embed_documents(chunk_texts)
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

    es = _get_es_client()
    _ensure_index(es, len(vectors[0]))

    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        chunk_record = DocumentChunk(
            document_id=pdf_record.id,
            chunk_index=idx,
            content=chunk.page_content,
        )
        db.add(chunk_record)
        db.flush()

        _index_chunk(
            es,
            {
                "content": chunk.page_content,
                "embedding": vector,
                "chunk_id": str(chunk_record.id),
                "chunk_index": idx,
                "document_id": str(pdf_record.id),
            },
        )

    pdf_record.chunk_count = len(chunks)
    pdf_record.index_status = "completed"
    pdf_record.error_message = None
    db.commit()
    es.indices.refresh(index=settings.INDEX_NAME)
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
