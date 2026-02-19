import os
import uuid
from typing import List

from elasticsearch import Elasticsearch
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.services.embeddings import get_embeddings
from app.models import DocumentChunk, PDFDocument


def _get_es_client() -> Elasticsearch:
    return Elasticsearch(
        settings.ELASTIC_URL,
        http_auth=(settings.ELASTIC_USER, settings.ELASTIC_PASSWORD),
    )


def _ensure_index(es: Elasticsearch, dims: int) -> None:
    if es.indices.exists(index=settings.INDEX_NAME):
        return

    es.indices.create(
        index=settings.INDEX_NAME,
        body={
            "mappings": {
                "properties": {
                    "content": {"type": "text"},
                    "chunk_id": {"type": "keyword"},
                    "document_id": {"type": "keyword"},
                    "embedding": {"type": "dense_vector", "dims": dims},
                }
            }
        },
    )


@retry(wait=wait_exponential(multiplier=1, min=1, max=8), stop=stop_after_attempt(3), reraise=True)
def _index_chunk(es: Elasticsearch, document: dict) -> None:
    es.index(index=settings.INDEX_NAME, document=document)


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

    loader = PyPDFLoader(file_path)
    documents = loader.load()
    if not documents:
        pdf_record.index_status = "failed"
        pdf_record.error_message = "No pages found in PDF"
        db.commit()
        return pdf_record.id, 0

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
        return pdf_record.id, 0

    if len(vectors[0]) != settings.EMBEDDING_DIMS:
        pdf_record.index_status = "failed"
        pdf_record.error_message = (
            f"Embedding dimension mismatch. Expected {settings.EMBEDDING_DIMS}, got {len(vectors[0])}"
        )
        db.commit()
        return pdf_record.id, 0

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
                "document_id": str(pdf_record.id),
            },
        )

    pdf_record.chunk_count = len(chunks)
    pdf_record.index_status = "completed"
    pdf_record.error_message = None
    db.commit()
    es.indices.refresh(index=settings.INDEX_NAME)
    return pdf_record.id, len(chunks)
